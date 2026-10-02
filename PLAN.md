# Bloom Focus — Product & Delivery Plan

An adaptive digital practice platform for children aged 4–17. It trains sustained attention, visual attention, auditory attention, working memory, impulse control, following instructions and cognitive flexibility.

> **Positioning:** "An adaptive digital training platform designed to *practise* sustained attention, selective attention, working memory, inhibitory control and task persistence." We make **no claim** that the app increases attention span, and it does not diagnose. Stronger claims need clinical evidence first (see Phase 4).

---

## 1. The core idea: Assess → Train → Adapt → Measure → Progress

The product is the **adaptive engine**, not the individual games. Each game is a task type with clear rules. The engine decides *which task, how hard, how long, how many distractions, how much memory load and how often to reward*.

Most apps follow a fixed level path (Level 1 → 2 → 3). Bloom Focus keeps a **separate difficulty vector for every child and every task**:

| Dimension | Range | What it changes |
|---|---|---|
| Duration | 20 s → 3 min | How long the child sustains a block |
| Distractions | 0 → 5 | Look-alike lures → busier boards → moving items → background voices → misleading voices; in Switch Sort, how often the rule switches |
| Presentation speed | 1 → 5 | Stimulus rate, time per trial, how fast instructions hide |
| Memory load | 2 → 8 items | Sequence length |
| Instruction steps | 1 → 3 | "Tap the red circle" → "…then the star, then the blue heart" |
| Reward spacing | every 1 → every 5 correct | Moves from constant rewards toward natural persistence |

### Engine rules (implemented in `src/engine/adaptive.ts`)

After every block the engine measures hits, omissions (missed targets), commissions (early or wrong taps), correct rejections, mean reaction time, and accuracy in the first half vs the second half of the block.

- **≥ 85 % accuracy on 2 blocks in a row** → step up the *least-advanced* unlocked dimension (so difficulty grows evenly), and space out rewards.
- **65–85 %** → growth zone; nothing changes.
- **< 65 %** → ease **only the dimension that explains the struggle**:
  - Strong start, weak finish (accuracy drops by 20 or more points) → **shorter duration**.
  - More early/wrong taps than misses → **slower presentation**; if already slowest, **fewer lures / rule switches**.
  - Missed targets among clutter → **fewer distractions**.
  - Otherwise → less memory load or fewer instruction steps.
  - Rewards also become more frequent.
- **Block ended early / skipped** → shorter next block, more frequent rewards.
- Therapists can **lock** any dimension, and the engine then uses the next-best explanation.

Every change is saved with a plain-language reason (for example, "Accuracy dropped from 90 % to 30 % in the second half"). Therapists and parents can see it on each session summary.

### Distraction stages (as in the brief)

| Level | Star Watch | Pattern Garden | Pause Power |
|---|---|---|---|
| 0–1 | Plain, then coloured non-targets | Target pops out (different shape *and* colour) | Few "stop" circles |
| 2–3 | Look-alike stars, drifting shapes | Look-alikes share shape *or* colour | More "stop" circles |
| 4 | + background voices | + board reshuffles (moving) + background voices | + background voices |
| 5 | Voices say "star!" (competing information) | Voices name the wrong colours and shapes | Voices call "go!" |

Sounds use the game clock, so pausing silences them. A therapist who wants visual-only practice can lock *Distractions* at 3 in Tuning.

### Task library (v1, all playable)

| Activity | Domain | Measures |
|---|---|---|
| Star Watch | Sustained attention (continuous-performance style) | Hits, omissions, commissions, RT, fatigue |
| Pattern Garden | Visual / selective attention (visual search) | Target found, wrong picks, timeouts |
| Listen for Apple | Auditory attention (spoken words via text-to-speech) | Hits, false alarms to sound-alikes |
| Memory Echo | Working memory (digit span) | Correct sequences |
| Pause Power | Impulse control (go / no-go) | Commission errors on "stop" |
| Follow the Path | Following multi-step instructions | Correct paths, wrong steps |
| Switch Sort | Cognitive flexibility (rule switching, colour ↔ shape) | Correct sorts, old-rule errors after a switch, timeouts |
| Feelings Check-in | Emotional awareness | **Unscored and not stored**, followed by a breathing moment |

---

## 2. Roles

### 2.1 Therapist (clinician / OT / psychologist) — the plan owner

| Area | What the therapist does | Where in the app |
|---|---|---|
| Caseload | Creates and edits child profiles (nickname, age, practice focus, maximum session length); removes profiles | Children tab, New profile |
| Starting check | Runs the one-round-per-activity placement for each new child before regular practice | Child profile → Run starting check |
| Activity plan | Chooses which activities each child practises; sets the **maximum** session length (10/15/20 min). The engine grows the actual length from 5 min toward it and orders activities weakest area first | Activity plan tab |
| Engine tuning | Sets starting difficulty per dimension; locks dimensions (for example, keep duration fixed while working on distractions) | Plan → Fine-tune adaptive settings |
| Home programme | Sets home sessions per week and writes guidance that parents see on their Home screen | Activity plan → Home practice |
| Clinic sessions | Runs guided sessions and records an observation ("Stayed with it / A few reminders / Needed a pause") and a session note | Today → Start, Child profile |
| Review | Reads the attention profile per domain, practice rhythm, every engine decision with its reason, and parent notes | Insights, Child profile, Today → "New from home" |
| Communication | Two-way notes thread with the family | Child profile → Notes |
| Family access | Shares the child's 6-character family code so a parent can link to the child | Child profile → Family access |
| Reporting | Exports a PDF progress report per child; shares a text overview of all children | Child profile → Export report; Insights → Share |

### 2.2 Parent / caregiver — the home-practice partner

| Area | What the parent does | Where in the app |
|---|---|---|
| Getting started | Links to their child by entering the family code from the therapist | Welcome → I'm a parent |
| Home practice | Starts the plan the therapist set (one button). Activities, their order and the session length adapt automatically | Home tab |
| Reminders | Turns on a daily practice reminder (4–7 pm), a notification on their own phone | Home → Daily practice reminder |
| Weekly goal | Sees "2 of 3 home sessions this week" | Home tab |
| Therapist guidance | Reads the therapist's home instructions | Home → From the therapist |
| Motivation | Chooses the child's reward theme (stars, animals, vehicles, flowers), because parents know what the child loves | Home → What does … love? |
| Observation | After each home session, records how it felt and an optional note, which goes straight to the therapist | End of session |
| Progress | Plain-language summary ("strongest area … could use a little more practice"), domain bars, activity levels, recent sessions; saves a PDF report | Progress tab |
| Communication | Notes thread with the therapist (sleep, mood, what worked) | Notes tab |

**Parents cannot** run the starting check, change the activity plan, difficulty settings or locks, see family codes, or remove profiles. These decisions stay clinical.

### 2.3 Child — the player

- Sees only the session runner: large targets, a single instruction per screen, gentle feedback ("Wait for it…"), reward pops, and "A practice activity, not a test. Pausing is always okay."
- The child never sees scores or engine decisions.
- **Adult gate:** ending a session needs a press-and-hold (1.2 s). The Android back button pauses the session instead of leaving it.
- If the child leaves the app or stops touching the screen for 15 s mid-activity, the game pauses with a friendly "Still with us?". The count goes into the session summary.

---

## 3. What's built now (this repository — Expo mobile app, runs in Expo Go)

**Core**
- Seven scored activities covering all seven domains in the brief, plus the unscored feelings check-in.
- Expo SDK 54 + TypeScript, React Navigation (role-based tabs), Zustand persisted to AsyncStorage (on-device only), with storage migrations so updates never lose saved data.
- Role selection, switchable in Settings. **Parents link to a child with a 6-character family code** that the therapist shares from the child's profile.
- **Therapist:** Today, Children, Activity plan, Insights, Child profile, Edit profile, Adaptive tuning.
- **Parent:** Home, Progress, Notes.
- **Shared:** session runner with pause, skip, time budget and rewards; observation step; session summary showing "what the engine adjusted".

**Assess → Train → Adapt → Measure → Progress**
- **Starting check (assess):** new profiles are prompted to run one probe round of each activity. Placement moves up to two steps per activity (≥ 90 % → two steps, ≥ 75 % → one, < 50 % → ease the setting that explains it).
- **Engine-chosen session plan:** activities are ordered weakest area first, unpractised areas before practised ones, and the weakest gets the most turns.
- **Adaptive session length (brief §9):** new children start at 5 minutes. After each session, +1 min if accurate (≥ 80 %), fully completed and rated "Stayed with it" with no drift; −1 min if activities ended early, the child needed a pause, attention drifted twice, or accuracy fell below 60 %. The length never goes above the therapist's maximum.
- **Disengagement detection:** leaving the app mid-activity, or 15 s without a touch, pauses the activity ("Still with us?"). It is counted, shown on the summary, and feeds session-length adaptation.
- **Delayed recall:** Memory Echo's *Recall delay* setting adds a 1–5 s wait before answering, with a moving dot competing for attention.
- **Cognitive flexibility:** Switch Sort, where the rule switches more often and more subtly as the child improves.
- **Staged sound distractions** in Star Watch, Pattern Garden and Pause Power (see table above).

**Measure & share**
- **PDF progress report** created on the phone (expo-print) and shared through the system share sheet. It covers the attention profile, activity levels with engine settings, recent sessions, engine decisions and notes. Therapists export it from the child profile, parents from Progress.
- **Daily home-practice reminders**: local notifications (expo-notifications) at 4, 5, 6 or 7 pm, set by the parent. They work offline and in Expo Go, and are cancelled when switching role.
- Seed data is generated by running the real engine over simulated sessions, so the demo is consistent with live behaviour.

**Fixes to the earlier build shown in the screenshots**
- Summary no longer shows "0 % accuracy" for unplayed rounds.
- "95 % observed" is replaced by the actual observation label, since an observation isn't a percentage.
- The session timer only runs while the child is playing.

## 4. Roadmap (what still needs decisions or content from the client)

**Phase 2 — Accounts & cloud sync (4–6 weeks)** *Needs: choice of backend (Supabase or Firebase recommended), hosting region, privacy policy.*
- Therapist organisations and parent accounts. The family codes already in the app become server-issued invite codes.
- Sync between the therapist's and parent's phones (today both roles share one device).
- Role-based access control, encryption at rest, audit log, consent capture, and data export and deletion (GDPR/COPPA-ready).
- Server push notifications, for example "Ali finished home practice" sent to the therapist.

**Phase 3 — Reach (4–6 weeks)** *Needs: approved Urdu/Arabic translations and voice choices.*
- Localised UI and spoken words (Urdu/Arabic, right-to-left layout).
- Formal accessibility audit (WCAG AA), large-text mode, colour-blind-safe shape palette.
- A second flexibility task (switching between counting and naming).

**Phase 4 — Evidence (ongoing)**
- Pilot with partner clinics. Pre-registered outcome measures. Consider external validation before any efficacy claim.
- Optional heart-rate sensor integration (Mightier-style biofeedback) only with explicit consent.

## 5. Differentiation vs existing apps

| | EndeavorRx | Mightier | Cogmed | Lumosity/Peak/Elevate | **Bloom Focus** |
|---|---|---|---|---|---|
| Multi-dimensional adaptation per child | Partial | — | Span only | Level-based | **Yes, explained** |
| Therapist controls & locks | — | — | Coach | — | **Yes** |
| Parent role with home plan & notes | Limited | Parent app | Coach | — | **Yes** |
| Transparent "why it changed" | — | — | — | — | **Yes** |
| Emotional check-in (unscored) | — | Core | — | — | **Yes** |
| Staged sound distractions | Yes | — | — | — | **Yes** |

## 6. Running the app

```bash
npm install
npx expo start      # scan the QR code with Expo Go (SDK 54)
npm run typecheck
```

Demo family codes: Ali `AL8K2Q`, Sarah `SK7M4P`, Hassan `HA9R3T`.

Settings → *Reset demo data* restores the sample children; *Switch role* goes back to role selection.
