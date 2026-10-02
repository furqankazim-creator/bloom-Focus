# Child Customization + Activity Personalization + Auto-Message-Refresh + Therapist Name Implementation Plan

## Repository Research

### 1. Current therapist activity creation flow
Therapist creates activities in three places today:
- **Plan screen** ([PlanScreen.tsx](file:///Users/imac/Downloads/Bloom Focus /src/screens/therapist/PlanScreen.tsx)): therapist selects a child, toggles which of 16 TASKS are on/off, adjusts session length, sets home-sessions-per-week and homeNote. Tasks have age-gate `t.ages[0]–t.ages[1]` — if outside the age range PlanScreen shows a warning but does not automatically enable/disable based on age, and does **not** filter by ability/IQ, support need or diagnosis.
- **NoteComposer** ([NoteComposer.tsx](file:///Users/imac/Downloads/Bloom Focus /src/components/NoteComposer.tsx) activity panel L358–460): therapist picks one TRAIN_GAME and frequency → calls `activityCard(child, id, freq, extras)` to attach to a message. Support level / reward tip / therapist-note extras only just added in previous work. No auto personalization.
- **Home-scheduling** `scheduler.ts` + `demo.ts` — pick tasks from enabled set.

### 2. Child model: existing fields vs needed fields
`Child` type at [types.ts L79-L102](file:///Users/imac/Downloads/Bloom Focus /src/types.ts#L79-L102) currently has only: `id, name, age, focus, color, createdAt, sessionMinutes, currentMinutes, baselineAt, familyCode, rewardTheme, photo, avatarEmoji, homeSessionsPerWeek, homeNote, tasks`.

Missing for personalization:
- **IQ / developmental-level estimate** (cognitive age or scaled score 40–160)
- **Diagnosis / learning-difference tags** (ADHD, autism, dyslexia, etc. — free text + preset chips)
- **Support-needs profile** (already has `focus` domain but no communication / sensory / motor flags)
- **Favorite characters / motivators** (emoji + free-text, e.g. "Paw Patrol", "Spiderman") — today only `rewardTheme` covers broad style not specific media/character preference
- **Interest areas** (sports, art, music, dinosaurs, etc.)
- **Sensory sensitivities** (useful for tuning whether warnings, buzzers, animation speeds are gentle)

Server Child schema at [server/Child.js L3-L21](file:///Users/imac/Downloads/Bloom Focus /server/src/models/Child.js#L3-L21) — stores `name, age, focus, plan: Mixed`. The `plan` field is opaque and can already carry these extras, but the `syncCloudChild()` client call only syncs fixed keys. `toPublic()` only returns `plan`.

The `EditChildScreen` ([EditChildScreen.tsx](file:///Users/imac/Downloads/Bloom Focus /src/screens/EditChildScreen.tsx)) currently only captures: name, age, focus, sessionMinutes. No customization section.

### 3. Message auto-refresh — current state and gap
Cloud path (`api.ts` + `NotesThread.tsx`):
- `subscribeCloudNotes()` at [api.ts L178-L205](file:///Users/imac/Downloads/Bloom Focus /src/services/api.ts#L178-L205) does real-time via socket with rejoin-on-reconnect — **works while the thread screen is mounted**.
- In `NotesThread.tsx` L92-L118, while thread open: 20 s polling + AppState foreground refresh — **works inside a single thread view**.
- `ensureRealtime()` at [api.ts L164-L166](file:///Users/imac/Downloads/Bloom Focus /src/services/api.ts#L164-L166) is exported but **never actually called on app boot** in `RootNavigator.tsx` or screens.
- **Big gap**: Therapist thread list (`MessagesScreen.tsx`) does NOT auto-refresh. It only reads `useStore.notes` (local demo). For cloud, there is no list-wide live-update subscription, and new messages arriving while the chat is closed do not cause a re-render of the thread list unread count, because `MessagesScreen` has no poll/subscribe for the list — therapist can miss new parent messages while looking at the thread list screen. The only remedy is manual app restart.
- Also, `MessagesScreen` shows thread latest using `notes` (local only) while cloud messages live in `NotesThread.cloudNotes`. The thread list preview/count is **demo-only** in cloud mode.

### 4. Parent seeing therapist name
- Cloud: `User.displayName` ([User.js L9,15](file:///Users/imac/Downloads/Bloom Focus /server/src/models/User.js#L9-L15)) — `toProfile()` returns `{id, role, displayName}`. `claimParentInvite` returns `CloudChild` which does NOT include the therapist's displayName. Conversations list (`children/:id/conversations` L49–68 children.js) shows *parent* displayName to the therapist, but there is **no reverse endpoint** giving a parent the therapist displayName.
- Demo mode: `State.userName` exists in store (used in sign-in) but a parent signed into demo mode **never sees the therapist's userName displayed anywhere**. It is used in `WelcomeScreen` but not surfaced in the Parent* screens or Notes header.
- `ParentNotesScreen.tsx` [L24-L25](file:///Users/imac/Downloads/Bloom Focus /src/screens/parent/ParentNotesScreen.tsx#L24-L25) subtitle currently is hardcoded to "Private conversation with your therapist". Should show therapist's real name.
- `ParentHomeScreen.tsx` guidance card L143 "From the Therapist" has no name. `ParentProfileScreen` has no therapist info.

---

## Files and Modules

### Child customization model
- `src/types.ts` — extend `Child` type with: `iqScore?: number | null`, `cognitiveAge?: number | null`, `diagnosis?: string[]`, `favouriteCharacters?: {name: string; emoji: string}[]`, `interests?: string[]`, `sensory?: { loudSounds?: boolean; brightLights?: boolean; busyScreens?: boolean; tactileIssues?: boolean }`, `communicationStyle?: 'verbal' | 'nonverbal' | 'augmentative' | 'mixed'`, `supportNeeds?: string[]`
- `src/store/useStore.ts` — `NewChild` type + `addChild()` defaults + `updateChild()` includes the new keys; `persist.migrate` v9 sets defaults
- `src/services/api.ts` — `syncCloudChild()` body now includes these new keys inside the existing `plan` object + exposes new `getCloudTherapistName(childId)` (or extend `claimParentInvite` response)
- `server/src/models/Child.js` — no schema change needed (Mixed); but extend `toPublic()` so it exposes the new personalization fields if present. If we want them *outside* plan (cleaner), add top-level optional fields
- `server/src/routes/children.js` — either extend `claimParentInvite` response to include `therapist: {id, displayName}`, or add GET `/children/:id/therapist` public endpoint, whichever is simpler

### EditChildScreen — capture all the new fields
- `src/screens/EditChildScreen.tsx` — after session length, add collapsible sections:
  1. **Child profile depth**: cognitive-age or IQ (slider or 40–160 input), preset diagnosis chips (ADHD, Autism, Dyslexia, Anxiety, Learning Delay, None / Not specified) + custom chip add
  2. **Motivation**: favourite-character row chips with emoji picker + free text "Add character"
  3. **Interests**: tag chips with presets (Art, Music, Dinosaurs, Vehicles, Sports, Nature, Tech, Story books)
  4. **Support details**: communication style radio + sensory checkboxes + support-need notes chips (Fine motor, Gross motor, Speech support, Reading support, Visual schedule)

### Activity personalization engine
- `src/services/noteCards.ts` — add `personalizeActivitySuggestions(child, activities)` helper that:
  - Auto filters by age AND `cognitiveAge` fall-back to `iqScore` banding
  - Boosts tasks whose theme matches child interests / favourite character motifs (matching on text tokens)
  - Removes or warns on sensory mismatches (e.g. if sensory.loudSounds no goNoGo buzzer variant)
- `src/screens/therapist/PlanScreen.tsx` — show a "Suggested for {name}" strip at the top using `personalizeActivitySuggestions()`; disable toggles for tasks whose cognitive-age band significantly exceeds; show "Why suggested?" tooltip lines per card (matches interests / focus area / developmental level)
- `src/components/NoteComposer.tsx` activity panel — after the activity list, show "Top personalised picks" section pre-ordered by match score; support-level defaulted based on child.supportNeeds profile
- `src/games/train/meta.ts` or `src/engine/trainTasks.ts` — decorate a few meta fields per task: `motivations[]` (shape, music, story, action), so personalization can reason about them

### Message auto-refresh — no manual refresh needed
- `src/navigation/RootNavigator.tsx` — call `ensureRealtime()` inside an on-launch useEffect so socket is always connected ASAP, and keep it alive
- `src/screens/therapist/MessagesScreen.tsx` — for cloud mode: fetch conversation list via `listCloudConversations` + `listCloudNotes` for each thread's latest, a 15 s poll while focused + subscribe via socket to any thread message event (`*` — listen for thread messages and bump re-render of unread counts). Add a `subscribeCloudAllThreads(childId?, profile?)` helper to `api.ts` if needed; or reuse subscription per thread
- `src/components/NotesThread.tsx` — reduce poll from 20 s → 8 s for foreground only, plus use socket reconnect event to force-refresh
- Demo mode: already reactive through zustand store selector — no change required. But ensure thread list shows store notes with timestamp sort; `MessagesScreen` already watches `notes` correctly via useStore.

### Parent see therapist's name everywhere
- `src/store/useStore.ts` State: add `therapistDisplayName: string | null` + `setTherapistDisplayName(name)` setter, persisted or transient
- `src/services/api.ts`:
  - `claimParentInvite` response already has `child` — if server now returns therapist displayName in that response, expose it as `{child, therapist}` shape and call setter OR
  - Add `getCloudTherapist(childId): Promise<{id: string; displayName: string}>` client function and call it from `NotesThread` and `ParentHomeScreen`
- `server/src/routes/children.js`: `claimParentInvite` now returns `{child, therapist: {id, displayName: therapist.displayName || 'Your Therapist'}}`. The invite already has therapistId so a quick User.findOne is cheap.
- UI updates:
  - `ParentNotesScreen.tsx` header: under the child avatar, show therapist avatar / displayName + tagline "with Dr. Priya Sharma · Speech & Language" instead of generic line
  - `ParentHomeScreen.tsx` guidance card L143-L155: "From Dr. Priya Sharma" instead of "From the Therapist"
  - `ParentProfileScreen.tsx`: add a "Your Therapy Team" mini card at the bottom of settings stack with therapist name, avatar placeholder, `supporting since` label
  - `ParentProgressScreen.tsx` top subtitle: "Reviewed and approved by your therapist" with name

---

## Implementation Steps (dependency order)

1. **Model layer — new Child personalization fields**
   - `src/types.ts` L79-L102 extend Child type with optional iqScore, cognitiveAge, diagnosis[], favouriteCharacters[], interests[], sensory flags, communicationStyle, supportNeeds[]
   - `src/store/useStore.ts`: NewChild extends; addChild() default-initializes them as empty/none; add persist migrate step v9 for existing profiles

2. **Cloud sync for new fields + therapist name endpoint**
   - `server/src/routes/children.js`: claimParentInvite — look up Invite → therapistId → User → populate response with `therapist: {id, displayName}`
   - `src/services/api.ts`: `syncCloudChild()` plan includes new keys; `claimParentInvite` typed as `{child: CloudChild, therapist: CloudProfile}`; add `getCloudTherapist(childId)` fallback
   - `server/src/models/Child.js`: optional — add top level fields for cleanliness; or keep under plan (no schema change required if plan Mixed)

3. **EditChildScreen — full customization UI**
   - `src/screens/EditChildScreen.tsx`: Add 4 new sections below session length, each with a SectionHeader + chips / inputs / pickers. All values write to corresponding new Child fields on save.

4. **Activity personalization helpers**
   - Add `activityRecommendations(child, allTaskIds): {id: string, score: number, reasons: string[]}[]` export in a new file `src/services/activityRecommendations.ts` OR inside noteCards.ts
   - `src/engine/trainTasks.ts`: extend TaskDef with optional tags `motivations: string[]`, `sensoryFlags: string[]`
   - Seed one `motivations` set per game (just 5-6 games to prove the pattern)

5. **Plan screen — "Suggested Activities" strip + adaptive list**
   - `src/screens/therapist/PlanScreen.tsx`: render new suggestion strip before `Choose activities` section, call `activityRecommendations()`, show chips of top-5 with reason tooltips
   - Show an info line under each task card: `"Great fit for {name}'s interest in dinosaurs"` or `"Gentler pace suggested — sensory"`

6. **NoteComposer activity panel — personalised picks**
   - Activity panel in [NoteComposer.tsx](file:///Users/imac/Downloads/Bloom Focus /src/components/NoteComposer.tsx#L358): add a "Top picks for {name}" section at top of the game list with high-match activities pre-rendered as chips

7. **Messages auto-refresh (therapist thread list + global socket boot)**
   - `RootNavigator.tsx`: useEffect once on mount → `ensureRealtime()`
   - `MessagesScreen.tsx`: in cloud mode, (a) fetch each child's conversation + latest message on mount, (b) `subscribeCloudNotes` to each conversation thread, (c) add 15 s background refresh while screen `useIsFocused`, (d) unsubscribes on unmount
   - `NotesThread.tsx`: reduce poll interval to 8 s for active foreground; subscribe socket reconnect listener to `refresh()`

8. **Parent sees therapist name everywhere**
   - Wire store/setter to capture `therapistDisplayName` after `claimParentInvite` or from API
   - Update 4 screens: ParentNotesScreen header, ParentHomeScreen guidance card title, ParentProfileScreen "Therapy team" card, ParentProgressScreen subtitle

---

## Dependencies and Considerations
- **New child fields are 100% optional + safe defaults** → no breakage on existing demo or cloud data.
- **Backwards compat**: server `Child.toPublic` returning the plan already carries all new keys inside plan if we go Mixed-only route. No migration SQL/Supabase needed (we're on Mongo, schema-less).
- **Sensory flag mapping to activities**: only advisory (UI text + chip suggestion strip). No hard-blocking: therapist can still toggle anything off the recommendation.
- **Socket memory**: MessagesScreen subscribes per child — need unsubscribe cleanup.
- **Socket + poll redundancy**: intentional — we keep both because some corporate networks block websockets. Poll catches up if socket drops.
- **IQ privacy**: inputs explicitly optional with privacy notice. Not used as a hard gate, only developmental alignment.
- **Diagnosis / label chips**: never diagnostic — options labelled as "What the family reports" / "Support profile" to avoid clinical-accuracy liability.

## Validation
1. `npm run typecheck` → exit 0, no TS errors, 0 lint diagnostics
2. **Edit child → save → reopen**: diagnosis, fav chars, interests, cognitive age all persisted (reload app to confirm zustand persist)
3. **Plan screen**: suggested activities strip appears with ≥2 chips with reason text
4. **Activity card**: send one to parent → cloud syncs, personalization shows in note preview card
5. **Auto message refresh**: open therapist thread list on device A → send parent message from device B → unread count appears in <10 s WITHOUT manual refresh
6. **Parent home/notes/profile**: every "Therapist" placeholder replaced with actual name (or seed `userName` for demo mode)
7. Cloud claim-parent-invite returns `{child, therapist: {displayName}}` → verify via curl

## Risks
- **Socket thread unsub memory leaks** in MessagesScreen → use stable ref and cleanup function for each listener array
- **IQ field misinterpreted clinically** → add explanatory helper text "Optional: use only to gauge developmental fit, not diagnosis"; field not labelled as medical
- **Polling frequency too aggressive → drain battery** → only poll if isFocused AND app is active, otherwise socket-only
- **Missing therapist name in demo mode** → during demo parent sign-in, if userName exists store it separately. Otherwise fall back to "Your Therapist" safe default.
