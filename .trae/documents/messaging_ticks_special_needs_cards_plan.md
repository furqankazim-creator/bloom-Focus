# Messaging Ticks, Special-Needs Cards & Conversation UX Implementation Plan

## Repository Research

### Current state — ticks & read receipts
- The `Note` type in [types.ts](file:///Users/imac/Downloads/Bloom Focus /src/types.ts#L187-L201) already carries `deliveredAt` and `readAt`.
- The backend marks messages in [receipts.js](file:///Users/imac/Downloads/Bloom Focus /server/src/receipts.js#L10-L29) and broadcasts `receipts` over the socket room.
- The cloud client applies receipts in [api.ts](file:///Users/imac/Downloads/Bloom Focus /src/services/api.ts#L171-L176) and demo mode sets them in [useStore.ts](file:///Users/imac/Downloads/Bloom Focus /src/store/useStore.ts#L145-L175).
- A basic `Ticks` component exists in [NotesThread.tsx](file:///Users/imac/Downloads/Bloom Focus /src/components/NotesThread.tsx#L318-L329) using a single `check` vs `check-all` icon with a blue read state.
- **Gaps found:**
  1. The ticks icon uses `MaterialCommunityIcons`; `check-all` renders as two merged ticks, making the *sent* vs *delivered* distinction visually weak compared to WhatsApp's two clearly separated check marks.
  2. The thread list in [MessagesScreen.tsx](file:///Users/imac/Downloads/Bloom Focus /src/screens/therapist/MessagesScreen.tsx#L72-L102) shows **no unread badge**, no last-message ticks, and no unread-count emphasis — this is the #1 "looks unfinished" item that would stand out to a client.
  3. The "Seen …" footnote at the bottom of the thread is plain text; it doesn't feel premium.

### Current state — cards (activity / result / progress)
- Three card types exist in [types.ts](file:///Users/imac/Downloads/Bloom Focus /src/types.ts#L150-L185) and render in [NoteCardView.tsx](file:///Users/imac/Downloads/Bloom Focus /src/components/NoteCardView.tsx).
- Assignment UX lives in [NoteComposer.tsx](file:///Users/imac/Downloads/Bloom Focus /src/components/NoteComposer.tsx#L327-L383) with a game picker + frequency chips.
- **Gaps for special-needs families / client impression:**
  1. Activity cards have no concept of *scaffolding / support level* (e.g. "sit with child", "read instructions aloud", "independent"). For special-needs families, knowing *how* to support is as important as knowing *what* to do.
  2. No structured *routine / checklist* card type. Many special-needs parents live by daily checklists (morning, homework, wind-down). A therapist-created routine card that parents tick off and return would be *highly* differentiating.
  3. Activity cards don't suggest a *reward strategy* tied to the child's configured reward theme.
  4. Progress cards are number-heavy but lack a clear *celebratory milestone* section (e.g. "3 weeks in a row of 3+ sessions 🎉") that makes parents feel proud and therapists look attentive.
  5. Result cards have no "coach's note" prompt field — nothing invites the therapist to add a 1-line personalised encouragement tied to the child's effort.

## Files and Modules
- `src/types.ts` — extend `NoteCard` union with `routine` variant; extend `activity` variant with `supportLevel?`, `rewardTip?`, `therapistNote?`.
- `src/store/useStore.ts` — add `markNotesDelivered` for demo-mode offline delivery (currently messages appear *delivered* at send time for demo, which is correct for same-device demo).
- `src/services/noteCards.ts` — new `routineCard()` helper; extend `activityCard()` with support-level & note fields; add `cardSummary()` handling for `routine`; enrich quick-replies for new card types.
- `src/components/NotesThread.tsx` — rebuild `Ticks` as two separate check marks (visually distinct states: single grey = sent, double grey = delivered, double blue = read); polish the "Seen" footer; add the unread divider style tweak.
- `src/screens/therapist/MessagesScreen.tsx` — per-thread unread badge (bold name + dot + count), add ticks preview for latest *sent* message on my side, add last-message card-summary instead of raw text.
- `src/components/NoteCardView.tsx` — render the new `routine` card (interactive checklist); enhance `ActivityCard` with support-level pill, reward tip line and therapist note; enhance `ProgressCard` with milestone celebration strip; enhance `ResultCard` with an effort-based encouragement line.
- `src/components/NoteComposer.tsx` — in the activity-assignment sheet add support-level picker + optional therapist note field; add a "Routine" entry to the attach sheet (role = therapist) that opens a small routine builder UI with title + checklist items.
- `server/src/models/Message.js` — register the new `routine` card shape in `cleanCard()` and `CARD_FIELDS` so the server accepts and validates it; extend `activity` fields to allow optional `supportLevel`, `rewardTip`, `therapistNote` strings.

## Implementation Steps
1. **Model & validation layer:**
   1. Update `NoteCard` in `types.ts` — add `routine` variant, extend `activity` fields.
   2. Update Message.js `CARD_FIELDS.activity` + add `CARD_FIELDS.routine` + `cleanCard()` to accept the new fields and new type.
2. **Card helpers (noteCards.ts):**
   1. Add `SUPPORT_LEVELS` const and `routineCard()` factory.
   2. Extend `activityCard()` signature with optional `{ supportLevel?, rewardTip?, therapistNote? }`.
   3. Extend `cardSummary()` for `routine`; add quick-reply variants for routine cards (therapist: "How did the routine go?", parent: "Completed all steps", "Needed support", "Skipped today").
3. **Ticks visual polish + Seen footnote (NotesThread.tsx):**
   1. Rewrite `Ticks` component as two side-by-side `Feather` `check` icons sized 13pt, spaced -3pt so they overlap like WhatsApp. Single icon when `!deliveredAt`, two grey when only delivered, two with blue tint (or filled blue `check-circle-2` feel) when read.
   2. Add a tiny `aria-live="polite"` accessibility label reflecting the state.
   3. Upgrade "Seen …" footnote from plain text to a small chip with icon (e.g. eye-24) and better typography.
4. **Thread-list UX lift (MessagesScreen.tsx):**
   1. Compute `unread = notes.filter(n => n.childId === child.id && n.from !== 'therapist' && !n.readAt).length` per row.
   2. When unread > 0: bold the child name, add a circular blue unread dot, and show count badge (if > 1).
   3. For the latest message preview, when that latest message is *mine*, prepend the appropriate ticks icon to the preview.
   4. If latest message has a `card`, show `cardSummary(card)` instead of just `You: <text>`.
5. **Card rendering upgrade (NoteCardView.tsx):**
   1. `ActivityCard`: add `supportLevel` pill, reward-tip row (star/bullet), and an italic therapist-note block with quote styling.
   2. `ResultCard`: compute an effort message based on stars/accuracy and display it as a warm encouragement line under the chips.
   3. `ProgressCard`: add a milestone strip at the top (e.g. 🏅 "3-week streak" / ⭐ "100 stars earned" / 🎯 "Goal met") computed from the card's numbers.
   4. Add `RoutineCard` renderer: title, optional support-level, scrollable checklist rows with Pressable toggle (in demo mode, flip state locally and surface a "Completed X/Y steps" footer; in remote mode, toggles trigger a quick-reply message back to the thread with the completion).
6. **Composer upgrade (NoteComposer.tsx):**
   1. Activity sheet: below frequency chips, add `Support at home` segment (3 levels) and a small multiline note field "Optional: personal guidance for the family".
   2. Attach sheet: replace the empty placeholder option with a new "Routine" tile for therapists.
   3. Routine builder: title input + up to 8 text rows for checklist steps, add/remove rows, support-level picker, then attach the card.

## Dependencies and Considerations
- **Icon availability**: `Feather` is already used throughout; two separate `check` icons will render consistently vs the current `MaterialCommunityIcons.check-all` which varies by platform font.
- **Back-compat for activity cards**: new fields (`supportLevel`, `rewardTip`, `therapistNote`) are optional — existing activity cards render without them; `cleanCard()` will drop unknowns so old clients are safe.
- **New `routine` card type**: unknown card types fall through cleanly today (nothing renders) but we should verify `cleanCard()` returns undefined for unknown types, so old servers/clients simply ignore routine cards rather than failing.
- **Routine toggle state persistence**: for MVP, tapping a routine checkbox in the thread composes a pre-filled quick reply back to the chat; "real" per-item completion state on the card itself is out of scope (keeps backend schema change minimal — no new nested state per card).
- **Remote vs demo**: all changes must work identically in both modes — demo uses zustand, remote uses api.ts + server validation.

## Validation
1. **Ticks visual check** — open a thread, send a message from therapist → 1 grey check. Switch roles in demo or use the receipts flow → 2 grey checks. Open the other side's conversation → 2 blue checks. Verify accessibility labels in inspector.
2. **Thread list unread** — therapist Messages tab: a thread with unread messages shows bold name + blue dot and correct count. Tap the thread → counts reset. Latest preview shows ticks for "my" last message and a card summary for cards.
3. **Activity + Support level** — therapist assigns "Find Target" with "Read instructions aloud" + a note → the card shows a support pill, the note, and (if set) the reward tip. Parent taps "Start activity" and flows to game.
4. **Routine card (therapist → parent)** — create "Morning routine" with 4 steps. Card renders title + checklist rows. Parent taps each row → a completion quick-reply message is pre-filled and sent to the thread.
5. **Progress milestones** — send a progress card where `sessions >= goal` → milestone strip shows 🎯 Goal met and session streak if applicable.
6. **TypeScript build** — `npx tsc --noEmit` (or `npm run typecheck` if defined) passes with no new errors.
7. **Server validation** — hit the message endpoint with a routine card and an activity card carrying the new optional fields; confirm it saves and returns cleanly (or, if server isn't running, validate `cleanCard()` unit-style by calling the export).

## Risks
- **Risk: Routine cards sent to older app versions crash the thread.** → Mitigation: keep `NoteCard` union discriminated; `NoteCardView` switch already has exhaustive cases? If not, add a default `null`-render case. Server-side `cleanCard()` will strip the new variant when served to an older validator-less client (older clients don't run cleanCard on receipt — they trust incoming JSON — so the discriminant `type: 'routine'` will be present but the switch will just not match and render nothing, which is safe).
- **Risk: Two separate check icons visually overlap incorrectly on web vs iOS.** → Mitigation: use fixed spacing (-3pt negative margin) on the second check and size 13; test with an inline snapshot visually.
- **Risk: Unread counts on MessagesScreen double-count or miss receipts from websocket.** → Mitigation: compute counts from the same `notes` slice the thread uses; there is only one source of truth in zustand and it is updated via receipts.
