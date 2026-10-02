# Remote Parent–Therapist Messaging Setup

Remote messaging runs on the Express + MongoDB server in [server/](server/). The app stays in local demo mode until `EXPO_PUBLIC_API_URL` is set and an adult signs in. **The in-app role picker and six-character demo family codes are not authentication and must not be used to protect remote health-related data.**

## Conversations are one-to-one

Each parent linked to a child has a **private thread with that child's therapist**. The thread is identified by `(childId, parentId)`.

- A parent can only read or write their own thread. A second linked guardian (for example, a separated parent) never sees the first parent's messages.
- The therapist sees one thread per linked parent and switches between them in the Notes panel.
- The server sets sender identity and role from the signed-in session, never from the request body.

## Photos, screenshots, voice notes and documents

Messages can carry text, attachments, or both (the text becomes a caption). The composer's 📎 button adds **photos or screenshots** from the library, a **camera** photo, or a **document**; the 🎤 button records a **voice note** (up to 5 minutes). Each message holds up to 5 attachments of up to 15 MB each.

- Allowed types: JPEG, PNG, HEIC, WebP and GIF images; M4A/AAC/MP3/WAV/OGG/WebM audio; PDF, Word, Excel, PowerPoint and plain-text files. The server identifies each file **from its bytes**, not its name or declared type, and rejects anything else.
- Files are stored in MongoDB GridFS (`attachments.files` / `attachments.chunks`) with their child and thread recorded, so no separate file storage is needed.
- The app loads files through signed links that expire after one hour and only work for that one file. Reopening a conversation issues fresh links.
- In local demo mode, attachments are copied into the app's document folder on the device.

The microphone, camera and photo permission prompts are set in `app.json`. After changing them, rebuild any development or store build (Expo Go already has these permissions).

## Check-in details

The 📋 button in the message box adds an optional check-in to any message: **how the day went** (Great → Very hard), **sleep last night** (Well / Okay / Poorly) and **topic tags** (Win, Question, Challenge, Home practice, School, Routine). They appear as chips on the message, in the Today feed and in the PDF report. A message can be just a check-in, with no text.

The server stores them as `details: { mood: 1–5, sleep: 'good'|'okay'|'poor', tags: [...] }` and drops unknown values. Send them as JSON `details` (or a JSON string field in multipart form data).

## Delivery and read ticks

Each message you send shows **✓ sent**, **✓✓ delivered** (grey) or **✓✓ read** (blue), and "Seen 14:05" appears under your latest read message. The Messages tab shows an unread badge.

- *Delivered*: the other person's app received it, either instantly over the live connection (Socket.IO keeps a per-user room while the app is open) or when they next open the app or the thread.
- *Read*: they had the conversation on screen with the app in the foreground (`POST /children/:id/conversations/:parentId/read`).
- Receipts are sent live to the sender as `receipts` socket events.

## Therapy cards in the conversation

Messages can carry a card that links the chat to the child's practice:

| Card | Who sends it | What it shows |
| --- | --- | --- |
| Activity | Therapist (📎 → Activity) | Game or custom activity, level, length, how often, support level, note; turns into “✓ Done · best 85%” once played. Parents tap **Start**. |
| Routine | Therapist | A checklist of steps for a time of day |
| Game result | Parent (**Share with therapist** after a game, or 📎 → Latest result) | Score, stars, level change, time played |
| Weekly progress | Parent (Progress tab, or 📎 → Progress) | Sessions vs home goal, minutes, stars, accuracy vs last week, strongest skill, what to practise |

Quick-reply chips suggest one-tap answers to the last message (e.g. after a level-up, or a parent's question). The server validates every card field and drops anything unknown.

## Custom activities and learning profiles (therapist)

- **Learning profile** (Edit child): working age, optional standard score, family-reported support profile, communication style, sensory sensitivities, interests and up to 3 favourite characters. All optional and used only to pitch activities.
- **Personalised for {child}** (Activity plan tab): explained suggestions (focus games, starting difficulty, session length, calm mode, communication tips) with one-tap **Apply**.
- **Create activity**: build a home activity on any game with its own name, a favourite-character hero, adaptive or fixed difficulty, support level, family instructions and times per week. Families see it on Home under “From your therapist”, and it can be sent as a card in chat.
- The child's favourite character becomes the target in Tap the Stars and cheers them on at the start and end of each game.

Custom activities and profiles are stored on the device in this build (they are not yet synced to the server).

## 1. Run the server

1. Get a MongoDB database: install MongoDB locally and start its service, or create a MongoDB Atlas cluster in the hosting region chosen after privacy/legal review.
2. From the `server` directory run `npm run setup`. This creates `server/.env` with a cryptographically random JWT secret and owner-only file permissions. It refuses to overwrite an existing `.env`; never commit or share that file.
3. If MongoDB is not running locally, edit `MONGODB_URI` in `server/.env` to use your configured database URI. Keep credentials private.
4. Run `npm install`, then `npm start` (or `npm run dev` to restart on changes). Check `GET /health` returns `{"ok":true}`.
5. Put the server behind HTTPS before real use. Plain HTTP is only for local development.

### Local demo without installing MongoDB

For UI/API development only, run `npm run dev:memory`. It starts a temporary in-memory MongoDB and downloads its MongoDB binary the first time if it is not cached. **All accounts, children, invitations, and messages are deleted when the process exits. Never use this mode for real conversations or clinical data.** Use `npm start` with a persistent MongoDB database for normal operation.

## 2. Point the app at the server

1. Copy [.env.example](.env.example) to `.env` in the project root and set `EXPO_PUBLIC_API_URL`. On a physical phone use your computer's LAN IP (e.g. `http://192.168.1.10:4000`), not `localhost`.
2. Restart Metro so the value is embedded in the bundle.
3. For the web build, add its origin (e.g. `http://localhost:8081`) to `CORS_ORIGINS` in `server/.env`.

## 3. Provision a therapist identity

Every sign-up creates a **parent** account; the request cannot choose its role. After a vetted therapist has signed up, an administrator promotes them on the server:

```sh
cd server && npm run promote -- therapist@example.com
```

Never add therapist self-registration.

## API summary

| Method | Path | Who |
| --- | --- | --- |
| POST | `/auth/signup`, `/auth/login` | anyone (rate-limited) → `{ token, profile }` |
| GET | `/auth/me` | signed in |
| PUT | `/children/:id` | therapist: create/update their child |
| POST | `/children/:id/invites` | therapist: one-use, 7-day invitation token |
| POST | `/invites/claim` | parent: link to the child |
| GET | `/children/:id/conversations` | therapist: list parent threads |
| GET/POST | `/children/:id/conversations/:parentId/messages` | that parent, or the child's therapist. POST takes JSON `{ text }`, or multipart form data with `text`, up to 5 `files` and optional `meta` (JSON array, e.g. `[{"durationMs":4200}]`) |
| GET | `/files/:id?t=…` | holder of a signed link from a message (supports HTTP Range for audio) |

Live updates use Socket.IO: the client connects with `auth: { token }` and emits `thread:join { childId, parentId }`. The server runs the same access check as the REST API before letting a socket join the thread.

## Current integration boundary

Implemented and tested against a real MongoDB (in-memory test instance): sign-up/login, therapist-only child sync, invitation issue/claim/single-use, one-to-one thread isolation for REST and realtime, attachments (byte-level type checks, size limits, signed and range downloads, thread isolation), and the `NotesThread` UI (per-parent thread picker for therapists).

Not yet implemented:

- Sign-in/sign-up screens in the app (the functions exist in [src/services/api.ts](src/services/api.ts)).
- Therapist UI to sync a child and share an invitation; parent onboarding to claim it and load the remote plan.
- Cloud sync of later plan edits and session history.
- Deleting attachments when a child or account is removed, and virus scanning of uploaded documents.
- Push/email notifications, password reset, account deletion, consent flows, audit logging, and security testing.

Do not enter real child or clinical information during this stage.

## Security notes

- Passwords are hashed with bcrypt. Sessions are signed JWTs (default 30 days). Keep `JWT_SECRET` private; rotating it signs everyone out.
- Invitation tokens are 256-bit random values stored only as SHA-256 hashes, redeemed atomically, and expire after seven days.
- A signed file link works for anyone holding it until it expires (one hour). Links are never logged by the app, but treat them like the file itself.
- `EXPO_PUBLIC_*` values are bundled into the app. Put only the server URL there, never secrets.
- The old `supabase/` folder is no longer used by the app and can be deleted.
- This scaffold does not make the product HIPAA compliant, COPPA compliant, clinically validated, or ready for regulated use. Obtain independent privacy, security, legal, and clinical review before real-world deployment.
