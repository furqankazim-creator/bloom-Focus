create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.bloom_role as enum ('parent', 'therapist');
exception when duplicate_object then null;
end $$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.bloom_role not null default 'parent',
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.cloud_children (
  id text primary key,
  therapist_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  name text not null check (length(trim(name)) between 1 and 100),
  age smallint not null check (age between 4 and 17),
  focus text not null,
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.child_parents (
  child_id text not null references public.cloud_children(id) on delete cascade,
  parent_id uuid not null references auth.users(id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key (child_id, parent_id)
);

create table if not exists public.parent_invites (
  id uuid primary key default gen_random_uuid(),
  child_id text not null references public.cloud_children(id) on delete cascade,
  therapist_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  child_id text not null references public.cloud_children(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  author_role public.bloom_role not null,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists conversation_messages_child_created_idx
  on public.conversation_messages (child_id, created_at);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, role, display_name)
  values (
    new.id,
    'parent',
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 100)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();

create or replace function public.set_message_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_role public.bloom_role;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to send a message';
  end if;
  select role into sender_role from public.user_profiles where id = auth.uid();
  if sender_role is null then
    raise exception 'Account profile is missing';
  end if;
  new.sender_id := auth.uid();
  new.author_role := sender_role;
  new.body := trim(new.body);
  return new;
end;
$$;

drop trigger if exists set_conversation_message_author on public.conversation_messages;
create trigger set_conversation_message_author
before insert on public.conversation_messages
for each row execute procedure public.set_message_author();

create or replace function public.create_parent_invite(p_child_id text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  invite_token text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_profiles where id = auth.uid() and role = 'therapist'
  ) then
    raise exception 'Only an authenticated therapist can invite a parent';
  end if;
  if not exists (
    select 1 from public.cloud_children where id = p_child_id and therapist_id = auth.uid()
  ) then
    raise exception 'Child profile is not assigned to this therapist';
  end if;

  invite_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.parent_invites (child_id, therapist_id, token_hash, expires_at)
  values (
    p_child_id,
    auth.uid(),
    encode(extensions.digest(invite_token, 'sha256'), 'hex'),
    now() + interval '7 days'
  );
  return invite_token;
end;
$$;

create or replace function public.claim_parent_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  invite_child_id text;
  token_digest text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_profiles where id = auth.uid() and role = 'parent'
  ) then
    raise exception 'Sign in with a parent account to link a child';
  end if;
  if length(coalesce(p_token, '')) <> 64 then
    raise exception 'Invitation code is invalid or expired';
  end if;

  token_digest := encode(extensions.digest(p_token, 'sha256'), 'hex');
  update public.parent_invites
  set redeemed_at = now(), redeemed_by = auth.uid()
  where token_hash = token_digest
    and redeemed_at is null
    and expires_at > now()
  returning child_id into invite_child_id;

  if invite_child_id is null then
    raise exception 'Invitation code is invalid, expired, or already used';
  end if;

  insert into public.child_parents (child_id, parent_id)
  values (invite_child_id, auth.uid())
  on conflict do nothing;
  return invite_child_id;
end;
$$;

alter table public.user_profiles enable row level security;
alter table public.cloud_children enable row level security;
alter table public.child_parents enable row level security;
alter table public.parent_invites enable row level security;
alter table public.conversation_messages enable row level security;

create policy user_profiles_select_self on public.user_profiles
  for select to authenticated using (id = auth.uid());
create policy user_profiles_update_name_self on public.user_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy cloud_children_select_members on public.cloud_children
  for select to authenticated using (
    therapist_id = auth.uid()
    or exists (
      select 1 from public.child_parents cp
      where cp.child_id = cloud_children.id and cp.parent_id = auth.uid()
    )
  );
create policy cloud_children_insert_therapist on public.cloud_children
  for insert to authenticated with check (
    therapist_id = auth.uid()
    and exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'therapist')
  );
create policy cloud_children_update_therapist on public.cloud_children
  for update to authenticated using (therapist_id = auth.uid())
  with check (therapist_id = auth.uid());
create policy cloud_children_delete_therapist on public.cloud_children
  for delete to authenticated using (therapist_id = auth.uid());

create policy child_parents_select_linked on public.child_parents
  for select to authenticated using (
    parent_id = auth.uid()
    or exists (
      select 1 from public.cloud_children c
      where c.id = child_parents.child_id and c.therapist_id = auth.uid()
    )
  );

create policy parent_invites_select_issuer on public.parent_invites
  for select to authenticated using (therapist_id = auth.uid());

create policy conversation_messages_select_members on public.conversation_messages
  for select to authenticated using (
    exists (
      select 1 from public.cloud_children c
      where c.id = conversation_messages.child_id
        and (
          c.therapist_id = auth.uid()
          or exists (
            select 1 from public.child_parents cp
            where cp.child_id = c.id and cp.parent_id = auth.uid()
          )
        )
    )
  );
create policy conversation_messages_insert_members on public.conversation_messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.cloud_children c
      where c.id = conversation_messages.child_id
        and (
          c.therapist_id = auth.uid()
          or exists (
            select 1 from public.child_parents cp
            where cp.child_id = c.id and cp.parent_id = auth.uid()
          )
        )
    )
  );

revoke all on public.parent_invites from anon, authenticated;
grant select, insert, update, delete on public.cloud_children to authenticated;
grant select on public.user_profiles, public.child_parents to authenticated;
grant update (display_name) on public.user_profiles to authenticated;
grant select, insert on public.conversation_messages to authenticated;
grant execute on function public.create_parent_invite(text) to authenticated;
grant execute on function public.claim_parent_invite(text) to authenticated;

-- Supabase Realtime is optional; message fetch/send still works without this publication.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'conversation_messages'
    ) then
    alter publication supabase_realtime add table public.conversation_messages;
  end if;
end $$;
