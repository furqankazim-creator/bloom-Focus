# Bloom Focus: Market Research and Product Roadmap

**Reviewed:** 29 September 2026  
**Purpose:** Product planning, not clinical or legal advice. Competitor details below summarize public product pages and should be rechecked before launch.

## Execution Checklist

Status after the implementation work in this workspace:

### Done in this workspace

- [x] Remove invented parent-home skill percentages and level values when there is not enough real scored data.
- [x] Make the parent training-library count come from the registered game list.
- [x] Replace the Puzzle Match placeholder with its own timed, scored shape-and-color matching game.
- [x] Make Maze Path use three therapist-selected route challenges; preview the route, hide it, and score recalled direction choices.
- [x] Correct the maze wall maps so each intended route is traversable.
- [x] Update task and parent-facing metadata to describe the implemented mechanics.
- [x] Pass `npm run typecheck -- --pretty false` after the changes.

### Next local engineering work

- [ ] Add automated tests for task/metadata/component registry completeness and adaptive bounds. The repository currently has no configured test script/framework.
- [ ] Add repeatable game logic tests for timeout, pause/resume, route reachability, wrong answers, and metrics before adding more games.
- [ ] Build the therapist-authored parent guidance card with goal, exact activity/settings, schedule, observation prompt, stop guidance, approval, and review date. Keep age as a UX/accessibility input, not an automatic clinical dose.
- [ ] Add visible adult-facing safety information and accessible controls: reduced motion, non-color-only cues, sound controls, and clear stop/pause guidance.
- [ ] Audit remaining dashboard and report labels for false precision and ensure demo/sample records cannot be mistaken for real child data.
- [ ] Test the flows on real iOS and Android devices with adult users, then conduct approved, consented usability work with intended child age groups.

### Needs decisions or qualified external review

- [ ] Choose deployment region, backend, account model, and organization/clinic tenancy before implementing production cloud sync.
- [ ] Have privacy counsel map the actual data flows, COPPA applicability/consent, adolescent privacy, retention/deletion, and relevant non-US/state rules; review all third-party SDKs.
- [ ] Have a child clinician and accessibility specialist review age-band language, recommendations, contraindications, stop rules, and activity suitability before these reach families.
- [ ] Define intended use and approved product claims with regulatory counsel. Do not market as diagnosis or treatment without the appropriate evidence and regulatory pathway.
- [ ] Recruit pilot partners and define a pre-registered feasibility/evidence plan, outcome measures, adverse-event handling, and go/no-go criteria.
- [ ] Decide localization and supported voice/accessibility requirements with users and clinicians.

Checklist scope: local code items above are complete only to the extent validated by static compilation and a web bundle. No physical-device, clinician, legal, clinical efficacy, or child usability validation has been performed by this implementation pass.

## Executive Recommendation

Position Bloom Focus as a **therapist-directed home-practice and progress-coordination tool**, not as a general brain-game collection and not as a treatment for ADHD or another diagnosis. The strongest product idea is the connection between a therapist-set child plan, parent practice, transparent task adaptation, and two-way observations. More games alone will not create a defensible product.

The nearest market examples are not interchangeable: EndeavorRx is a prescribed digital therapeutic; Mightier combines emotional-regulation games with physiological biofeedback and clinician tools; Cogmed is a coached working-memory program; Lumosity and BrainHQ are broader cognitive-training products. Their public positioning shows that clinical trust, coaching, a clear training schedule, family support, and evidence are at least as important as game count.

## Competitor Comparison

| Product | Publicly described workflow | Strength Bloom can learn from | Bloom opportunity / gap |
|---|---|---|---|
| [EndeavorRx](https://www.endeavorrx.com/treatment/) | Prescription product for a specified group of children ages 8–17 with ADHD; adaptive game; public instructions describe 10–25 minutes, five days a week for at least four weeks or as prescribed. A separate Insight app shows daily effort and mission completion. It publishes indications, safety information, and cautions. | Clear intended use, defined course, real-time adaptation, parent progress view, and conspicuous safety language. | Bloom has a wider therapist-configured activity plan and a parent/therapist notes concept. It does not have EndeavorRx's product-specific authorization and evidence; do not imply equivalence or borrow its claims. |
| [Mightier](https://www.mightier.com/how-it-works/) | Publicly describes a child program for ages 6–14 using a heart-rate sensor, in-game regulation practice, parent app, and at-home activities. Its clinician offering describes client tracking and professional materials. | Connect the game to a skill that can be practised away from the screen; give parents usable support; offer a clinician workflow. | Bloom spans multiple attention and cognitive task types and exposes task-level adaptation. It has no biofeedback hardware or comparable clinician organization service. |
| [Cogmed](https://www.cogmed.com/training) | Coached, structured working-memory program; public pages describe five days a week for five weeks as a baseline, adaptive exercises, and regular coach check-ins. Its provider page describes schedule adjustments. | A defined program, qualified coaching, routine check-ins, and support for maintaining adherence. | Bloom is broader in its task domains and family interaction, but has not established a validated treatment protocol or coach training system. Cogmed's efficacy statements on its site are vendor claims; evaluate papers independently. |
| [Lumosity](https://www.lumosity.com/en/) | Consumer-focused variety of cognitive games, personalized workouts, scores, and progress insights. Its own research page says further work is needed to connect assessment gains to everyday performance and notes substantial attrition in its described study. | Easy onboarding, game variety, tutorials, daily habit, and progress presentation. | Bloom can distinguish itself through therapist-authored goals, parent practice, and a documented reason for difficulty changes rather than primarily consumer self-selection. |
| [BrainHQ](https://www.brainhq.com/) | Broad adaptive cognitive exercises, short levels, progress detail, reminders, and partner offerings. | Small sessions, adaptive challenge, and reporting that can be inspected by users who want detail. | Bloom can focus tightly on a pediatric therapist-family workflow. The public home page is not a direct substitute for that child-specific plan/notes loop. |

This is a comparison of **publicly described features**, not an exhaustive audit of private product features, current clinical evidence, pricing, or regulatory status. Individual competitor claims are not independent evidence of efficacy.

## What Bloom Has and What Is Missing

### Existing product strengths

- A therapist can select activities, set a maximum session length, tune or lock difficulty dimensions, set home frequency, and write a parent-facing note.
- A parent can run practice, record observations, view progress, and exchange notes with the therapist.
- The adaptive engine records task results and explains why settings changed.
- The app separates the unscored Feelings Check-in from scored activities.

### Current readiness gaps

- **Production accounts and connected devices:** The current app persists locally. A family code and role flow are not a substitute for authenticated, server-enforced therapist/parent access across devices. The product plan already lists cloud sync as future work.
- **Age recommendations:** Activities have age ranges and the therapist plan shows an out-of-range warning, but there is no structured age-aware parent recommendation workflow. An age range is not proof that an activity is clinically effective for that age.
- **Evidence and claims:** There is no app-specific clinical validation establishing that in-game scores transfer to school, home, or symptom improvement. Keep scores descriptive and do not label them diagnostic.
- **Activity quality:** Puzzle Match now has its own shape-and-color matching rounds. Maze Path now previews and hides one of three therapist-selected routes, changes maze walls with the instruction setting, and records choices. These are still simple prototypes, not a validated cognitive intervention; device playtesting, accessibility review, and adaptation QA remain. Block Builder is a single short sequence round and also needs more rounds, broader accessible controls, and playtesting.
- **Demo data and trust:** Seeded demo results must be clearly identified as sample data. In the parent Home screen, fabricated score and level fallbacks were removed; scores now require at least two real scored blocks.
- **Clinical operations:** No clinic organization, staff permissions, audit trail, caregiver-consent workflow, retention/deletion controls, or production reporting pipeline is established by the current local-only implementation.

## Age-Aware Therapist-to-Parent Guidance

Age should shape language, interaction, accessibility, and therapist prompts. It should **not** make the app diagnose, select treatment, or automatically prescribe a dose. The [CDC's public ADHD treatment guidance](https://www.cdc.gov/adhd/treatment/index.html) describes different evidence-based care approaches by age: parent training in behavior management is a first-line approach for children under six with ADHD; for ages six and older, recommendations include medication and behavior therapy, with parent training through age 12 and other behavior/training supports for adolescents. These are health-care recommendations, not app-game prescriptions. Diagnosis requires a health professional and information from more than one setting; see the [CDC clinical-care guidance](https://www.cdc.gov/adhd/hcp/clinical-care/index.html) and [diagnosis overview](https://www.cdc.gov/adhd/diagnosis/index.html).

| Child age | Guidance design for Bloom | Boundary |
|---|---|---|
| 4–5 | Adult-led/co-play option; concrete, one-step wording; large controls; optional offline play idea; short, flexible practice selected by the therapist and child's tolerance. Offer a caregiver-led route rather than expecting the child to self-manage the app. | For a child with ADHD, do not present digital games as a replacement for parent training in behavior management or clinician care. The CDC says parent training is an important first step under six. |
| 6–12 | Child-friendly choice within the therapist's plan; predictable routine; brief, specific instruction; parent-supported home observation. Where relevant, invite school/home context through clinician-mediated notes, not a child-facing symptom score. | Do not claim a game treats ADHD or that an in-game result predicts classroom performance. Parent training and school supports may be part of care. |
| 13–17 | More choice and autonomy; age-respectful visual design; optional teen reflection/goal-setting; let the therapist decide what parent sees and when. Support organization and planning ideas without infantilizing rewards. | Handle adolescent privacy, consent, and parent access according to jurisdiction and care setting. Avoid collecting diagnosis or school details unless required and governed. |

### Proposed recommendation card

A therapist-approved card shown to the parent should contain:

1. **Why this is suggested:** a therapist-set functional goal and the limited practice observation that informed it, such as “the last two Block Builder rounds were completed accurately.”
2. **What to do:** exact activity, selected difficulty, and one or two clear steps.
3. **When and how often:** frequency and duration chosen by the therapist for this child; never infer a clinical dose from age alone.
4. **How to support:** one co-play cue, a child choice, or an approved accessibility adjustment.
5. **What to observe:** engagement, requests for help, fatigue, frustration, or practical barriers. Do not ask parents to diagnose symptoms.
6. **When to stop/contact the therapist:** clear stop rules and a simple route to message the therapist.
7. **Review date:** when the therapist expects to revisit the plan.

The therapist should approve or edit every recommendation before it reaches a parent. The system may draft from age band, therapist-selected goal, activity eligibility, recent task history, stated child preferences, and accommodations; show the reasons and source rules. Keep a record of who approved a recommendation and when. Do not generate advice from diagnostic labels or make automatic treatment changes.

**Illustrative copy only, not a prescribed protocol:** “This week, try Block Builder after a snack on two days. Stay nearby and let Sam choose whether to try another round. Please note whether the pattern display is easy to see and whether Sam wants a break. Stop if the activity causes discomfort or significant frustration, and message me if that continues.” The clinician must choose the schedule and wording for an actual child.

## Safety, Cautions, and Trust Requirements

- State clearly: Bloom is practice/support software, not a diagnostic tool, medical treatment, emergency service, or substitute for clinician-directed care. Avoid claims such as “treats ADHD,” “increases attention span,” or “improves school performance” without the required evidence and regulatory review.
- Add in-app safety information for the adult: stop or pause if the child experiences significant frustration, headache, dizziness, nausea, eye strain, pain, or other discomfort; contact their clinician if symptoms persist. EndeavorRx publishes similar product-specific cautions. Do not imply its safety profile applies to Bloom.
- Avoid rapid flashing. Provide reduced motion, adjustable volume, sound-off mode, adequate contrast, non-color-only instructions, larger targets, and a pause/skip control. Consider photosensitive epilepsy and sensory or motor access during clinical review and testing.
- Distinguish app metrics from real-world function. Use labels such as “accuracy in this activity” and show the number of rounds behind a chart. Do not present scores as a diagnosis, percentile, or clinical norm.
- Before production accounts or cloud sync, obtain privacy/legal review. FTC guidance says COPPA can apply to child-directed online services collecting personal information from children under 13 and calls for parental notice/consent where required, parent access/deletion, security, data minimization, and retention/deletion practices. See the [FTC six-step COPPA guide](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business) and [COPPA FAQs](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions). Applicability depends on the actual product, data flows, and business model; get counsel. “COPPA-ready” or “HIPAA compliant” should not be used as marketing shortcuts.

## Phased Roadmap

### Phase 0: Make the current demo trustworthy

- Keep typecheck green and add automated tests for every task registry: all task IDs have metadata, a game component, a display name, and an age range.
- Add gameplay tests for pause/resume, completion, early exit, repeated taps, difficulty setting changes, and correct session metrics.
- [x] Make Puzzle Match distinct and make Maze Path difficulty respond to its instruction-step setting.
- [ ] Verify round length and displayed duration, pause behavior, and performance metrics on iOS and Android.
- Test with children/caregivers/therapists on iOS and Android; record usability and adverse-event observations. Confirm seed/demo banners are unmistakable.
- Review all public copy for medical claims, misleading “level” language, false precision, and trademark references.

### Phase 1: Age-aware therapist-authored home program

- Design and clinically review the recommendation-card schema and age-appropriate language.
- Add therapist approval, schedule/frequency fields, accommodations, observation prompts, stop rules, review date, and versioned audit history.
- Make out-of-age-range activities off by default; permit a therapist override only with an explicit reason and confirmation.
- Do not auto-recommend from diagnosis. Use therapist goals, valid age eligibility, limited recent performance, preferences, and access needs; clearly label low-data/insufficient-history states.

### Phase 2: Production identity, sync, privacy, and security

- Select a backend and regions only after a threat model and privacy/legal review.
- Implement adult account authentication; server-side organization/child permissions; verified, expiring caregiver invitations; revocation; least-privilege access; and audit events.
- Implement consent and parent access/export/deletion workflows, data minimization, retention schedules, backups/deletion behavior, encryption in transit/at rest, incident response, and vendor/SDK review.
- Separate demo data from real accounts and make sample data impossible to mistake for a real child's record.
- Treat COPPA, HIPAA, GDPR/UK child privacy, FERPA, and state health/student privacy questions as jurisdiction- and relationship-specific legal work, not checkboxes the code can certify.

### Phase 3: Evidence and pilot

- Form an advisory group with child clinicians, accessibility specialists, caregivers, and age-appropriate child participants.
- Predefine the intended population, eligibility, task construct, dose, outcome measures, adverse events, and stopping rules before making any efficacy claim.
- Pilot feasibility first: onboarding success, therapist plan completion, caregiver comprehension, session completion, dropout, discomfort, and support burden.
- If testing benefit, use a suitable comparison condition and validated outcomes; separate improvement on trained tasks from transfer to daily function. Pre-register and publish results, including negative or null results.

### Phase 4: Commercial readiness

- Build clinic onboarding, caseload management, role permissions, staff training, reliable report export, support operations, and transparent pricing.
- Complete accessibility and localization (including right-to-left layouts/voice quality where needed), store disclosures, privacy review, and security assessment.
- Expand games only against explicit task specifications, age-appropriate playtests, meaningful metrics, and adaptation tests. Avoid cloning competitor names, art, or protected presentation.

### Measures of product progress

Track clinician setup time, parent understanding of the assigned plan, completed vs planned home sessions, percentage of sessions with usable observations, plan changes made by therapists, child-reported enjoyment/choice where suitable, accessibility failures, pause/stop events, support tickets, data incidents, and pilot retention. Treat in-game accuracy as a product metric, not a clinical outcome.

## Reusable Research Prompt

```text
Act as a pediatric digital-health product researcher. Prepare an evidence-aware competitor and product strategy review for Bloom Focus, an Expo mobile app for children ages 4-17 that currently offers therapist and parent roles, local child profiles, therapist-selected cognitive practice activities, adaptive task difficulty, home notes, and parent progress screens. Its current data is primarily local/demo; production cross-device accounts and clinical validation are not complete.

Research current primary sources as of [DATE]: official product pages, instructions for use/labeling, privacy terms, peer-reviewed papers, trial registries, FDA or other regulator records, CDC/AAP guidance, and FTC/privacy authorities. Cover at least EndeavorRx, Mightier, Cogmed, Lumosity, and BrainHQ, plus additional direct pediatric or therapist-facing competitors you find.

For each product distinguish verified product capabilities, vendor marketing claims, independent evidence, regulatory status and intended population, age range, session schedule, adaptation, parent/clinician workflow, reporting, pricing if publicly available, safety warnings, accessibility, privacy model, and limitations. Link every material claim to its primary source and date. Do not treat testimonials or vendor-reported percentages as independent clinical evidence. Separate near-transfer task gains from improvements in everyday functioning.

Compare each competitor with Bloom. Identify features competitors publicly document that Bloom lacks, features Bloom uniquely combines (do not claim competitors lack something unless their primary sources support that), and the highest-risk gaps. Recommend a defensible positioning that does not imply diagnosis or treatment efficacy.

Create an age-aware therapist-to-parent recommendation workflow for ages 4-5, 6-12, and 13-17. Separate pediatric treatment guidelines from game UX suggestions. For each age band state caregiver role, suitable language/autonomy, accessibility needs, what a therapist may author, what parents observe, and what must not be automated. Do not invent evidence-based game dosage; mark any proposed default as a hypothesis requiring clinician review and pilot testing.

Include safety/caution requirements (visual/audio stimulation, frustration, discomfort, stop/pause rules), child privacy and consent requirements, COPPA and relevant non-US issues, medical-device/health-claim triggers requiring counsel, and an evidence plan. Finish with a phased 12-month roadmap, dependencies, validation criteria, go/no-go gates, measurable product KPIs, unresolved questions, and a concise executive summary. Do not provide individual medical advice or claim Bloom works clinically without Bloom-specific evidence.
```

## Sources Reviewed

- [EndeavorRx: treatment and schedule](https://www.endeavorrx.com/treatment/)
- [EndeavorRx: parent Insight app](https://www.endeavorrx.com/endeavorrx-insight/)
- [EndeavorRx: indications, safety, and cautions](https://www.endeavorrx.com/regulations/)
- [Mightier: how it works](https://www.mightier.com/how-it-works/)
- [Mightier: parent app](https://www.mightier.com/parent-app/)
- [Mightier: clinician offering](https://www.mightier.com/clinicians/)
- [Cogmed: training workflow](https://www.cogmed.com/training)
- [Cogmed: private practice](https://www.cogmed.com/private-practice)
- [Cogmed: research page](https://www.cogmed.com/research)
- [Lumosity: product and its own research summary](https://www.lumosity.com/en/)
- [BrainHQ: adaptive exercises and reporting](https://www.brainhq.com/)
- [CDC: ADHD treatment recommendations](https://www.cdc.gov/adhd/treatment/index.html)
- [CDC: clinical care and evaluation](https://www.cdc.gov/adhd/hcp/clinical-care/index.html)
- [CDC: ADHD diagnosis overview](https://www.cdc.gov/adhd/diagnosis/index.html)
- [CDC: parent training in behavior management](https://www.cdc.gov/adhd/treatment/behavior-therapy.html)
- [FTC: COPPA six-step compliance guide](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business)
- [FTC: COPPA FAQs](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
