# Practice Bridge Product Requirements Document (PRD)

**Version 1.0 — February 2026**
**CONFIDENTIAL — practicebridge.ai**

---

## 1. Goal, Objective and Context

### Problem Statement

Music teaching has used the same broken workflow for centuries: teacher and student meet, teacher writes notes in a pad about what to practice, student practices loosely guided by those notes, teacher has zero visibility into what actually happened. The feedback loop is open — the teacher prescribes but cannot measure, the student practices but cannot prove.

Digital tools in this space either lock teachers to someone else's content library (SmartMusic), offer shallow assignment tracking without audio intelligence (Tonara — shut down late 2023, displacing ~15-25K active teachers), or teach their own curriculum without supporting human teachers at all (Yousician, Simply Piano). No existing product lets the teacher be the content creator, makes the session programmable with conditions and branching, actually listens to the student play with professional audio quality, and uses AI to eliminate the learning curve.

### Product Vision

Practice Bridge is practice infrastructure — not a curriculum, not a teaching platform. It sits between a teacher's pedagogy (or a student's own goals) and the actual practice sessions that happen five times a week. The platform does not teach. The teacher teaches. The student practices. Practice Bridge makes every practice session as guided, structured, and measurable as the teaching itself.

### Core Objective

Build an instrument-agnostic practice platform with four cooperating components — browser app (primary UI), desktop audio engine (power users), mobile companion (acoustic/beginners), and server API — that closes the teacher-student feedback loop through programmable sessions, real-time scoring, AI session generation, and teacher analytics.

### Business Goals

- Practice Bridge launches as its own standalone platform (practicebridge.ai) from day one — own repo, own database, own deployment, own branding
- Revenue at Week 12-14 via MVP launch ($9/student + $29/teacher) — browser-only, self-assessment + time-based conditions
- Bassicology (bass education platform) is the first tenant, integrating via Practice Bridge's S2S API
- Future tenants (guitar academies, piano studios, vocal coaches) onboard via the same tenant API
- Validate product with real music teachers and students; Bassicology drives initial user acquisition

### Key Users

1. **Music Teachers** (private, studio, institutional) — Build and assign structured practice sessions, review student results, provide feedback
2. **Music Students** (with or without a teacher) — Practice assigned or self-directed sessions with optional live scoring
3. **Self-Learners** — Use platform exercises, Jam-Along, and personal goals without a teacher
4. **Studio/School Administrators** — Manage multiple teachers, classes, and institutional reporting
5. **Tenant Platforms** (e.g., Bassicology) — Instrument-specific education products that integrate via the Practice Bridge API

### MVP Scope (Week 12-14 — practicebridge.ai v1.0)

Browser-only mode on practicebridge.ai. Self-assessment and time-based conditions (no live scoring — Desktop not yet available). Session Builder with linear sessions and basic conditions. Class management. Teacher dashboard with basic analytics. Stripe billing ($9/$29). Content delivery for exercises. Tenant S2S API (v1) for Bassicology integration. Revenue generation begins — both direct users on practicebridge.ai and Bassicology users via tenant API.

### Full Platform Scope (Week 1-42)

Incremental delivery across 13 epics — from Practice Bridge Foundation (Week 1-4) through Desktop audio engine, mobile companion, AI Session Builder, Live Lesson Mode, stem removal, offline support, and developer portal. The tenant S2S API ships early (Week 5-8) so Bassicology can integrate from the start. Architecture is multi-tenant from day one — practicebridge.ai is its own platform, not embedded in any tenant's codebase.

### Platform-First Strategy

Practice Bridge is a standalone platform from day one — not embedded inside any tenant's codebase. It has its own repository, database, deployment, and domain (practicebridge.ai). Bassicology (bassicology.com) is the first tenant: a bass education platform that integrates via Practice Bridge's S2S API, the same way any future tenant would. When a student signs up on Bassicology, Bassicology's server calls `POST /api/v1/accounts` on the Practice Bridge API behind the scenes — the student never sees a separate Practice Bridge signup. Practice Bridge owns all practice data (sessions, scores, analytics, streaks). Bassicology owns its own instrument-specific content (bass exercises, 3D fretboard, video tutorials). This clean separation means Practice Bridge can scale to any number of tenants without extraction or migration — it's already its own platform.

### Key Product Principles

1. **Practice Bridge is the student's friend, not a taskmaster.** No punitive UX. No "you failed" messaging. Gentle reminders, not whips. Students practice at their own pace — the app guides, never pushes.

2. **Teachers control the structure, students control the pace.** Teachers set targets (e.g., "3 consecutive above 85%"). Students can lower tempo to get there. Students can skip steps, replay completed steps, abandon and resume sessions freely. Progress is always saved, never lost.

3. **Weekly rhythm.** The app is built around weekly practice sessions — assignments from teachers, self-built sessions from learners. This is the core cadence.

4. **Teacher-student first, self-learners second.** The MVP is a teacher-student tool. Self-learners can use the library and build their own sessions, but guided self-learner paths are post-MVP.

5. **Session templates are a must.** Teachers save sessions as templates and reuse them with adjustments. This is core to the Session Builder, not a future feature.

6. **Multi-instrument students.** One account, multiple instrument profiles, switchable with one tap. Schema designed for this from Week 1.

7. **Semester lifecycle.** Teachers open and close semesters. On close, all data is archived (accessible to both teacher and student), templates persist, and a new semester can begin. Student history spans all semesters.

8. **Basic data export in MVP.** CSV export of student results for institutional early adopters.

9. **Class list import in MVP.** Teachers can import rosters via CSV to reduce onboarding friction.

10. **Delegated teacher access.** Main teachers can grant temporary assistant access to substitutes. Substitutes see the class, existing assignments, and can create/assign sessions. Fully auditable.

11. **Accessibility baseline: WCAG 2.1 AA** for core flows — keyboard navigation, screen reader labels, color-blind-friendly scoring, minimum contrast ratios.

12. **i18n-ready from day one.** MVP is English only, but architecture must support multi-language from the start (externalized strings, locale-aware formatting).

---

## 2. Functional Requirements (MVP — Week 12-14, practicebridge.ai v1.0)

These are the core capabilities that must ship at Week 12-14 for revenue generation. Browser-only mode — no Desktop, no Mobile. Self-assessment and time-based conditions replace live scoring. The tenant S2S API ships alongside the web app so Bassicology can integrate as the first tenant.

### 2.1 Authentication & Accounts

- **FR-1.1:** Email/password signup and login via Supabase Auth
- **FR-1.2:** Magic link (passwordless) login option
- **FR-1.3:** Role assignment on signup: student or teacher
- **FR-1.4:** Multi-instrument profile support — one account, multiple instrument profiles, switchable with one tap
- **FR-1.5:** Teacher can grant temporary "assistant" access to another teacher for their class(es)
- **FR-1.6:** Account deletion (GDPR Article 17) — full data erasure within 30 days
- **FR-1.7:** Data export (GDPR Article 20) — JSON export of all user data

### 2.2 Billing & Subscriptions

- **FR-2.1:** Stripe integration — $9/mo student tier, $29/mo solo teacher tier
- **FR-2.2:** Subscription management (upgrade, downgrade, cancel)
- **FR-2.3:** 14-day free trial for both tiers
- **FR-2.4:** Billing portal access (Stripe Customer Portal)
- **FR-2.5:** Webhook handling for subscription lifecycle events (created, updated, cancelled, payment failed)

### 2.3 Session Builder (Teacher-Facing)

- **FR-3.1:** Create sessions with ordered steps — each step has: title, instructions, scoring mode (metered/expressive), tempo percentage, and audio assets (MIDI reference, backing track, reference recording — all optional)
- **FR-3.2:** Set pass conditions per step: score threshold, repetition count, time limit, self-assessment, or combined (AND/OR logic)
- **FR-3.3:** Define branching rules per step: advance condition (pass → target step) and branch condition (fail after N attempts → alternate step). All branch paths must lead to session completion (no dead ends)
- **FR-3.4:** Stacked variations — duplicate a step with adjusted tempo/threshold/scoring mode in one click
- **FR-3.5:** Upload audio assets per step (MIDI, backing tracks, reference recordings) OR record audio directly in the builder — stored on Supabase Storage / CDN
- **FR-3.6:** Add contextual teacher notes per step — surfaced to student at the right moment
- **FR-3.7:** Preview session before assigning (walk through the step flow as a student would see it)
- **FR-3.8:** Save session as template for reuse
- **FR-3.9:** Create new session from existing template with adjustable parameters
- **FR-3.10:** Assign session to multiple classes in one flow, each with its own due date. Batch creation supported.
- **FR-3.11:** Session Builder autosave — drafts auto-save every 30 seconds to server (localStorage fallback). "Draft" status visible in UI.
- **FR-3.12:** Session Builder undo/redo (Ctrl+Z / Ctrl+Y) — command stack pattern for step creation, deletion, reordering, and condition changes.
- **FR-3.13:** Auto-calculated estimated session duration based on step conditions (time limits sum, repetition-based steps estimated from average attempts). Displayed on assignment cards as "Estimated: 15-20 min."

### 2.4 Session Player (Student-Facing — Browser-Only Mode)

- **FR-4.1:** Progressive session preload — current step + next step ready before play is enabled. Remaining steps download in background. Student never blocked mid-session.
- **FR-4.2:** Display current step: title, instructions, pass condition in plain language, attempt counter, session progress ("Step 2 of 5")
- **FR-4.3:** Play backing tracks and reference recordings through browser audio output with transport controls (play, stop, tempo adjustment)
- **FR-4.4:** Student can lower tempo below the teacher's target (app suggests this when self-assessment indicates struggling). Student cannot raise tempo above the teacher-set value.
- **FR-4.5:** Condition evaluation — self-assessment ("I nailed it" / "Needs work") and time-based conditions in browser-only mode. Score-based conditions degrade gracefully to self-assessment when no Desktop connected.
- **FR-4.6:** Automatic step advancement when pass condition is met. "Next" button enabled on pass — student can also choose to keep practicing.
- **FR-4.7:** Branching runs invisibly — student sees the next step, never "you failed." If diverted to remediation, it simply appears as a new step.
- **FR-4.8:** Student can skip any step (shown as "skipped," not "completed")
- **FR-4.9:** Student can replay completed steps
- **FR-4.10:** Student can abandon a session and resume later — partial progress always saved
- **FR-4.11:** Student can reset session progress and start fresh
- **FR-4.12:** Session summary on completion: steps completed, steps skipped, self-assessment responses, time per step, total practice time
- **FR-4.13:** Audio format support — accept WAV, MP3, FLAC, AIFF, M4A, OGG on upload. Server-side transcoding to standard delivery format (MP3 192kbps for audio tracks, MIDI passed through as-is).

### 2.5 Class Management

- **FR-5.1:** Teacher creates classes with a name and default instrument
- **FR-5.2:** Student joins class via invite code or email invitation
- **FR-5.3:** Teacher imports class roster via CSV (name, email — auto-sends invitations)
- **FR-5.4:** Teacher views class roster — active members, pending invitations
- **FR-5.5:** Teacher removes students from class
- **FR-5.6:** Teacher grants/revokes assistant access to other teacher accounts per class

### 2.6 Assignments & Tracking

- **FR-6.1:** Teacher assigns sessions to classes or individual students with due dates
- **FR-6.2:** Student sees assigned sessions on their dashboard with due dates, completion status, and estimated duration
- **FR-6.3:** Student submits completed or partial session results
- **FR-6.4:** Assignment status tracking: not started, in progress, completed, overdue
- **FR-6.5:** Student can retry a completed session before the due date — each attempt tracked

### 2.7 Teacher Dashboard & Analytics

- **FR-7.1:** Per-student view: sessions completed, steps completed/skipped, branching paths taken, self-assessment responses, time spent per step, total practice time. Flags suspiciously fast completions (total time significantly below estimated duration) with visual indicator — informational, not punitive.
- **FR-7.2:** Class-wide view: completion rates, common bottleneck steps ("68% of students branched at Step 3"), practice time distribution
- **FR-7.3:** Teacher adds text feedback per student per assignment — student receives notification
- **FR-7.4:** Basic CSV export of student results (student name, sessions completed, steps completed, practice minutes, self-assessment summary)

### 2.8 Student Dashboard

- **FR-8.1:** Weekly practice plan — assignments from ALL enrolled classes grouped by class, sorted by due date. No class-switching required.
- **FR-8.2:** Practice history — past sessions with results AND re-playable (student can re-enter any past session and practice again, unscored, as personal review)
- **FR-8.3:** Practice streaks — current streak, longest streak, total sessions, total minutes
- **FR-8.4:** Gentle practice reminders via configured notification channel ("Today's practice session is waiting for you" — non-punitive, encouraging tone)

### 2.9 Notifications

- **FR-9.1:** In-app notifications (always on, cannot be disabled)
- **FR-9.2:** Email notifications (opt-in) — assignment feedback, new assignments, due date reminders
- **FR-9.3:** Push notifications (opt-in, browser push) — same events as email
- **FR-9.4:** Practice reminders — gentle, non-punitive daily nudge if student hasn't practiced and has an active assignment
- **FR-9.5:** Student configures notification preferences in settings

### 2.10 Semester Lifecycle

- **FR-10.1:** Teacher opens a new semester (name, start date, optional end date)
- **FR-10.2:** Teacher closes a semester — all session data, results, and feedback archived
- **FR-10.3:** On semester close: student and teacher can view archived data. Templates persist. Teacher can open a new semester immediately.
- **FR-10.4:** Teacher dashboard defaults to current semester view with toggle to view past semesters
- **FR-10.5:** Student sees full practice history across all semesters (their data, always accessible)

### 2.11 Content & Exercise Library

- **FR-11.1:** Platform exercise library — browsable by instrument, difficulty, category
- **FR-11.2:** Self-learners can browse library and build their own practice sessions using the Session Builder
- **FR-11.3:** Teacher can use library exercises as starting points for session steps

### 2.12 Data Architecture (MVP Constraints)

- **FR-12.1:** `tenant_id` on all tables from Week 1 — default value 'practicebridge' for direct signups, 'bassicology' for Bassicology tenant users. Multi-tenant from day one.
- **FR-12.2:** Multi-instrument profile table (`student_instruments`) instead of single `instrument` field on profiles
- **FR-12.3:** Session step `audio_source` field from Week 1 ('teacher_recording' | 'backing_track' | 'none') — supports Live Lesson Mode later without schema migration
- **FR-12.4:** Immutable session snapshots — when a session is assigned, the assignment references a frozen copy. Teacher edits to a session do not retroactively change existing assignments.
- **FR-12.5:** i18n-ready — all user-facing strings externalized, locale-aware date/number formatting

---

## 3. Non-Functional Requirements (MVP)

### 3.1 Performance

- **NFR-1.1:** Page load time < 3 seconds on 4G connection (initial load with cached service worker)
- **NFR-1.2:** Progressive session preload — current step + next step must be ready before play is enabled. Remaining steps download in background. Student is never blocked mid-session by a loading step.
- **NFR-1.3:** Browser audio playback latency < 100ms from user pressing Play to audio output (acceptable for browser-only mode — Desktop will improve this to 4-6ms later)
- **NFR-1.4:** API response time < 200ms for standard CRUD operations (p95)
- **NFR-1.5:** API response time < 500ms for analytics/dashboard aggregation queries (p95)
- **NFR-1.6:** Session state save (partial progress) completes within 1 second
- **NFR-1.7:** Real-time condition evaluation (self-assessment tap → next step render) < 300ms perceived latency

### 3.2 Scalability

- **NFR-2.1:** Architecture must support 1,000 concurrent users at MVP launch without degradation
- **NFR-2.2:** Database schema designed for multi-tenancy from day one (`tenant_id` on all tables) — 'practicebridge' for direct users, 'bassicology' for Bassicology tenant users at MVP. Additional tenants onboard without schema changes.
- **NFR-2.3:** Audio assets served via CDN (Supabase Storage / Vercel) — no server-side audio processing at any scale
- **NFR-2.4:** Stateless API server — horizontal scaling via Railway without session affinity
- **NFR-2.5:** Audio asset storage quotas — Solo Teacher: 5GB, Studio: 20GB, Institution: negotiated. Upload limits communicated in UI with usage meter. Audio files compressed to MP3 192kbps for delivery (original preserved for re-transcoding if needed).
- **NFR-2.6:** Audio transcoding pipeline — server-side transcoding on upload. Accept common input formats, normalize to delivery format. Pipeline must be async (teacher doesn't wait for transcoding to complete — upload succeeds immediately, transcoding runs in background, status shown in Session Builder).

### 3.3 Security

- **NFR-3.1:** Authentication via Supabase Auth (JWT tokens, bcrypt password hashing)
- **NFR-3.2:** Row-Level Security (RLS) on all Supabase tables — students see only their data, teachers see only their classes
- **NFR-3.3:** API rate limiting — 100 requests/minute per authenticated user, 20/minute for unauthenticated
- **NFR-3.4:** HTTPS everywhere — no unencrypted connections
- **NFR-3.5:** Stripe API keys and Supabase service role keys stored as environment variables, never committed to source
- **NFR-3.6:** OWASP Top 10 compliance — input validation, parameterized queries (via Supabase client), XSS prevention, CSRF protection
- **NFR-3.7:** Teacher assistant access is scoped per class — assistant cannot see classes they haven't been granted access to
- **NFR-3.8:** Session audio assets served via signed URLs with expiration — no direct public access to teacher-uploaded content

### 3.4 Privacy & Compliance

- **NFR-4.1:** GDPR compliance — right to access (data export), right to erasure (account deletion within 30 days), right to portability (JSON export)
- **NFR-4.2:** COPPA compliance — minimum age 13 enforced via age gate at signup. School/institutional accounts require COPPA-compliant contracts where schools consent for parents.
- **NFR-4.3:** CCPA-aligned baseline covering US state privacy laws
- **NFR-4.4:** No audio ever transmitted to or stored on the server — only metadata (scores, timing, self-assessment responses). Exception: teacher recordings uploaded as session assets (teacher-owned pedagogical content).
- **NFR-4.5:** Privacy policy and terms of service required before launch
- **NFR-4.6:** Notification content never includes sensitive data — emails say "New feedback from [Teacher Name]," not the feedback content itself

### 3.5 Reliability & Availability

- **NFR-5.1:** 99.5% uptime target for the web application (allows ~3.6 hours downtime/month)
- **NFR-5.2:** Database backups — daily automated backups via Supabase, 30-day retention
- **NFR-5.3:** Graceful degradation — if the API is temporarily unavailable, the browser shows cached data and queues submissions for retry
- **NFR-5.4:** Session player works offline once preloaded — session runs entirely client-side after preload. Self-assessment conditions evaluate locally. Results queued in IndexedDB when offline, synced automatically on reconnection with exponential backoff retry. Architect should design session player as offline-capable from day one (PWA service worker for app shell + IndexedDB for session state and queued results).
- **NFR-5.5:** Idempotent API endpoints for result submission — keyed on `{studentId, sessionId, stepId, attemptNumber}` to handle retries safely
- **NFR-5.6:** Idempotent result sync — queued offline results use the same idempotency key as online submissions. Duplicate submissions return existing record, never create duplicates.

### 3.6 Accessibility

- **NFR-6.1:** WCAG 2.1 AA compliance for all core flows (signup, session player, teacher dashboard, student dashboard, Session Builder)
- **NFR-6.2:** Full keyboard navigation — all interactive elements reachable and operable via keyboard
- **NFR-6.3:** Screen reader labels (ARIA) on all interactive elements
- **NFR-6.4:** Color-blind-friendly design — scoring and status indicators use shapes/icons alongside color, never color alone
- **NFR-6.5:** Minimum contrast ratios per WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text)
- **NFR-6.6:** No auto-playing audio without explicit user action

### 3.7 Internationalization

- **NFR-7.1:** MVP is English only
- **NFR-7.2:** All user-facing strings externalized into locale files (no hardcoded strings in components)
- **NFR-7.3:** Date, time, and number formatting locale-aware (using Intl API)
- **NFR-7.4:** Database text fields use UTF-8 encoding (Supabase/PostgreSQL default)
- **NFR-7.5:** UI layout accommodates text expansion (strings in German/French can be 30-40% longer than English)

### 3.8 Testing

- **NFR-8.1:** Unit tests (Vitest) for business logic — scoring engine, condition evaluation, session state machine, billing webhooks
- **NFR-8.2:** Integration tests for API endpoints — authentication, session CRUD, assignment flow, result submission
- **NFR-8.3:** E2E tests (Playwright) for critical user flows — signup → create class → build session → assign → student completes → teacher reviews
- **NFR-8.4:** Manual testing checklist for audio playback across browsers (Chrome, Firefox, Safari, Edge)
- **NFR-8.5:** Minimum 70% code coverage for backend business logic, 50% for frontend components

### 3.9 Observability

- **NFR-9.1:** Structured logging with correlation IDs on all API requests
- **NFR-9.2:** Error tracking (Sentry or equivalent) for both frontend and backend
- **NFR-9.3:** Basic health check endpoint (`/health`) for uptime monitoring
- **NFR-9.4:** Stripe webhook delivery monitoring — alert on repeated failures

### 3.10 Browser Support

- **NFR-10.1:** Chrome (latest 2 versions) — primary target
- **NFR-10.2:** Firefox (latest 2 versions)
- **NFR-10.3:** Safari (latest 2 versions) — critical for macOS users
- **NFR-10.4:** Edge (latest 2 versions)
- **NFR-10.5:** Responsive design — desktop-first (1024px+), functional on tablet (768px+). Mobile web is not a primary target at MVP (the mobile app serves that later).

### 3.11 Deployment & Infrastructure

- **NFR-11.1:** Frontend deployed on Vercel with preview deployments per PR
- **NFR-11.2:** Backend deployed on Railway with staging and production environments
- **NFR-11.3:** Database on Supabase with separate staging and production projects
- **NFR-11.4:** CI/CD pipeline — automated tests run on every PR, deployment on merge to main
- **NFR-11.5:** Zero-downtime deployments for both frontend and backend
- **NFR-11.6:** Environment-based configuration — no environment-specific code in the application

### 3.12 Future-Proofing (Architecture Constraints for Post-MVP)

- **NFR-12.1:** Tenant integration is via S2S REST API only — no tenant has direct database access to Practice Bridge. All communication is over HTTP with platform API keys.
- **NFR-12.2:** WebSocket protocol designed for additive capability negotiation — browser gracefully handles Desktop v1 (scoring + tuner only) through full Desktop (all capabilities)
- **NFR-12.3:** Session data model supports all three input methods (manual builder, AI builder, Live Lesson Mode) from day one — `audio_source` field on session steps
- **NFR-12.4:** REST API serves both direct users (practicebridge.ai web app) and tenants (S2S) from the same endpoints — tenant requests authenticated via `X-Platform-Key` header
- **NFR-12.5:** Audio asset storage organized by tenant and session — clean multi-tenant CDN delivery from day one

---

## 4. User Interaction and Design Goals

### 4.1 Overall Vision & Experience

**Practice Bridge should feel like a warm, encouraging practice companion — not a grading system.**

The emotional register is closer to a fitness app that celebrates your workout than a test platform that judges your performance. Every interaction should reinforce: "You showed up. You practiced. That's what matters."

- **Warm, clean, modern.** Not clinical or academic. Music is creative and personal — the UI should reflect that.
- **Calm confidence.** Muted color palette with accent colors for progress and celebration. Avoid aggressive reds for "failure" — use softer indicators (amber for "needs work," not red for "wrong").
- **Minimal during practice.** When the student is in a session, the UI recedes. Current step, instructions, transport controls, self-assessment buttons. Nothing else competing for attention. The instrument is the focus, not the screen.
- **Rich in review.** After practice, the dashboard comes alive — progress charts, streaks, feedback from teachers, session history. This is where the student reflects and the teacher analyzes.

### 4.2 Key Interaction Paradigms

**Session Builder — Manual Mode (Teacher, Desktop/Tablet Browser):**
- Vertical step list — drag to reorder, click to expand/edit
- Branching visualized as a simple tree/flowchart alongside the step list
- Condition builder as a form with dropdowns and number inputs — not a code editor
- Per-step audio recording — teacher can record a passage directly in the builder (Record button per step). This becomes the reference recording for that step. Also supports file upload (drag-and-drop or file picker) for pre-existing audio.
- Tempo wheel/input per step — sets the target BPM for the recording and for student practice
- Template save/load as a top-level action ("Save as Template" / "Start from Template")
- Autosave indicator in the header ("Saved" / "Saving..." / "Draft")
- Undo/redo in toolbar
- This is the full-featured planning mode — teacher builds sessions at their desk, between lessons

**Live Lesson Mode (Teacher, Phone or Tablet — Week 14-20):**
- Extension of the Session Builder's existing recording capability, repackaged for mid-lesson use
- Same recording engine, same step data model, same session output — different interaction surface
- Top half: one large red Record button + tempo wheel. One-handed, partial-attention design.
- Bottom half: captured steps building up as cards. Session assembles itself visually.
- No editing during lesson. End-of-lesson review screen for cleanup (60-90 seconds).
- Architecturally, this is a UI layer on top of the Session Builder's recording and step-creation APIs — not a separate system. The Architect should design the recording and step-creation APIs to serve both surfaces.

**AI Session Builder (Teacher, Desktop/Tablet Browser):**
- Text input — teacher describes session in plain language
- AI generates session preview in the same step-list format as the manual builder
- Teacher reviews and adjusts inline, approves
- Same APIs as manual builder — AI just produces the initial step structure

**All three modes produce identical session structures.** Same steps, same conditions, same audio references, same student experience. The Architect designs one session engine with multiple input surfaces.

**Session Player (Student):**
- Full-screen focused mode during practice — one step at a time, large type, transport controls prominent
- Self-assessment as large, friendly buttons — not small radio buttons. "I nailed it" (encouraging green/teal) / "Needs work" (neutral amber, not red)
- Tempo control as a slider or wheel — clearly showing teacher's target and current student-selected tempo. Can go down, cannot go up past teacher's target.
- Step progress as a horizontal pill bar — completed steps filled, current step highlighted, future steps dimmed
- Branching invisible — no visual indication the student was diverted
- Session summary as a card layout — each step as a card with result, time spent, and self-assessment response

**Teacher Dashboard:**
- Class selector → student list → session results drill-down
- Bottleneck detection highlighted prominently — "68% of students branched at Step 3" as a callout card
- Suspicious completion flags as subtle icons (clock with exclamation), not alarms
- Feedback composer as a simple text field per student per assignment — not a rich text editor
- CSV export as a button in the top-right of any results view

**Student Dashboard:**
- This week's assignments as the hero section — grouped by class, sorted by due date
- "Start Session" as the primary CTA on each assignment card — estimated duration shown
- Practice streak displayed prominently but not as pressure — "5-day streak" with a subtle flame icon, not a countdown timer
- Past sessions accessible but secondary — scrollable history below the weekly view
- Instrument profile switcher in the top nav (icon of current instrument, tap to switch)

### 4.3 Core Screens (Conceptual — MVP)

| Screen | Primary User | Purpose |
|--------|-------------|---------|
| **Login / Signup** | All | Email/password, magic link, role selection (student/teacher), instrument selection |
| **Student Dashboard** | Student | Weekly assignments, streaks, practice history, notifications |
| **Session Player** | Student | Full-screen practice experience — step-by-step with transport and self-assessment |
| **Session Summary** | Student | Post-session review — steps, results, time, self-assessment |
| **Session Builder** | Teacher | Create/edit sessions — steps, conditions, branching, audio, templates |
| **Class Management** | Teacher | Create classes, manage roster, import CSV, invite students, manage assistants |
| **Assignment Manager** | Teacher | Assign sessions to classes, set due dates, bulk assignment |
| **Teacher Dashboard** | Teacher | Class-wide and per-student analytics, bottleneck detection, feedback |
| **Settings** | All | Profile, notification preferences, instrument profiles, billing, semester management |
| **Exercise Library** | All | Browse platform exercises by instrument/difficulty/category |

### 4.4 Accessibility Design Goals

- Keyboard-first interaction design — every action achievable without a mouse
- High-contrast mode toggle (in addition to meeting WCAG 2.1 AA baseline)
- Scoring indicators use shape + color + text — never color alone (progress bars have labels, status uses icons)
- Audio player controls have clear ARIA labels and keyboard shortcuts (Space = play/pause, arrow keys = seek)
- Focus indicators visible and consistent across all interactive elements

### 4.5 Responsive Design

- **Desktop-first** (1024px+) — primary target. Session Builder and Teacher Dashboard are complex tools that need screen real estate.
- **Tablet** (768px+) — fully functional. Session Player works well on iPad (student at music stand with tablet).
- **Mobile web** (< 768px) — limited scope at MVP. Student can view assignments, check streaks, read teacher feedback. Session Player and Session Builder are not optimized for phone screens — the native mobile app (Week 22-30) serves that need.

### 4.6 Branding Considerations

- Practice Bridge branding for the platform (practicebridge.ai) from day one
- The practicebridge.ai web app ships under Practice Bridge branding — it is the product, not a white-label of something else
- The Design Architect should create a design system that supports white-labeling (color tokens, logo slots, typography as variables) so tenants can embed Practice Bridge components in their own branded experience
- No tenant-specific design decisions baked into Practice Bridge components

### 4.7 Target Devices

- Primary: laptop/desktop browser (Chrome, Firefox, Safari, Edge)
- Secondary: tablet browser (iPad Safari, Android Chrome)
- Tertiary: mobile web (responsive but limited functionality)
- Future: Practice Bridge Desktop (Tauri — own UI is tray icon only, no design needed beyond popover), Practice Bridge Mobile (native app — separate design system, technology choice is an Architect decision)

---

## 5. Technical Assumptions

### 5.1 Repository & Service Architecture

**Standalone repository (Nx + pnpm workspaces).** Practice Bridge is its own repository, completely separate from any tenant codebase (including Bassicology). This is a new project, not a fork or extension of the Bassicology monorepo.

**Rationale:** Practice Bridge is a platform product designed for mass adoption across music education. Embedding it inside a tenant's codebase would couple platform evolution to tenant-specific concerns, prevent independent deployment, and make onboarding additional tenants impossible without extraction. The Bassicology codebase provides useful patterns to learn from (Zustand, TanStack Query, Supabase Auth, shadcn/ui, NestJS + Fastify), but Practice Bridge must be built independently.

**Service architecture:** Modular monolith. Frontend (Next.js on practicebridge.ai) and Backend (NestJS API) are separate applications within the Practice Bridge monorepo, communicating via REST API. Not microservices — the team size doesn't justify the operational overhead. Practice Bridge domains:

- **Practice Bridge domains** (sessions, scoring, classes, assignments, analytics, accounts, billing, notifications, exercises) — all owned by Practice Bridge
- **Tenant integration** via S2S REST API — tenants (Bassicology, future platforms) call Practice Bridge's API with platform API keys
- Practice Bridge does NOT query tenant databases. Tenants do NOT query Practice Bridge's database directly. All communication is via the REST API.
- Practice Bridge owns ALL student practice data. Tenants own their instrument-specific content (exercises, visualizations, video sync).

### 5.2 Technology Stack (Settled)

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript 5.7 | practicebridge.ai web application |
| **Backend** | NestJS 11 + Fastify (NOT Express) | REST API + S2S tenant API. Fastify for performance. |
| **Database** | Supabase (PostgreSQL + Auth + Storage) | Own Supabase project (separate from any tenant). RLS for security. |
| **UI Components** | shadcn/ui, Radix UI, Tailwind CSS 3.4 | Radix provides a11y primitives. Design system supports white-labeling. |
| **State Management** | Zustand 5, TanStack Query 5 | Zustand for client state, TanStack for server state. |
| **Audio (Browser)** | Tone.js 15, Web Audio API | Session Player uses Web Audio for playback + transport. |
| **Build** | Nx 21, pnpm workspaces | Monorepo: frontend, backend, shared contracts, migrations. |
| **Testing** | Vitest 3 (unit), Playwright 1.52 (e2e) | Full test suite from day one. |
| **Billing** | Stripe (Checkout, Subscriptions, Customer Portal, Webhooks) | Direct billing for practicebridge.ai users. Tenant users billed by their tenant. |
| **Hosting** | Vercel (frontend), Railway (backend), Supabase (DB + auth + storage) | Independent infrastructure, not shared with any tenant. |
| **AI Orchestration** | n8n (self-hosted or cloud) | For AI Session Builder and Live Lesson Mode processing. |
| **LLM** | Claude / GPT-4 via API | For natural language → session structure translation. |
| **CDN** | Vercel / Supabase Storage | Session audio assets. Signed URLs with expiration. |

### 5.3 Technology Stack (Post-MVP, Planned)

| Layer | Technology | Milestone | Notes |
|-------|-----------|-----------|-------|
| **Desktop App** | Tauri 2.x (Rust) | Week 14-20 | System tray app. Audio capture, pitch detection, WebSocket server. |
| **Audio Capture** | CPAL 0.17+ (Rust) | Week 14-20 | CoreAudio (macOS), WASAPI/ASIO (Windows) |
| **Pitch Detection** | pyin-rs (Rust) | Week 14-20 | pYIN algorithm, direct Rust DSP |
| **WebSocket** | tokio-tungstenite (Rust) | Week 14-20 | Localhost `ws://localhost:9876` |
| **ML Inference** | ort 2.0 / ONNX Runtime | Week 20-26 | Stem removal. CoreML, CUDA, DirectML execution providers. |
| **Mobile App** | Native (technology choice is Architect decision) | Week 22-30 | iOS first. Phone mic capture, MediaPipe hand tracking, shared Rust audio engine via FFI. |
| **Speech Transcription** | Whisper.cpp / whisper-rs | Week 14-20 | Local transcription for Live Lesson Mode |
| **AEC (Click Removal)** | Platform AEC + SpeexDSP (server-side) | Week 14-20 | Three-tier pipeline for teacher recording cleanup |
| **Browser Extension** | Chrome Manifest V3, `tabCapture` API | Week 20-26 | Tab audio capture for Jam-Along streaming mode |
| **Offline Storage** | SQLite via rusqlite (Rust) | Week 30+ | Local practice results, cached sessions |
| **CLI** | clap (Rust) | Week 30+ | Headless mode for batch analysis |

### 5.4 Communication Architecture

| Path | Channel | Latency | Data |
|------|---------|---------|------|
| Browser ↔ Server | HTTPS REST API | 50-200ms | Metadata: sessions, scores, assignments, analytics |
| Browser ↔ Desktop | WebSocket (`ws://localhost:9876`) | < 1ms | Note events, tuner data, transport commands |
| Browser ↔ Mobile | WiFi WebSocket | 10-50ms | Note events, hand position data |
| Tenant ↔ PB API | HTTPS REST (S2S) | 50-200ms | Metadata: accounts, scores, assignments |
| Desktop ↔ Server | HTTPS | 100-500ms | Offline sync (batch, not real-time) |

**No audio ever transits over the internet.** Audio flows only between processes on the same machine (localhost) or from phone to laptop (WiFi, local network). The Practice Bridge server never receives, stores, processes, or transmits audio. No API endpoint accepts audio data. Teacher recordings (from Session Builder recording feature and Live Lesson Mode) are the sole exception — these are teacher-owned pedagogical content, uploaded to Practice Bridge's Supabase Storage as session assets.

### 5.5 Real-Time Data Flow During Practice

This section defines exactly what happens during a live practice session — who plays audio, who listens, who scores, and what latency each path has. This is critical because Practice Bridge Desktop is not a "feature" bolted onto a web app — it fundamentally changes where audio lives.

**Rule: No server is involved during real-time practice.** Everything below happens on localhost. The Practice Bridge API and tenant servers only receive the final results after the session ends.

#### Without Desktop (Browser-Only Mode — MVP fallback)

```
┌─ Browser tab (practicebridge.ai or tenant site) ─────────────┐
│                                                                │
│  Web Audio / Tone.js plays backing track ──► headphones       │
│  Latency: 20-50ms (Web Audio buffer)                          │
│                                                                │
│  Student's instrument ──► audio interface ──► headphones      │
│  Latency: 0ms (direct hardware monitoring)                    │
│                                                                │
│  ⚠ Timing mismatch: student hears instrument at 0ms          │
│    but backing track at 20-50ms. Noticeable but tolerable.    │
│                                                                │
│  No live scoring. Self-assessment only ("I nailed it" / "Needs│
│  work"). Fretboard shows exercise notes from browser clock.   │
│                                                                │
│  On session complete: POST results to server (50-200ms, fine) │
└────────────────────────────────────────────────────────────────┘
```

This mode works for self-assessment sessions, time-based conditions, and any student without PB Desktop. It is NOT sufficient for Bassicology's scored exercise experience — the latency mismatch and lack of live scoring make it a degraded experience.

#### With Desktop — Full Mixer (Required for Bassicology)

```
┌─ Browser tab (practicebridge.ai or bassicology.com) ──────────┐
│                                                                 │
│  NO audio playback here. Desktop owns all audio.               │
│                                                                 │
│  Browser sends:                                                │
│    Transport commands (play/stop/seek/tempo) ──► Desktop       │
│    Exercise MIDI reference data ──► Desktop (for scoring)      │
│    instrumentProfile config ──► Desktop (pitch range, etc.)    │
│                                                                 │
│  Browser receives (all via ws://localhost, < 1ms):             │
│    Playback position stream (30fps) ──► drives 3D fretboard   │
│    Note events (pitch, onset, velocity) ──► scoring + dots    │
│    Tuner data (30fps) ──► tuner display                       │
│    Input level (30fps) ──► level meter                        │
│                                                                 │
│  Browser computes score locally (DTW comparison):              │
│    Note events vs. exercise MIDI reference                     │
│    Score update visual latency: 25-35ms                        │
│                                                                 │
│  3D fretboard latency:                                         │
│    Exercise notes appearing: 1ms WS + 16ms frame = 17ms      │
│    Played note dots appearing: 5-10ms pYIN + 1ms + 16ms = 22-27ms │
│                                                                 │
│  On session complete: POST results to server (50-200ms, fine) │
└──────────┬─────────────────────────────────────────────────────┘
           │ ws://localhost:9876 (< 1ms round-trip)
           │
┌──────────▼─────────────────────────────────────────────────────┐
│  PB Desktop (Tauri tray daemon — platform-agnostic)            │
│                                                                 │
│  Audio mixer (CPAL):                                           │
│    Backing track + instrument input ──► headphones             │
│    Latency: 4-6ms total (below perception threshold)           │
│                                                                 │
│  Pitch detection (pYIN):                                       │
│    Instrument audio ──► note events to browser                 │
│    Detection latency: 5-10ms from note onset                   │
│                                                                 │
│  Playback position:                                            │
│    Streams current position at 30fps to browser                │
│    Browser uses this to animate fretboard and sync UI          │
│                                                                 │
│  Does NOT know what app is in the browser.                     │
│  Does NOT call any server API during practice.                 │
│  Does NOT store audio. Pitch data is transient.                │
└────────────────────────────────────────────────────────────────┘
```

#### Latency Budget Summary

| Signal Path | Latency | Where It Happens |
|-------------|---------|-----------------|
| Instrument → headphones (audio monitoring) | **4-6ms** | PB Desktop mixer (CPAL) |
| Backing track → headphones (audio playback) | **4-6ms** | PB Desktop mixer (CPAL) |
| Transport command (play/stop) | **1-3ms** | Browser → Desktop (WebSocket) |
| Exercise notes → 3D fretboard display | **17-19ms** | Desktop position stream → browser render |
| Played note → fretboard dot | **22-27ms** | pYIN detection → WebSocket → browser render |
| Played note → score update | **25-35ms** | pYIN → WebSocket → browser DTW comparison |
| Final results → PB API | **50-200ms** | Browser → server (HTTPS) — after session ends |
| Final results → tenant server | **50-200ms** | PB API → tenant (S2S) — after session ends |

At 120 BPM, one sixteenth note is 125ms. All visual latencies are well under one animation frame. Audio monitoring at 4-6ms is below the 10ms perception threshold. Guitar Hero and Rock Band operate at 30-50ms audio-visual latency — Practice Bridge is faster.

#### What PB Desktop Knows vs. What the Browser Knows

| | PB Desktop | Browser |
|---|---|---|
| Audio playback | Plays backing tracks, mixes with instrument | Sends transport commands only |
| Instrument audio | Captures, detects pitch, streams note events | Receives note events, never hears audio |
| Exercise content | Receives MIDI reference for scoring context | Loads exercise from its own API (Bassicology or PB) |
| Scoring | Streams raw note events (no scoring logic) | Computes score locally (DTW, accuracy, dynamics) |
| Visual display | None (tray icon only) | 3D fretboard, score UI, session progress |
| Network calls | None during practice. Offline sync after. | POST results to server after session. |

#### Tenant Integration During Practice (e.g., Bassicology)

PB Desktop is platform-agnostic. It connects to whatever browser tab requests the WebSocket connection. During a practice session on bassicology.com:

1. Bassicology's browser loads exercise MIDI from Bassicology's own API
2. Browser connects to PB Desktop via `ws://localhost:9876`
3. Browser sends `instrumentProfile` (bass, pitch range 41-400Hz) and exercise MIDI reference
4. Student clicks Play → browser sends transport command → Desktop starts playback + listening
5. Desktop streams position + note events → browser animates 3D fretboard + scores
6. Session ends → browser sends results to Bassicology backend → Bassicology forwards to PB API (S2S)

**PB Desktop never calls Bassicology's server. Bassicology never calls PB Desktop. They communicate only through the browser tab via localhost WebSocket.**

#### Bassicology Requires Full Desktop (Phase 2)

Bassicology will NOT ship with browser-only mode. The scored exercise experience with 3D fretboard visualization requires PB Desktop's full mixer for acceptable audio latency (4-6ms vs. 20-50ms browser). Self-assessment mode is a fallback for practicebridge.ai's own users — not the Bassicology experience.

This means Bassicology's integration timeline depends on PB Desktop with mixer capability (Epic 11 features, Week 20-26), not just PB Desktop v1 listener-only (Epic 10, Week 14-20).

### 5.6 WebSocket Protocol Design (PB-Audio v1)

The Architect must design the WebSocket protocol as additive from day one:

- **Capabilities-based negotiation** — Desktop announces capabilities in handshake (`["scoring", "tuner"]` at v1, expanding to `["scoring", "tuner", "stemRemoval", "mixer", "transport"]` at Week 20-26)
- **Browser checks capabilities array** and enables/disables UI features accordingly
- **No breaking changes** — protocol version integer increments only on schema-breaking changes
- **Platform-agnostic** — no Bassicology-specific message types. `instrumentProfile` message configures the pipeline for any instrument.

### 5.6 Data Architecture Decisions

- **`tenant_id` on all tables from Week 1.** Default value 'practicebridge' for direct signups, 'bassicology' for Bassicology users. Multi-tenant from day one — this is Practice Bridge's own database, not shared with any tenant.
- **`student_instruments` table** instead of single `instrument` field on profiles. One account, multiple instrument profiles.
- **`audio_source` field on session steps** from Week 1 ('teacher_recording' | 'backing_track' | 'none'). Supports Live Lesson Mode without schema migration.
- **Immutable session snapshots** for assignments. Teacher edits create new versions; existing assignments reference frozen copies.
- **Semester model** — sessions, results, and feedback scoped to semesters. Templates persist across semesters.
- **Idempotent result submission** — keyed on `{studentId, sessionId, stepId, attemptNumber}`. Handles offline sync, retries, and dual-path deduplication.

### 5.7 Audio Asset Pipeline

- **Upload:** Accept WAV, MP3, FLAC, AIFF, M4A, OGG
- **Transcode:** Server-side async transcoding to MP3 192kbps for delivery. Original preserved. MIDI files passed through as-is.
- **Storage:** Supabase Storage, organized by tenant and session. Signed URLs with expiration for delivery.
- **Quotas:** Solo Teacher 5GB, Studio 20GB, Institution negotiated.
- **Delivery:** CDN-backed. Progressive preload — current step + next step ready before play, remaining steps download in background.

### 5.8 Offline Capability

- **Session Player** designed as offline-capable from day one — runs entirely client-side once preloaded
- **Results queued in IndexedDB** when offline, synced on reconnection with exponential backoff
- **Service worker** caches app shell for offline access
- **Full offline mode** (Desktop SQLite, cached sessions) is Week 30+ but the browser-side offline pattern is established at MVP

### 5.9 Testing Strategy

| Type | Tool | Scope | When |
|------|------|-------|------|
| **Unit** | Vitest | Business logic — session state machine, condition evaluation, scoring, billing webhooks, data validation | Every PR |
| **Integration** | Vitest + Supabase test instance | API endpoints — auth, session CRUD, assignment flow, result submission, RLS policies | Every PR |
| **E2E** | Playwright | Critical flows — signup → create class → build session → assign → student completes → teacher reviews → CSV export | Before release |
| **Manual** | Checklist | Audio playback across browsers, responsive layout, a11y spot checks | Before release |
| **Coverage** | Vitest | 70% backend business logic, 50% frontend components | CI gate |

### 5.10 Deployment & Environments

| Environment | Frontend | Backend | Database | Purpose |
|-------------|----------|---------|----------|---------|
| **Local** | `localhost:3001` (PM2) | `localhost:3000` (PM2) | Supabase local | Development |
| **Staging** | Vercel preview (practicebridge.ai staging) | Railway staging | Supabase staging project | Pre-production testing |
| **Production** | Vercel production (practicebridge.ai) | Railway production | Supabase production project | Live users |

*Note: Practice Bridge infrastructure is entirely independent from any tenant's infrastructure. Bassicology runs its own Vercel/Railway/Supabase stack separately.*

- CI/CD: automated tests on every PR, deploy on merge to main
- Zero-downtime deployments
- Environment-based configuration via environment variables

### 5.11 Key Technical Constraints

1. **Fastify, not Express** — backend uses Fastify. Middleware and plugins follow Fastify patterns.
2. **ESM imports** — relative imports require `.js` extension. Alias imports (`@/`, `@practicebridge/contracts`) do not.
3. **pnpm only** — never npm or yarn.
4. **PM2 for local dev** — not `pnpm dev`.
5. **No browser microphone** — deliberate product decision. No Web Audio API instrument capture.
6. **No server-side audio processing** — all audio processing is local (Desktop/Mobile). Server handles only metadata.
7. **Supabase RLS** — row-level security enforced at the database level, not just in application code.
8. **Independent infrastructure** — Practice Bridge does not share database, hosting, or deployment with any tenant. All tenant communication is via REST API.

---

## 6. Epic Overview

### Development Timeline (Parallel Tracks)

```
Week:  1----4  5----8  9----14  14-------20  20------26  22----30  30------38
       |------|------|--------|-----------|----------|--------|----------|
Track  | E1   | E2+3 | E4-7   | E8+9      |          |        | E13     |
  A    |Found.|Bill+ |Class+  |AI Builder |          |        |Dev Prtal|
 Web   |Auth+ |SessB |Player+ |+Live      |          |        |Institut.|
       |Tenant|      |Dash+Lib|Lesson     |          |        |Offline  |
       |------|------|--------|-----------|----------|--------|----------|
Track  |      |      |        | E10       | E11      |   E12  |          |
  B    |      |      |        |Desktop v1 |Full Desk | Mobile |          |
 Apps  |      |      |        |Tauri+pYIN |ONNX+Mixer|iOS 1st |          |
       '------'------'--------'-----------'----------'--------'----------'
                              ^
                         MVP SHIP
                     practicebridge.ai
                        Week 12-14
```

### MVP Epics (Week 1-14 — practicebridge.ai v1.0)

- **Epic 1: Foundation, Auth & Tenant API** (Week 1-4)
  - Goal: Scaffold the Practice Bridge standalone platform — own repo, database schema with multi-tenant foundations, authentication (direct + tenant S2S), and multi-instrument profile system. Tenant API v1 so Bassicology can integrate from week 1.

- **Epic 2: Billing & Subscriptions** (Week 5-8)
  - Goal: Stripe integration for $9/student and $29/teacher tiers with 14-day trial. Direct billing for practicebridge.ai users. Tenant users billed by their tenant (Bassicology handles its own Stripe).

- **Epic 3: Session Builder** (Week 5-8)
  - Goal: Teachers can create structured, branching practice sessions with audio recording/upload, conditions, templates, and estimated durations. The core differentiator.

- **Epic 4: Class Management & Roster** (Week 9-12)
  - Goal: Teachers create classes, import rosters via CSV, invite students, manage assistants. The teacher-student organizational layer.

- **Epic 5: Session Player & Practice Loop** (Week 9-12)
  - Goal: Students play through assigned sessions in browser-only mode — self-assessment, tempo control, branching, offline-capable preload. The daily student experience.

- **Epic 6: Assignments, Dashboard & Analytics** (Week 9-14)
  - Goal: Assignment creation/tracking, teacher dashboard with bottleneck detection, student dashboard with streaks, notifications, semester lifecycle, CSV export. The feedback loop.

- **Epic 7: Exercise Library & Self-Learner Access** (Week 9-14)
  - Goal: Browsable exercise library, self-learners can build their own sessions. Content foundation.

### Post-MVP Epics (Week 14-38)

- **Epic 8: AI Session Builder** (Week 14-20, Track A)
  - Goal: Teachers describe sessions in plain language, AI generates session structure via n8n + LLM. Eliminates the Session Builder learning curve.

- **Epic 9: Live Lesson Mode** (Week 14-20, Track A)
  - Goal: Capture lessons as they happen — record button, tempo wheel, Whisper transcription, click track removal, end-of-lesson review. Sessions build themselves.

- **Epic 10: Practice Bridge Desktop v1** (Week 14-20, Track B — parallel with Epics 8-9)
  - Goal: Tauri tray icon app — audio capture, pYIN pitch detection, tuner, note event streaming via PB-Audio v1 WebSocket. Live scoring in browser.

- **Epic 11: Stem Removal & Full Desktop** (Week 20-26, Track B)
  - Goal: ONNX inference, Jam-Along mode, audio mixer, backing track playback, BPM/key detection, AcoustID, browser extension tab capture.

- **Epic 12: Practice Bridge Mobile — iOS First** (Week 22-30, Track B)
  - Goal: Native companion app — phone mic pitch detection (shared Rust audio engine via FFI), session audio to headphones, MediaPipe hand tracking, WiFi streaming to browser. iOS first, Android follows. Technology choice (Flutter, Swift/Kotlin, React Native) is an Architect decision.

- **Epic 13: Developer Portal, Institutional & Offline** (Week 30-38, Track A)
  - Goal: Developer portal and documentation for tenant onboarding, institutional features (school admin, bulk onboarding, LMS integration), offline SQLite + Desktop sync, CLI/headless mode. Practice Bridge is already standalone — this epic adds the self-service tenant tooling and enterprise features.

---

### Epic 1: Foundation, Auth & Tenant API (Week 1-4)

**Goal:** Scaffold the Practice Bridge standalone platform — own repo, own database, own deployment. Database schema with multi-tenant foundations, authentication (direct signups + tenant S2S), multi-instrument profile system, and tenant API v1. Everything subsequent epics build on.

**Story 1.1: Project Scaffolding & Standalone Repo Setup**
As a developer, I want the Practice Bridge project structure, build tooling, and deployment pipeline established as an independent platform so that all subsequent development has a consistent foundation.

Acceptance Criteria:
- New standalone repository created for Practice Bridge (NOT inside Bassicology's codebase)
- Nx monorepo initialized with pnpm workspaces
- `apps/frontend` — Next.js 15 (App Router) with TypeScript 5.7, Tailwind CSS 3.4, shadcn/ui
- `apps/backend` — NestJS 11 + Fastify with TypeScript 5.7
- `libs/contracts` — shared types and Zod schemas (Practice Bridge's own contracts package: `@practicebridge/contracts`)
- `supabase/` — migration directory structure
- PM2 ecosystem config for local development (frontend :3001, backend :3000)
- ESLint + Prettier configured with project conventions (ESM imports with .js extension for relative imports)
- Vitest configured for both frontend and backend
- Playwright configured for e2e
- CI pipeline: lint + test on every PR
- Vercel deployment for frontend (practicebridge.ai domain), Railway deployment for backend (staging environment)
- Environment variable structure documented (.env.local for frontend, .env for backend)
- README documenting the platform-first architecture: Practice Bridge is standalone, tenants integrate via API

*Note for Architect: This story establishes a NEW repository. Patterns from the Bassicology codebase (Zustand, TanStack Query, Supabase Auth, shadcn/ui, NestJS + Fastify, PM2) are useful references but must be implemented independently. Import rules (ESM .js extensions for relative, no extension for aliases), path aliases (@/, @practicebridge/contracts), and PM2 dev workflow must be documented and enforced.*

**Story 1.2: Database Schema & Multi-Tenant Foundation**
As a developer, I want the core database schema deployed with multi-tenant support so that Practice Bridge's own database serves both direct users and tenant users from day one.

Acceptance Criteria:
- Supabase project created for Practice Bridge (staging + production) — separate from any tenant's Supabase project
- Core tables created via migrations:
  - `profiles` — with `tenant_id` (default 'practicebridge'), `role` (student/teacher/admin), `display_name`, `notification_channels`, `acoustid_opt_in`, `created_at`
  - `student_instruments` — per-user instrument profiles (user can have multiple), with `instrument`, `is_default`, linked to `profiles`
  - `classes` — with `tenant_id`, `teacher_id`, `name`, `instrument`
  - `class_members` — join table (class_id, student_id)
  - `sessions` — with `tenant_id`, `teacher_id`, `title`, `description`, `instrument`
  - `session_steps` — with `step_order`, `title`, `instructions`, `scoring_mode`, `tempo_pct`, `audio_source`, audio asset URLs
  - `session_conditions` — condition type, threshold, value, combinator
  - `session_branches` — advance/branch logic, trigger_after, target_step_id
  - `session_assignments` — session → class mapping with due date
  - `assignments` — standalone assignment support
  - `assignment_students` — join table
  - `practice_results` — with `tenant_id`, scoring mode, all metrics, `practiced_at` (device clock), idempotency on `{studentId, sessionId, stepId, attemptNumber}`
  - `practice_streaks` — current/longest streak, totals
  - `teacher_feedback` — per-student per-assignment
  - `leaderboard_entries` — hash-based, `song_hash` (opaque), unique per student per song
  - `semesters` — teacher-owned, name, start/end dates, active flag
  - `platform_integrations` — tenant registrations and API keys (Bassicology registered as first tenant)
  - `ai_session_drafts` — AI builder audit trail (populated later, schema ready now)
- `tenant_id` present on ALL content tables, indexed. Default 'practicebridge' for direct signups.
- `student_instruments` replaces single `instrument` field on profiles
- `audio_source` field on `session_steps` ('teacher_recording' | 'backing_track' | 'none')
- All tables use UUID primary keys
- UTF-8 encoding on all text fields
- Timestamps as TIMESTAMPTZ
- Migration files versioned and repeatable

*Note for Architect: The schema must support immutable session snapshots for assignments. When a session is assigned, the assignment references a frozen version. Design the versioning mechanism — options include: snapshot table, JSONB copy in assignment, or version counter with soft-delete on edits.*

**Story 1.3: Supabase Auth Integration (Direct Users)**
As a user signing up directly on practicebridge.ai, I want to sign up and log in via email/password or magic link so that I can access the platform securely.

Acceptance Criteria:
- Supabase Auth configured with email/password and magic link providers
- Signup flow: email, password, display name, role selection (student/teacher)
- Login flow: email/password or magic link
- Password reset flow (forgot password → email → reset)
- Session management: JWT access tokens, refresh token rotation
- Auth state managed in Zustand store
- Protected routes: unauthenticated users redirected to login
- Post-login redirect to appropriate dashboard (student dashboard or teacher dashboard based on role)
- Age gate: minimum age 13 enforced at signup (date of birth field, validated server-side)
- Auth error handling: clear user-facing messages for invalid credentials, expired links, rate limiting
- Direct signups get `tenant_id = 'practicebridge'` on their profile

**Story 1.3b: Tenant S2S API & Account Auto-Creation**
As a tenant platform (e.g., Bassicology), I want to create Practice Bridge accounts for my users via API so that my students get Practice Bridge capabilities without a separate signup.

Acceptance Criteria:
- `POST /api/v1/accounts` endpoint: accepts `{email, displayName, instrument, tenantId}`, returns `{pbAccountId, accessToken, refreshToken}`
- S2S authentication: `X-Platform-Key` header identifies the tenant. Platform API key validated against `platform_integrations` table.
- OAuth2-style token model: short-lived access tokens (15 min), long-lived refresh tokens (30 days, rotated on use)
- `POST /api/v1/auth/refresh` endpoint: exchanges refresh token for new access token + rotated refresh token
- Tenant-scoped tokens: refresh tokens issued to a tenant are scoped to that tenant's platform key — cannot access other tenants' data
- Account auto-creation flow: Bassicology server calls `POST /api/v1/accounts` → PB creates profile with `tenant_id = 'bassicology'` → returns credentials → student never sees Practice Bridge signup
- S2S API failure handling: tenant receives clear error codes (400 validation, 401 auth, 409 duplicate email, 5xx server error)
- `platform_integrations` table seeded with Bassicology as first tenant (API key generated, rate limits configured)
- Rate limiting per tenant: configurable per `platform_integrations` entry (default: 1000 req/min)
- Integration test: tenant creates account → receives tokens → uses access token to call API → refreshes token → all scoped to tenant

*Note for Architect: This is the foundation of Practice Bridge's platform model. The same API that Bassicology uses is what every future tenant will use. Design it to be self-service from the start — even if the developer portal UI ships later (Epic 13), the API and key management should be production-grade here.*

**Story 1.4: Role-Based Access & Row-Level Security**
As a platform operator, I want role-based access control enforced at the database level so that students, teachers, and admins can only access data appropriate to their role.

Acceptance Criteria:
- RLS policies on all tables:
  - Students: read own profile, own practice results, own assignments, own class memberships. Write own practice results, own profile updates.
  - Teachers: read/write own classes, own sessions, own assignments. Read practice results for students in their classes. Write teacher feedback for their students.
  - Admin: full access (scoped to tenant)
- RLS policies enforce `tenant_id` scoping — users can only access data within their tenant
- Backend API validates role on all endpoints (defense in depth — RLS is primary, API validation is secondary)
- API rate limiting: 100 req/min authenticated, 20 req/min unauthenticated
- Integration tests verify: student cannot access another student's data, teacher cannot access classes they don't own, cross-tenant access blocked

**Story 1.5: Multi-Instrument Profile System**
As a student, I want to create multiple instrument profiles in my account and switch between them so that I can study multiple instruments with different teachers.

Acceptance Criteria:
- `student_instruments` table: user can create multiple instrument profiles (e.g., bass, piano)
- One profile is marked as default (`is_default`)
- Instrument profile switcher in the top navigation — icon of current instrument, tap to switch
- Switching instrument profile updates the context for: session player, exercise library filtering, class enrollment context
- Instrument selection during signup creates the first instrument profile
- Add/remove instrument profiles in Settings
- Class membership is associated with a specific instrument profile
- Backend API scopes relevant queries (practice results, assignments) to the active instrument profile when contextually appropriate

**Story 1.6: Account Deletion & Data Export (GDPR)**
As a user, I want to delete my account and export all my data so that my privacy rights under GDPR are respected.

Acceptance Criteria:
- Account deletion: user initiates from Settings. Confirmation dialog explains what will be deleted.
- Soft-delete immediately (account removed from all active queries). Hard-delete within 30 days.
- Deletion cascades: profile, practice results, assignments, class memberships, streaks, leaderboard entries, teacher feedback (received). Teacher-owned data (sessions, templates) is NOT deleted — it belongs to the teacher.
- When a student is deleted from a teacher's class, the teacher's analytics anonymize that student's results (counts retained, identity removed).
- Data export: `GET /api/v1/accounts/{id}/export` returns JSON with all user data (profile, practice results, streak history, leaderboard entries, feedback received, assignment history)
- Export does NOT include: data owned by other users, audio files (never stored on server), tenant-specific data (exported separately by tenant)
- Both deletion and export accessible from Settings page with clear UI

**Story 1.7: Teacher Assistant Access**
As a teacher, I want to grant temporary assistant access to another teacher for my class so that substitutes can manage assignments and view student results.

Acceptance Criteria:
- Teacher can invite another teacher account as "assistant" for a specific class
- Assistant can: view class roster, view student results, create and assign sessions, add feedback
- Assistant cannot: delete the class, remove students, revoke other assistants, modify billing
- Teacher can revoke assistant access at any time
- All assistant actions are auditable — logged with the assistant's user ID
- RLS policies enforce assistant scoping — assistant access is per-class, not account-wide
- UI: "Manage Assistants" in class settings, invite by email, list of current assistants with revoke button

**Story 1.8: App Shell, Layout & Navigation**
As a user on practicebridge.ai, I want a consistent application shell with navigation so that I can move between features intuitively.

Acceptance Criteria:
- App shell with responsive layout: sidebar navigation on desktop (1024px+), bottom nav on tablet (768px+), hamburger menu on mobile
- Navigation items by role:
  - Student: Dashboard, Sessions, Library, Settings
  - Teacher: Dashboard, Session Builder, Classes, Library, Settings
- Instrument profile switcher in top nav
- Notification bell icon with unread count badge (notification system built in Epic 6, but the UI slot exists now)
- User avatar/menu with: profile, settings, billing (link), logout
- Auth-aware: unauthenticated users see login/signup, authenticated users see their role-appropriate nav
- Loading states: skeleton screens for async content (consistent pattern for all future pages)
- Error boundary: graceful error handling with "Something went wrong" fallback and retry option
- Semester indicator in teacher nav (current semester name, built in Epic 6 but UI slot exists now)
- All navigation keyboard-accessible, ARIA labels on nav items
- Page wrapper with `<>...</>` fragment (Next.js convention)
- All user-facing strings externalized (i18n-ready, English only at MVP)
- Practice Bridge branding (not tenant branding) — this is the practicebridge.ai web app

---

### Epic 2: Billing & Subscriptions (Week 5-8)

**Goal:** Stripe integration for $9/student and $29/teacher tiers with 14-day trial. Revenue infrastructure.

**Dependencies:** Epic 1 (auth, profiles, schema)

**Story Sequence:**

| # | Story | Rationale |
|---|-------|-----------|
| 2.1 | Stripe product/price setup & webhook infrastructure | Foundation — products must exist before checkout |
| 2.2 | Subscription checkout flow | Depends on 2.1 — users need to be able to subscribe |
| 2.3 | 14-day free trial | Depends on 2.2 — trial is a checkout variant |
| 2.4 | Subscription management & billing portal | Depends on 2.2 — managing existing subscriptions |
| 2.5 | Access gating by subscription status | Depends on 2.2 — enforcing paid features |

---

**Story 2.1: Stripe Product/Price Setup & Webhook Infrastructure**
As a developer, I want Stripe products, prices, and webhook handling configured so that the billing system has a reliable foundation.

Acceptance Criteria:
- Stripe products created: "Practice Bridge Student" ($9/mo), "Practice Bridge Teacher" ($29/mo)
- Stripe prices configured as recurring monthly subscriptions
- Webhook endpoint (`/api/v1/billing/webhooks`) receives and validates Stripe events (signature verification)
- Handle events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`
- Subscription status stored on `profiles` table (active, trialing, past_due, cancelled, inactive)
- Webhook delivery monitoring — log failed deliveries, alert on repeated failures
- Idempotent webhook processing — duplicate events handled gracefully
- Stripe API keys stored as environment variables (test keys for staging, live keys for production)

**Story 2.2: Subscription Checkout Flow**
As a user, I want to subscribe to a plan during or after signup so that I can access the platform's features.

Acceptance Criteria:
- Pricing page showing Student ($9/mo) and Teacher ($29/mo) tiers with feature comparison
- "Subscribe" button initiates Stripe Checkout session (redirect to Stripe-hosted checkout)
- Post-checkout redirect back to app with success/cancel handling
- On successful checkout, `profiles.subscription_status` updated via webhook
- Role-appropriate plan selection: students see student plan, teachers see teacher plan
- Checkout links the Stripe customer to the Supabase user ID (stored on `profiles`)

**Story 2.3: 14-Day Free Trial**
As a new user, I want a 14-day free trial so that I can evaluate the platform before committing to a subscription.

Acceptance Criteria:
- Trial period configured on Stripe subscription (14 days, no payment method required upfront — or payment method required but not charged, per business decision)
- Trial status reflected in app: "Trial: 8 days remaining" in Settings and nav
- Trial expiry warning notifications at 3 days and 1 day remaining
- On trial expiry without conversion: account transitions to `inactive` status, access gated (see Story 2.5)
- On trial conversion: seamless transition to paid subscription, no interruption

**Story 2.4: Subscription Management & Billing Portal**
As a subscriber, I want to manage my subscription (upgrade, downgrade, cancel, update payment method) so that I control my billing.

Acceptance Criteria:
- "Manage Subscription" button in Settings opens Stripe Customer Portal
- Customer Portal configured with: plan switching, cancellation, payment method update, invoice history
- Cancellation flow: subscription remains active until end of billing period, then transitions to `inactive`
- Downgrade: teacher to student plan change reflected in role and feature access
- Upgrade: student to teacher plan change reflected immediately
- Subscription status changes handled via webhooks (Story 2.1)

**Story 2.5: Access Gating by Subscription Status**
As a platform operator, I want features gated by subscription status so that only paying users (or trialing users) access the full platform.

Acceptance Criteria:
- Active or trialing users: full access to all features per their role
- Inactive users (expired trial, cancelled, payment failed): read-only access to own data (practice history, profile). Cannot start new sessions, create classes, or assign sessions. Dashboard shows "Subscribe to continue" CTA.
- Past-due users (payment failed): grace period (configurable, suggest 7 days). Warning banner: "Payment failed — update your payment method to continue." After grace period, transitions to inactive.
- Access gating enforced at both frontend (route guards, UI disabling) and backend (API middleware checks subscription status)
- RLS policies do NOT enforce billing — billing is application-level logic, not database-level

---

### Epic 3: Session Builder (Week 5-8)

**Goal:** Teachers can create structured, branching practice sessions with audio recording/upload, conditions, templates, and estimated durations. The core differentiator.

**Dependencies:** Epic 1 (auth, schema — session tables)

**Story Sequence:**

| # | Story | Rationale |
|---|-------|-----------|
| 3.1 | Session CRUD & step management | Core data operations must exist first |
| 3.2 | Audio upload & in-builder recording | Steps need audio assets |
| 3.3 | Conditions & branching logic | Steps need pass/fail rules |
| 3.4 | Stacked variations | Builds on steps + conditions |
| 3.5 | Session preview | Requires all session components to exist |
| 3.6 | Templates (save & load) | Requires complete session structure |
| 3.7 | Autosave, undo/redo & estimated duration | Polish — depends on all above |

---

**Story 3.1: Session CRUD & Step Management**
As a teacher, I want to create, edit, and organize practice sessions with ordered steps so that I can structure my students' practice.

Acceptance Criteria:
- Create new session: title, description, default instrument
- Add steps to a session: each step has title, instructions, scoring mode (metered/expressive), tempo percentage
- Reorder steps via drag-and-drop
- Edit step details inline (click to expand)
- Delete steps with confirmation
- Session list view: teacher sees all their sessions (draft and published) with search/filter
- Backend: `POST /api/v1/sessions`, `GET /api/v1/sessions`, `PATCH /api/v1/sessions/{id}`, `DELETE /api/v1/sessions/{id}`, step CRUD nested under sessions
- Draft status: sessions start as "draft" until explicitly published or assigned

**Story 3.2: Audio Upload & In-Builder Recording**
As a teacher, I want to upload audio files or record passages directly in the Session Builder so that each step has reference material for my students.

Acceptance Criteria:
- Per-step audio upload: drag-and-drop or file picker. Accept WAV, MP3, FLAC, AIFF, M4A, OGG.
- Per-step audio recording: Record button in each step opens a recording interface. Teacher records a passage. Recording saved as the step's reference audio.
- Tempo wheel/input per step: teacher sets the target BPM before recording. Click track available during recording.
- Uploaded/recorded audio stored on Supabase Storage with signed URLs
- Async transcoding pipeline: upload succeeds immediately, transcoding to MP3 192kbps runs in background. Status indicator in step card ("Processing..." to "Ready").
- Audio playback preview in the step card — teacher can listen before assigning
- Storage quota tracking: usage meter in Settings, warning at 80% and 100% of quota
- `audio_source` field set appropriately: 'teacher_recording' for recorded, 'backing_track' for uploaded, 'none' if no audio

**Story 3.3: Conditions & Branching Logic**
As a teacher, I want to set pass conditions and branching rules per step so that the session adapts to each student's progress.

Acceptance Criteria:
- Condition builder per step: dropdown for condition type (score threshold, repetition count, time limit, self-assessment, combined)
- For combined conditions: AND/OR toggle between conditions
- Threshold inputs: numeric fields for score %, repetition count, time in minutes
- Self-assessment options: configurable response options (default: "I nailed it" / "Needs work")
- Branching rules per step: "On pass → go to [step]" (default: next step) and "On fail after [N] attempts → go to [step]"
- Visual branching indicator: simple tree/flowchart alongside the step list showing branch paths
- Validation: all branch paths must lead to session completion (no dead ends, no infinite loops). UI warns if validation fails.
- Score-based conditions display a note: "Requires Practice Bridge Desktop for automatic evaluation. Without Desktop, students will use self-assessment."

**Story 3.4: Stacked Variations**
As a teacher, I want to quickly create variations of a step at increasing difficulty so that students practice progressively.

Acceptance Criteria:
- "Add Variation" button on any step — duplicates the step with adjustable parameters
- Adjustable per variation: tempo percentage, pass condition threshold, scoring mode
- Variations visually grouped in the step list (indented or connected)
- Audio assets inherited from the parent step (not re-uploaded)
- Variations auto-linked: pass on variation 1 → advance to variation 2 → ... → advance to next step

**Story 3.5: Session Preview**
As a teacher, I want to preview a session as a student would see it so that I can verify the flow before assigning.

Acceptance Criteria:
- "Preview" button opens the session in a student-like view
- Teacher walks through steps, sees instructions, can trigger conditions manually (simulate "pass" or "fail")
- Branching paths visible during preview — teacher can explore all paths
- Audio playback works in preview
- Preview does not create any practice results or affect data
- Exit preview returns to the Session Builder

**Story 3.6: Templates (Save & Load)**
As a teacher, I want to save sessions as templates and create new sessions from templates so that I can reuse session structures efficiently.

Acceptance Criteria:
- "Save as Template" action: saves the current session structure (steps, conditions, branching, scoring modes, tempo percentages) as a named template. Audio assets are referenced, not duplicated.
- "Start from Template" action: creates a new session pre-populated from a template. Teacher can modify any aspect.
- Template library: list of saved templates with search by name
- Templates persist across semesters
- Templates are private to the teacher (no sharing at MVP — sharing is post-MVP/moat feature)

**Story 3.7: Autosave, Undo/Redo & Estimated Duration**
As a teacher, I want my work auto-saved, undoable, and sessions to show estimated duration so that I don't lose work and students know what to expect.

Acceptance Criteria:
- Autosave: session drafts save every 30 seconds to server. localStorage fallback if server is unreachable. Status indicator: "Saved" / "Saving..." / "Offline — saved locally"
- Undo/redo: Ctrl+Z / Ctrl+Y (Cmd on Mac) for step operations (create, delete, reorder, edit). Command stack pattern — at least 20 undo levels.
- Estimated duration: auto-calculated based on step conditions. Time-based conditions sum directly. Repetition-based steps estimated at 2 minutes per required repetition (configurable heuristic). Score-based conditions estimated at 3 minutes per step. Total displayed on session card as "Estimated: 15-20 min."
- Estimated duration shown on assignment cards (Epic 6) and student dashboard

---

### Epic 4: Class Management & Roster (Week 9-12)

**Goal:** Teachers create classes, import rosters via CSV, invite students, manage assistants. The teacher-student organizational layer.

**Dependencies:** Epic 1 (auth, schema), Epic 2 (billing — teachers must be subscribed)

**Story Sequence:**

| # | Story | Rationale |
|---|-------|-----------|
| 4.1 | Class CRUD & student invitations | Core class infrastructure |
| 4.2 | CSV roster import | Depends on 4.1 — bulk student onboarding |
| 4.3 | Assistant teacher management | Depends on 4.1 — extends class access model |

---

**Story 4.1: Class CRUD & Student Invitations**
As a teacher, I want to create classes and invite students so that I can organize my teaching.

Acceptance Criteria:
- Create class: name, default instrument, semester association
- Generate unique invite code per class (short alphanumeric, e.g., "JAZZ-2026")
- Email invitation: teacher enters student email(s), system sends invitation with join link
- Student joins class: via invite code (entered manually) or invitation link (clicked from email)
- Student joining a class associates their relevant instrument profile with the class
- Class roster view: list of members (name, instrument, joined date), pending invitations
- Teacher removes student from class (with confirmation)
- Teacher deletes class (with confirmation — warns about losing assignment associations)
- Multiple classes per teacher, multiple classes per student

**Story 4.2: CSV Roster Import**
As a teacher, I want to import my class roster from a CSV file so that I can onboard students quickly when switching from another platform.

Acceptance Criteria:
- Upload CSV with columns: name, email (minimum). Optional: instrument.
- Preview import: show parsed rows, highlight any issues (missing email, duplicate email, already enrolled)
- On confirm: system creates invitation for each student email. Students who already have accounts are auto-added. Students without accounts receive signup invitation emails.
- Import summary: "15 students imported. 12 invitations sent. 3 already enrolled."
- CSV template download available ("Download template CSV")

**Story 4.3: Assistant Teacher Management**
As a teacher, I want to manage assistant teachers for my classes so that substitutes can help manage my students.

Acceptance Criteria:
- "Manage Assistants" section in class settings
- Invite assistant by email — must be an existing teacher account
- Assistant permissions: view roster, view results, create/assign sessions, add feedback
- Assistant restrictions: cannot delete class, remove students, revoke other assistants, change billing
- Revoke assistant access at any time
- All assistant actions logged with assistant's user ID (audit trail)
- Assistant sees the class in their own dashboard under "Assisting" section (visually distinct from their own classes)

---

### Epic 5: Session Player & Practice Loop (Week 9-12)

**Goal:** Students play through assigned sessions in browser-only mode — self-assessment, tempo control, branching, offline-capable preload. The daily student experience.

**Dependencies:** Epic 1 (auth), Epic 3 (session data model and audio assets)

**Story Sequence:**

| # | Story | Rationale |
|---|-------|-----------|
| 5.1 | Session preload & audio playback | Foundation — audio must work before anything else |
| 5.2 | Step-by-step session flow & self-assessment | Core practice loop — depends on 5.1 |
| 5.3 | Tempo control (student-adjustable) | Enhances 5.2 — student pace control |
| 5.4 | Branching execution & invisible navigation | Depends on 5.2 — runs teacher's logic |
| 5.5 | Session state persistence & offline capability | Depends on 5.2 — progress must survive interruptions |
| 5.6 | Session summary & result submission | Depends on 5.2 — end-of-session experience |

---

**Story 5.1: Session Preload & Audio Playback**
As a student, I want session audio to preload before I start practicing so that playback is never interrupted.

Acceptance Criteria:
- On "Start Session": browser fetches session manifest (steps, conditions, branching, audio URLs)
- Progressive preload: current step + next step audio downloaded first. Remaining steps download in background.
- Progress indicator: "Preparing your session... 4 of 6 tracks ready"
- Play is enabled only when current step's audio is ready
- Audio playback via Web Audio API / Tone.js: backing tracks and reference recordings play through browser audio output
- Transport controls: play, stop, seek (within current track), volume
- If preload fails (network error): retry with exponential backoff. After 3 failures, show "Unable to load session audio. Check your connection and try again."

**Story 5.2: Step-by-Step Session Flow & Self-Assessment**
As a student, I want to practice through a session step by step with self-assessment so that I can work through my teacher's assignments.

Acceptance Criteria:
- Full-screen session player: displays current step title, instructions, pass condition in plain language
- Attempt counter: "Attempt 3"
- Session progress bar: horizontal pills showing completed/current/future steps
- Self-assessment buttons: "I nailed it" (green/teal) / "Needs work" (amber) — large, friendly, touch-friendly
- Time-based conditions: countdown timer visible when active ("Practice for 3 more minutes")
- Repetition conditions: counter ("Play 2 more times")
- Score-based conditions: degrade to self-assessment with note "Install Practice Bridge Desktop for automatic scoring"
- On condition met: "Next" button activates. Student can continue practicing or advance.
- Student can skip any step (marked as "skipped")
- Student can replay any completed step
- Teacher notes surface at the right moment (before the step they're attached to)

**Story 5.3: Tempo Control (Student-Adjustable)**
As a student, I want to lower the tempo when I'm struggling so that I can practice at a comfortable pace.

Acceptance Criteria:
- Tempo slider/wheel on the session player: shows teacher's target tempo and current student-selected tempo
- Student can lower tempo below teacher's target (minimum: 40% of original)
- Student CANNOT raise tempo above teacher's target
- When self-assessment indicates "Needs work" on consecutive attempts, app gently suggests: "Try lowering the tempo?"
- Tempo change applies to audio playback in real time (time-stretch)
- Tempo selection persists across attempts within the same step
- Tempo resets to teacher's target when advancing to next step (student can lower again)

**Story 5.4: Branching Execution & Invisible Navigation**
As a student, I want the session to guide me to the right material based on my progress without showing me "you failed."

Acceptance Criteria:
- Session engine evaluates branching rules after each attempt/condition check
- On "advance" condition met: session moves to the target step (default: next step)
- On "branch" condition triggered (fail after N attempts): session moves to the alternate step
- Branching is invisible: student sees a new step appear, no indication they were diverted
- Step progress bar updates to reflect the actual path (branched steps appear as additional steps, not replacements)
- The session engine prevents infinite loops (validated in Session Builder, enforced at runtime)
- Session can always be completed — every path leads to an end state

**Story 5.5: Session State Persistence & Offline Capability**
As a student, I want my progress saved automatically so that I can resume a session after interruption.

Acceptance Criteria:
- Session state saved to server after each step completion and each attempt
- If server is unreachable: state saved to IndexedDB (offline queue)
- On reconnection: queued results synced with exponential backoff retry
- "Resume Session" option when returning to an in-progress session
- Student can abandon a session — partial progress saved and visible to teacher
- Student can reset a session and start fresh (confirmation dialog)
- Session audio continues working offline once preloaded (all audio is local after preload)
- Service worker caches app shell for offline access to the session player

**Story 5.6: Session Summary & Result Submission**
As a student, I want to see a summary after completing a session so that I can review my practice.

Acceptance Criteria:
- Session summary screen: card layout showing each step with result (completed/skipped), self-assessment response, time spent, attempts taken
- Total practice time displayed
- Branching path shown subtly (e.g., "You spent extra time on [step name]" — not "you were diverted")
- "Submit" button sends results to server
- Results include: per-step completion status, self-assessment responses, time per step, attempts per step, total duration, `practiced_at` timestamp
- Streak counter increments on session completion
- After submission: "Great practice!" encouragement. Link to dashboard.

---

### Epic 6: Assignments, Dashboard & Analytics (Week 9-14)

**Goal:** Assignment creation/tracking, teacher dashboard with bottleneck detection, student dashboard with streaks, notifications, semester lifecycle, CSV export. The feedback loop.

**Dependencies:** Epic 1 (auth), Epic 3 (sessions), Epic 4 (classes), Epic 5 (session results)

**Story Sequence:**

| # | Story | Rationale |
|---|-------|-----------|
| 6.1 | Assignment creation & tracking | Core — connects sessions to students |
| 6.2 | Student dashboard | Depends on 6.1 — students need to see assignments |
| 6.3 | Practice streaks & reminders | Depends on 6.2 — engagement layer |
| 6.4 | Teacher dashboard & analytics | Depends on 6.1 + Epic 5 results — teacher reviews data |
| 6.5 | Teacher feedback | Depends on 6.4 — teacher responds to results |
| 6.6 | Notification system | Depends on 6.1-6.5 — delivers events to users |
| 6.7 | Semester lifecycle | Depends on 6.4 — organizational layer for teacher |
| 6.8 | CSV export | Depends on 6.4 — institutional requirement |

---

**Story 6.1: Assignment Creation & Tracking**
As a teacher, I want to assign sessions to my classes with due dates so that students know what to practice each week.

Acceptance Criteria:
- Assign a session to one or multiple classes in one flow, each with its own due date and optional notes
- Assignment appears on each student's dashboard immediately
- Assignment status per student: not started, in progress, completed, overdue
- Student can retry a completed assignment before due date — each attempt tracked
- Teacher sees assignment status across all students in their dashboard
- Immutable session snapshot: assignment references a frozen copy of the session. Teacher edits to the session don't change existing assignments.

**Story 6.2: Student Dashboard**
As a student, I want a dashboard showing my weekly practice plan so that I know what to practice.

Acceptance Criteria:
- Hero section: this week's assignments from ALL enrolled classes, grouped by class, sorted by due date
- Each assignment card: session title, class name, due date, status, estimated duration, "Start Session" CTA
- Past-due assignments flagged with amber indicator (not aggressive red)
- Below assignments: practice history — scrollable list of past sessions with results. Each past session re-playable (practice again, unscored).
- Instrument profile switcher in top nav filters dashboard to active instrument's classes
- Empty state: "No assignments this week. Browse the Exercise Library to practice on your own."

**Story 6.3: Practice Streaks & Reminders**
As a student, I want to track my practice streak so that I stay motivated, and receive gentle reminders when I haven't practiced.

Acceptance Criteria:
- Streak counter on dashboard: current streak (days), longest streak, total sessions, total minutes
- Streak increments when student completes (or partially completes) at least one session or exercise in a day
- Streak display is encouraging, not pressuring — subtle flame icon, not countdown timer
- Practice reminders: daily notification (via user's configured channels) if student has active assignments and hasn't practiced today
- Reminder tone: "Today's practice session is waiting for you — tap to start" (not "You're going to lose your streak!")
- Reminder timing: configurable (default: 5 PM local time). Can be disabled entirely.
- Streak freeze: not in MVP (post-MVP consideration)

**Story 6.4: Teacher Dashboard & Analytics**
As a teacher, I want to see how my students are doing across all my classes so that I can identify who needs help and what material is too hard.

Acceptance Criteria:
- Class selector → student list → session results drill-down
- Per-student view: sessions completed, steps completed/skipped, branching paths taken, self-assessment responses, time per step, total practice time
- Class-wide view: completion rates per assignment, common bottleneck steps highlighted as callout cards ("68% of students branched at Step 3")
- Suspicious completion flags: subtle clock icon when total practice time is significantly below estimated duration. Informational, not punitive.
- Practice time distribution: chart showing when students practice (days of week, time of day)
- Assignment overview: all assignments with completion percentages
- Date range filter (this week, this month, this semester)

**Story 6.5: Teacher Feedback**
As a teacher, I want to send feedback to students about their practice so that they know what to improve.

Acceptance Criteria:
- Feedback composer: text field per student per assignment in the teacher dashboard
- Teacher types feedback, clicks Send. Student receives notification.
- Feedback visible to student on their assignment detail page and in notification
- Feedback history: all feedback for a student visible in chronological order
- Teacher can edit or delete sent feedback

**Story 6.6: Notification System**
As a user, I want to receive notifications about assignments, feedback, and reminders through my preferred channels.

Acceptance Criteria:
- In-app notifications: always on, bell icon with unread count, dropdown showing recent notifications
- Email notifications (opt-in): new assignments, teacher feedback, due date reminders (1 day before), practice reminders
- Push notifications (opt-in, browser push): same events as email
- Notification preferences in Settings: toggle each channel on/off per event type
- Email content: summary only, no sensitive details. "New feedback from Ms. Vasquez on Autumn Leaves Bridge" — feedback text visible only in-app.
- Notification delivery: Practice Bridge handles directly for its own users. Webhook event for tenant integration (future).

**Story 6.7: Semester Lifecycle**
As a teacher, I want to organize my work into semesters so that I can archive old data and start fresh each term.

Acceptance Criteria:
- Teacher creates a semester: name (e.g., "Fall 2026"), start date, optional end date
- One active semester at a time per teacher
- Classes are associated with the active semester
- Close semester: all sessions, assignments, results, and feedback archived. Teacher and student can still view archived data.
- Templates persist across semesters (not archived)
- Open new semester: teacher can create new classes or carry forward existing classes
- Teacher dashboard defaults to active semester with toggle to view past semesters
- Student history spans all semesters — always accessible

**Story 6.8: CSV Export**
As a teacher, I want to export student results as CSV so that I can share data with school administrators or keep records.

Acceptance Criteria:
- "Export CSV" button on teacher dashboard (class view and assignment view)
- CSV columns: student name, email, session title, steps completed, steps skipped, total practice time, average self-assessment, assignment status, date completed
- Export scoped to current view (selected class, selected assignment, or selected date range)
- Downloaded as `.csv` file to teacher's device

---

### Epic 7: Exercise Library & Self-Learner Access (Week 9-14)

**Goal:** Browsable exercise library, self-learners can build their own sessions. Content foundation.

**Dependencies:** Epic 1 (auth, schema), Epic 3 (Session Builder)

**Story Sequence:**

| # | Story | Rationale |
|---|-------|-----------|
| 7.1 | Exercise library & browsing | Content must exist before it can be used |
| 7.2 | Self-learner session building | Depends on 7.1 + Epic 3 — self-learners use library + builder |

---

**Story 7.1: Exercise Library & Browsing**
As a user, I want to browse a library of exercises by instrument, difficulty, and category so that I can find material to practice.

Acceptance Criteria:
- Exercise library page: browsable, searchable, filterable
- Filters: instrument, difficulty (beginner/intermediate/advanced), category (scales, arpeggios, technique, repertoire, etc.)
- Each exercise card: title, instrument, difficulty, category, estimated duration
- Exercise detail page: description, audio preview, "Start Practice" button
- Teachers can use library exercises as starting points for session steps (link to Session Builder)
- Platform-owned exercises seeded at launch (initial content — scope TBD by content team)
- Exercise data model: title, description, instrument, difficulty, category, audio assets (MIDI, backing track), metadata

**Story 7.2: Self-Learner Session Building**
As a self-learner, I want to build my own practice sessions from library exercises so that I can structure my weekly practice.

Acceptance Criteria:
- Self-learners (students without a teacher/class) can access the Session Builder
- Session Builder works identically for self-learners and teachers — same features (steps, conditions, branching, templates, audio upload/recording)
- Self-learner assigns sessions to themselves (no class required)
- Self-built sessions appear on the student dashboard as "My Sessions" alongside any teacher assignments
- Self-learners can save templates for reuse
- Self-learners can browse the library and add exercises directly as session steps

---

### Epic 8: AI Session Builder (Week 14-20, Track A)

**Goal:** Teachers describe sessions in plain language, AI generates session structure via n8n + LLM. Eliminates the Session Builder learning curve.

**Dependencies:** Epic 3 (Session Builder API — AI produces the same data structure)

**Story Sequence:**

| # | Story | Rationale |
|---|-------|-----------|
| 8.1 | n8n workflow & LLM integration | Infrastructure — pipeline must exist before UI |
| 8.2 | Natural language input & session generation | Core feature — depends on 8.1 |
| 8.3 | AI session review & refinement | Depends on 8.2 — teacher reviews/iterates |
| 8.4 | AI session audit trail | Depends on 8.2 — tracks what AI generated |

---

**Story 8.1: n8n Workflow & LLM Integration**
As a developer, I want the n8n orchestration pipeline configured to translate natural language into session structures so that the AI builder has a reliable backend.

Acceptance Criteria:
- n8n instance deployed (self-hosted or cloud)
- Workflow: webhook trigger → LLM call (Claude/GPT-4) → structured JSON response → validation → return to caller
- LLM prompt template: includes instrument context, scoring modes, condition types, and session structure schema
- Input: teacher's natural language description + instrument + student context
- Output: valid session JSON (steps, conditions, branching, tempo percentages, scoring modes)
- Error handling: LLM timeout, malformed response, validation failure — all return actionable errors
- `ai_session_drafts` table populated with prompt, response, and model used

**Story 8.2: Natural Language Input & Session Generation**
As a teacher, I want to describe a practice session in plain language and have the AI build it for me so that I don't need to learn the Session Builder UI.

Acceptance Criteria:
- Text input field on the AI Builder page: teacher types description in natural language
- "Generate Session" button triggers n8n workflow
- Loading state: "Building your session..." (2-5 seconds typical)
- Generated session displayed in the same step-list format as the manual Session Builder
- Teacher can see all generated steps, conditions, branching, and estimated duration
- If the AI misinterprets: teacher can type follow-up refinement (see Story 8.3)

**Story 8.3: AI Session Review & Refinement**
As a teacher, I want to review the AI-generated session and refine it with follow-up instructions or manual edits so that the final session matches my intent.

Acceptance Criteria:
- Generated session is fully editable — all manual Session Builder features available (edit steps, conditions, branching, audio, etc.)
- "Refine" button: teacher types follow-up instruction ("Make Step 3 harder" or "Add a warm-up step"), AI regenerates with context
- Conversation history maintained within the session — AI remembers previous instructions
- "Approve" button: converts AI draft into a real session (linked to `ai_session_drafts`)
- Approved session is indistinguishable from a manually-built session — same data model, same player

**Story 8.4: AI Session Audit Trail**
As a platform operator, I want to track AI-generated sessions so that we can monitor quality and improve the AI over time.

Acceptance Criteria:
- `ai_session_drafts` table records: teacher ID, prompt text, generated JSON, LLM model used, approved/rejected, linked session ID if approved
- Dashboard query (future): "What percentage of AI-generated sessions are approved without edits?"
- No personally identifiable student data in the AI prompt — only instrument, level, and session structure context

---

### Epic 9: Live Lesson Mode (Week 14-20, Track A)

**Goal:** Capture lessons as they happen — record button, tempo wheel, Whisper transcription, click track removal, end-of-lesson review. Sessions build themselves.

**Dependencies:** Epic 3 (Session Builder recording API — Live Lesson Mode is a UI layer on top), Epic 8 (n8n pipeline — shared infrastructure)

**Story Sequence:**

| # | Story | Rationale |
|---|-------|-----------|
| 9.1 | Live Lesson capture UI (record button + tempo wheel + step list) | Core UI must exist first |
| 9.2 | Audio capture pipeline (bounded windows, pre/take/post) | Recording engine — depends on 9.1 |
| 9.3 | Click track removal (AEC pipeline) | Clean teacher recordings — depends on 9.2 |
| 9.4 | Voice transcription (Whisper) | Instruction text from speech — depends on 9.2 |
| 9.5 | Domain evaluator & session quality score | AI classification — depends on 9.4 |
| 9.6 | End-of-lesson review & assign | Final teacher review — depends on all above |

---

**Story 9.1: Live Lesson Capture UI**
As a teacher, I want a minimal, one-handed UI for capturing lesson content so that I can record while teaching without interrupting the lesson.

Acceptance Criteria:
- Full-screen Live Lesson mode — distinct from the Session Builder
- Top half: large red Record button + tempo wheel (scrollable, sets target BPM, click track plays immediately on scroll)
- Bottom half: captured steps as cards in a running list (waveform thumbnail, duration, domain tag)
- One-tap to start/stop recording. 4-beat countdown before recording begins.
- No editing during lesson — all editing happens in end-of-lesson review
- Designed for phone/tablet: one-handed, partial-attention, large touch targets
- One-time consent screen on first activation (privacy disclosure per practice-bridge-live-lesson.md Section 8)

**Story 9.2: Audio Capture Pipeline**
As a teacher, I want the platform to capture three audio windows per step (instruction, performance, commentary) so that the session builds automatically from what I say and play.

Acceptance Criteria:
- Three bounded audio windows per record tap:
  - Pre-take: teacher speaking before playing → becomes instruction text (via Whisper)
  - Take: teacher performing → becomes reference recording (click track removed)
  - Post-take: teacher commenting after → becomes teacher note (via Whisper)
- Windows defined by record tap timestamps — no continuous ambient recording
- Audio stored locally during lesson, uploaded in background after capture
- Step queued for async processing (n8n pipeline) immediately after capture
- Teacher continues teaching without waiting for processing

**Story 9.3: Click Track Removal (AEC Pipeline)**
As a teacher, I want the click track automatically removed from my recordings so that students hear only my performance.

Acceptance Criteria:
- Three-tier AEC pipeline per practice-bridge-technical.md Section 10b:
  - Tier 1: On-device platform AEC (real-time during recording)
  - Tier 2: Server-side adaptive filter + spectral subtraction (async post-upload)
  - Tier 3: ML source separation for edge cases (if Tier 2 quality below threshold)
- Click track never stored as audio — always regenerated from metadata (tempo, time signature, click sound)
- Students get independent click control (sound, volume, tempo)
- Quality score per recording: stored alongside cleaned audio
- Teacher is unaware of this processing — it's invisible

**Story 9.4: Voice Transcription (Whisper)**
As a teacher, I want my spoken instructions automatically transcribed so that session steps have text instructions without me typing.

Acceptance Criteria:
- Pre-take and post-take audio transcribed via Whisper (local by default — Whisper.cpp/whisper-rs on Desktop)
- Fallback: opt-in Whisper API for underpowered hardware (bounded audio segment, deleted after transcription)
- Transcription accuracy: music education vocabulary handled well (legato, pizzicato, rubato, etc.)
- Transcribed text editable in end-of-lesson review
- Raw pre/post-take audio discarded after transcription — only text survives on server

**Story 9.5: Domain Evaluator & Session Quality Score**
As a teacher, I want the platform to show which practice domains my session covers so that I can ensure balanced instruction.

Acceptance Criteria:
- AI node (n8n + LLM) evaluates structured session steps for domain coverage
- Default 8-domain taxonomy: Technique, Tone, Timing/Rhythm, Ear Training, Expression/Dynamics, Sight Reading, Theory, Repertoire
- Domain tags per step (auto-assigned, editable by teacher)
- Session Quality Score as visual coverage bar in end-of-lesson review — not a grade, purely informational
- Insight: "This session focuses on Technique. Ear Training hasn't appeared in this student's sessions for 3 weeks."
- Low-confidence classifications shown as "Unclassified" rather than wrong tags

**Story 9.6: End-of-Lesson Review & Assign**
As a teacher, I want to quickly review and assign a captured session at the end of a lesson so that the student's practice plan is ready before they leave.

Acceptance Criteria:
- Review screen shows all captured steps: waveform thumbnail, transcribed instruction text, teacher note, domain tag
- Drag to reorder steps, delete steps, edit transcribed text inline
- Add text-only steps manually (e.g., theory reminder without recording)
- Domain coverage bar visible
- "Assign" button: one tap assigns to current student. Session immediately visible on student's dashboard.
- Review designed to take 60-90 seconds maximum
- Output is identical to a manually-built session — same data model, same player, same scoring

---

### Epic 10: Practice Bridge Desktop v1 (Week 14-20, Track B)

**Goal:** Tauri tray icon app — audio capture, pYIN pitch detection, tuner, note event streaming via PB-Audio v1 WebSocket. Live scoring in browser.

**Dependencies:** Epic 1 (WebSocket protocol spec defined), Epic 5 (browser-side scoring UI)

**Story Sequence:**

| # | Story | Rationale |
|---|-------|-----------|
| 10.1 | Tauri app shell & system tray | Foundation — app must exist |
| 10.2 | Audio input capture (CPAL) | Core capability — depends on 10.1 |
| 10.3 | pYIN pitch detection & note event streaming | Core capability — depends on 10.2 |
| 10.4 | WebSocket server (PB-Audio v1) | Communication — depends on 10.3 |
| 10.5 | Browser integration (connection, scoring UI, tuner) | End-to-end — depends on 10.4 |
| 10.6 | Deep link handler & auto-launch | UX polish — depends on 10.1 |

---

**Story 10.1: Tauri App Shell & System Tray**
As a student, I want Practice Bridge Desktop to run as a system tray icon so that it's always available without cluttering my screen.

Acceptance Criteria:
- Tauri 2.x application for macOS and Windows
- System tray icon (menubar on macOS, notification area on Windows)
- Small popover panel (~300x200px): connection status, input level meter, settings gear
- No main window — Practice Bridge Desktop has no GUI beyond the tray popover
- Auto-launch on login (opt-in, configurable in settings)
- Auto-update via Tauri's built-in updater (never interrupts active sessions)

**Story 10.2: Audio Input Capture (CPAL)**
As a student, I want Practice Bridge Desktop to capture audio from my instrument so that the platform can analyze my playing.

Acceptance Criteria:
- Audio input capture via CPAL from default system audio input device
- Support: CoreAudio (macOS), WASAPI (Windows), ASIO (Windows — if available)
- Windows latency tiering: ASIO (4-6ms) → WASAPI Exclusive (10-20ms) → WASAPI Shared (20-40ms)
- Input level streaming to browser (30fps): RMS and peak values
- Audio callback runs at audio-thread priority — no glitches under normal system load

**Story 10.3: pYIN Pitch Detection & Note Event Streaming**
As a student, I want Practice Bridge Desktop to detect the notes I play in real time so that the browser can score my performance.

Acceptance Criteria:
- pYIN pitch detection via `pyin-rs` — direct Rust DSP, no external dependencies
- Frequency range configurable via `instrumentProfile` message (default: bass 41-400Hz)
- Note onset detection and offset detection
- Dynamics analysis (velocity per note)
- Note events streamed as structured JSON: `{type: "note", pitch: "E2", onset: 1.234, offset: 1.567, velocity: 0.8}`
- Tuner data streamed at 30fps: `{type: "tuner", note: "E2", cents: -3.2, freq: 82.1}`
- Detection latency < 10ms from note onset to event emission

**Story 10.4: WebSocket Server (PB-Audio v1)**
As a browser client, I want to connect to Practice Bridge Desktop via localhost WebSocket so that I can receive note events and tuner data.

Acceptance Criteria:
- WebSocket server on `ws://localhost:9876` via tokio-tungstenite
- PB-Audio v1 handshake: `{type: "handshake", protocolVersion: 1, capabilities: ["scoring", "tuner"]}`
- Single connection constraint: only one browser tab can hold the active connection
- Second tab receives `{type: "error", code: "ALREADY_CONNECTED"}` with option to force-disconnect
- `instrumentProfile` message support: browser configures pitch detection range and parameters
- Platform-agnostic: no Bassicology-specific message types

**Story 10.5: Browser Integration (Connection, Scoring UI, Tuner)**
As a student, I want the browser to show live scoring and tuner data when Practice Bridge Desktop is connected so that I get real-time feedback on my playing.

Acceptance Criteria:
- Browser auto-detects Desktop via WebSocket connection attempt on page load
- Connection indicator: green "Practice Bridge connected — live scoring enabled" or "Practice Bridge not detected — using self-assessment"
- Live scoring: browser receives note events, compares against exercise/session reference, displays real-time accuracy feedback
- Scoring modes: Metered (DTW timing + pitch) and Expressive (note accuracy + dynamics + completeness)
- Tuner display: chromatic tuner visualization consuming pitch/cents data stream
- Graceful degradation: all features work without Desktop (self-assessment replaces scoring)
- Capabilities check: browser reads `capabilities` array from handshake and enables/disables features accordingly

**Story 10.6: Deep Link Handler & Auto-Launch**
As a student, I want to launch Practice Bridge Desktop from the browser so that I don't need to manually start it.

Acceptance Criteria:
- Custom URI scheme: `practicebridge://` registered via Tauri deep-link plugin
- Browser shows "Launch Practice Bridge" button that triggers `practicebridge://connect`
- Desktop launches (or focuses if already running) and establishes WebSocket connection
- Exercise-specific deep link: `practicebridge://exercise/abc123` — launches and loads specific exercise

---

### Epic 11: Stem Removal & Full Desktop (Week 20-26, Track B)

**Goal:** ONNX inference, Jam-Along mode, audio mixer, backing track playback, BPM/key detection, AcoustID, browser extension tab capture.

**Dependencies:** Epic 10 (Desktop v1 — base app and WebSocket protocol)

**Story Sequence:**

| # | Story | Rationale |
|---|-------|-----------|
| 11.1 | Audio mixer & backing track playback (CPAL output) | Foundation — Desktop needs audio output before stem removal |
| 11.2 | ONNX stem removal engine | Core capability — depends on 11.1 for playback |
| 11.3 | Jam-Along mode (file + browser extension) | User-facing feature — depends on 11.2 |
| 11.4 | BPM/key detection & AcoustID | Analysis features — independent of 11.2 |
| 11.5 | Leaderboards (hash-based, privacy-preserving) | Depends on 11.3 + 11.4 — requires song hash |
| 11.6 | Browser extension (tab audio capture) | Alternative input for Jam-Along — depends on 11.3 |

---

*Note: Epics 11-13 are post-MVP (Week 20-38). Stories are written at a higher level with references to technical specification documents. The Architect needs the shape, not every implementation detail at this stage.*

**Story 11.1: Audio Mixer & Backing Track Playback**
Audio mixer (instrument + backing → headphones via CPAL), transport commands from browser, 4-6ms latency monitoring.

**Story 11.2: ONNX Stem Removal Engine**
ONNX Runtime inference, segmented streaming pipeline, instrument-removed mix, progressive purge, no isolated stems exposed. Confidence scoring per segment.

**Story 11.3: Jam-Along Mode**
Jam-Along file mode (native file picker, zero-wait playback, stem removal when ready) and streaming mode (two-phase passthrough → crossfade). Stem level control slider.

**Story 11.4: BPM/Key Detection & AcoustID**
BPM detection, key detection, beat grid locking, AcoustID fingerprinting (opt-in), song metadata display (local only, never sent to server).

**Story 11.5: Leaderboards (Hash-Based, Privacy-Preserving)**
Hash-based leaderboards per practice-bridge-technical.md Section 11.3. Server stores opaque `songHash` only. Song names resolved client-side. Exercise leaderboards (zero copyright risk) + Jam-Along leaderboards (hash-based).

**Story 11.6: Browser Extension (Tab Audio Capture)**
Chrome Manifest V3 extension, `tabCapture` API, PCM streaming to Desktop via WebSocket. One-tab capture only, explicit user permission.

---

### Epic 12: Practice Bridge Mobile — iOS First (Week 22-30, Track B)

**Goal:** Native companion app — phone mic pitch detection (shared Rust audio engine via FFI), session audio to headphones, MediaPipe hand tracking, WiFi streaming to browser. iOS first, Android follows.

**Dependencies:** Epic 10 (shared Rust audio engine — pyin-rs), Epic 5 (browser-side scoring UI)

**Story Sequence:**

| # | Story | Rationale |
|---|-------|-----------|
| 12.1 | Mobile app shell & WiFi communication | Foundation — app must exist and communicate |
| 12.2 | Audio output (session audio → headphones) | Core — student needs to hear session |
| 12.3 | Audio input (phone mic → pitch detection → note events) | Core — scoring from phone mic |
| 12.4 | AEC for Live Lesson Mode (click track removal on mobile) | Extends Live Lesson Mode to mobile capture |
| 12.5 | Computer vision (MediaPipe hand tracking) | Enhanced feature — hand position data |
| 12.6 | Browser integration (mobile connection, wider tolerances) | End-to-end — browser receives mobile data |

---

*Technology choice (Flutter, Swift/Kotlin, React Native) is an Architect decision. Each story covers iOS implementation with Android follow-up noted.*

**Story 12.1: Mobile App Shell & WiFi Communication**
App shell, WiFi WebSocket client to browser, latency calibration at session start.

**Story 12.2: Audio Output (Session Audio to Headphones)**
Session audio playback to phone headphones. Phone replaces Desktop's headphone mix for students without audio interfaces.

**Story 12.3: Audio Input (Phone Mic Pitch Detection)**
Phone mic capture, pYIN pitch detection via FFI to shared Rust engine (pyin-rs), onset detection, note event streaming to browser via WiFi. Wider scoring tolerances to account for phone mic quality.

**Story 12.4: AEC for Live Lesson Mode (Mobile)**
Platform AEC integration — iOS Voice Processing IO, Android AcousticEchoCanceler + WebRTC AEC3 fallback. Click track removal for teacher recordings captured on mobile.

**Story 12.5: Computer Vision (MediaPipe Hand Tracking)**
MediaPipe Hands on-device, two-point calibration, coarse hand position extraction. ~20 bytes per update, 10 updates/second. Raw video never leaves device.

**Story 12.6: Browser Integration (Mobile Connection)**
Browser detects mobile connection, adjusts scoring tolerances, shows hand position overlay on fretboard visualization.

---

### Epic 13: Developer Portal, Institutional & Offline (Week 30-38, Track A)

**Goal:** Self-service developer portal for tenant onboarding, institutional features (school admin, bulk onboarding, LMS integration), offline SQLite + Desktop sync, and CLI/headless mode. Practice Bridge is already standalone — this epic adds enterprise and developer tooling.

**Dependencies:** Epic 1 (tenant API foundation), Epic 10 (Desktop — for offline), all MVP epics

**Story Sequence:**

| # | Story | Rationale |
|---|-------|-----------|
| 13.1 | Developer portal & self-service tenant onboarding | Foundation — new tenants need self-service |
| 13.2 | Tenant webhook configuration & event system | Depends on 13.1 — tenants need event notifications |
| 13.3 | Tenant analytics dashboard | Depends on 13.1 — tenants need visibility into their users |
| 13.4 | Institutional features (school admin, bulk onboarding, LMS) | Extends platform for enterprise |
| 13.5 | Offline SQLite & Desktop sync | Independent — Desktop feature |
| 13.6 | CLI / headless mode | Independent — power user feature |

---

**Story 13.1: Developer Portal & Self-Service Tenant Onboarding**
Self-service developer portal on practicebridge.ai: tenant registration, API key management, integration guides, interactive API documentation, sandbox environment. New tenants can onboard without manual intervention.

**Story 13.2: Tenant Webhook Configuration & Event System**
Tenants configure webhook URLs to receive events (assignment completed, feedback posted, streak updated, etc.). Event payload documentation. Retry and failure handling per tenant.

**Story 13.3: Tenant Analytics Dashboard**
Tenant-facing analytics: user counts, active students, session completion rates, retention metrics — scoped to the tenant's users. Available in the developer portal.

**Story 13.4: Institutional Features**
School admin dashboard, bulk student onboarding (CSV + API), grade export to LMS formats (Canvas, Blackboard, Google Classroom), volume pricing, institutional reporting.

**Story 13.5: Offline SQLite & Desktop Sync**
SQLite local storage on Desktop for offline practice results, cached sessions. Sync to server on reconnection.

**Story 13.6: CLI / Headless Mode**
CLI entry point via clap — `practice-bridge analyze`, `practice-bridge tune`, `practice-bridge score`. No audio output to disk (legal constraint).

---

## Key Reference Documents

| Document | Contents |
|----------|----------|
| [practice-bridge-product.md](../practice-bridge-product.md) | Full product specification (Sections 1-6) |
| [practice-bridge-technical.md](../practice-bridge-technical.md) | Technical specification (Sections 7-16) |
| [practice-bridge-business.md](../practice-bridge-business.md) | Business, strategy, legal (Sections 17-20 + Appendix A) |
| [practice-bridge-live-lesson.md](../practice-bridge-live-lesson.md) | Live Lesson Mode specification |
| [practice-bridge-condensed.md](../practice-bridge-condensed.md) | Single-page overview |

---

## Out of Scope (Post-MVP / Post-v1)

- Guided self-learner paths and goal-setting (teacher-student first)
- Parent-facing view (read-only practice summary)
- Teacher-to-teacher communication on shared students
- Full screen reader support for 3D fretboard (Bassicology-specific)
- Voice control and captions for video content
- Multi-language UI (architecture ready, implementation post-MVP)
- Advanced Jam-Along leaderboards (requires Desktop — Week 20+)
- Computer vision technique-specific detection (Phase 3, Year 2+)
- Audio-to-notation transcription
- Full stem separation (legal-dependent)
- Ensemble scoring
- AI-suggested branching based on class-wide patterns

---

## Change Log

| Change | Date | Version | Description | Author |
|--------|------|---------|-------------|--------|
| Initial PRD | 2026-02-21 | 1.0 | Complete PRD through Epic 1 stories | PM (John) + Product Owner |
| All Epic stories | 2026-02-21 | 1.1 | Added detailed stories for Epics 2-13 (57 stories total) | PM (John) + Product Owner |
| Checklist assessment | 2026-02-21 | 1.2 | PM Checklist (103 items) assessed — READY FOR ARCHITECT | PM (John) |
| **Architecture correction** | **2026-02-21** | **2.0** | **Major revision: Practice Bridge is standalone from day 1 (own repo, DB, deployment). Bassicology is first tenant via S2S API, not the host codebase. Removed Bassicology-first strategy. Epic 1 now includes Tenant API (Story 1.3b). Epic 13 rewritten from "extraction" to "developer portal + institutional." All sections updated to reflect platform-first architecture.** | **PM (John) + Product Owner** |
| Bassicology integration | 2026-02-21 | 2.1 | Added Appendix A: Bassicology Integration Story — 4 stories (B.1-B.4) covering tenant-side work with concrete file paths, adapter pattern, account sync, exercise submission, and billing coordination. Integration sequence timeline included. | PM (John) + Product Owner |
| Real-time data flow + Bassicology Phase 2 | 2026-02-21 | 2.2 | Added Section 5.5 "Real-Time Data Flow During Practice" with full diagrams showing localhost-only architecture during practice. Established that Bassicology requires Full Desktop (Phase 2, Epic 11 mixer) — browser-only mode not sufficient. Bassicology ships ~Week 24-26, not Week 12-14. Updated Appendix A timeline. | PM (John) + Product Owner |

---

----- END PRD START CHECKLIST OUTPUT ------

## Checklist Results Report

### Category Statuses

| Category | Status | Notes |
|----------|--------|-------|
| 1. Problem Definition & Context | PASS | Clear problem, differentiation, market context. Minor: specific engagement KPIs deferred to post-launch. |
| 2. MVP Scope Definition | PASS | Clean MVP/post-MVP separation. Minor: formal validation methodology deferred (appropriate pre-production). |
| 3. User Experience Requirements | PASS | Comprehensive UX coverage — flows, accessibility, responsive design, emotional register. |
| 4. Functional Requirements | PASS | 55 FRs, all testable and user-focused. Minor: CLI testability not consistently explicit in backend ACs. |
| 5. Non-Functional Requirements | PASS | Full coverage — performance, security, compliance, reliability, a11y, i18n, testing, observability. |
| 6. Epic & Story Structure | PASS | 13 epics, 57 stories, sequence tables with rationale, dependencies documented. |
| 7. Technical Guidance | PASS | Architecture direction, constraints, trade-offs, Architect Prompt all comprehensive. |
| 8. Cross-Functional Requirements | PASS | Data model, integrations, environments, monitoring all covered. Minor: formal support SLA deferred. |
| 9. Clarity & Communication | PASS | Consistent terminology, structured sections, versioned, stakeholder prompts included. |

### Items Assessed: 103 | Passed: 97 | Partial: 4 | N/A: 2

*Note: Checklist originally assessed on v1.2. Re-assessed after v2.0 architecture correction (standalone platform). All previously passing items still pass. Partial items updated below.*

### Partial Items (Minor Gaps — Not Blocking)

1. **KPIs (1.2.2, 1.2.3):** Specific user engagement KPIs (DAU, retention rate, conversion rate) not defined. Acceptable for pre-production — these should be established with analytics tooling post-launch.

2. **User research (1.3.3):** PRD is based on product vision documents and founder domain expertise, not formal user research. Acceptable given pre-production status. Bassicology as first tenant provides built-in user validation channel.

3. **MVP validation methodology (2.3.1, 2.3.2, 2.3.4):** Revenue generation is the primary validation metric. A formal user feedback collection mechanism (in-app surveys, NPS, support channel) is not specified. Recommend adding a lightweight feedback mechanism in a future story.

4. **CLI testability (4.3.6):** Backend stories specify API endpoints but don't consistently include explicit CLI testability acceptance criteria. The Architect/Scrum Master should add these during story grooming.

### Architecture Correction Impact (v2.0)

The v2.0 revision fundamentally changed Practice Bridge from "built inside Bassicology, extracted later" to "standalone platform from day one." This affected:
- Section 1: Business goals, MVP scope, platform strategy (reframed)
- Section 3: NFR-2.2 (multi-tenant), NFR-12.x (future-proofing — no extraction needed)
- Section 4.6: Branding (PB branding from day one)
- Section 5: Repository architecture (own repo, not Bassicology monorepo), tech stack (independent), deployment (own infra)
- Epic 1: Added Story 1.3b (Tenant S2S API), rewrote Story 1.1 (standalone scaffolding), Story 1.2 (own DB)
- Epic 13: Rewritten from "extraction" to "developer portal + institutional + offline"
- Timeline: No extraction track. Tenant API ships in Week 1-4.
- Architect Prompt: Rewritten for standalone platform

All functional requirements (Sections 2-4, Epics 2-12) remain substantively unchanged — the features are the same, only the platform architecture differs.

### Final Decision

**READY FOR ARCHITECT.** The PRD is comprehensive, properly structured, and provides sufficient detail for architectural design across all 13 epics and the full Week 1-42 timeline. Practice Bridge is a standalone platform from day one with Bassicology as the first tenant via S2S API. The Architect has clear guidance on constraints, trade-offs, and decisions left to their domain (session snapshot mechanism, mobile technology choice, WebSocket protocol details, tenant API design).

----- END Checklist START Design Architect `UI/UX Specification Mode` Prompt ------

## Prompt for Design Architect (UI/UX Specification Mode)

**Objective:** Elaborate on the UI/UX aspects of the product defined in this PRD.
**Mode:** UI/UX Specification Mode
**Input:** This completed PRD document.
**Key Tasks:**

1. Review the product goals, user stories, and any UI-related notes herein.
2. Collaboratively define detailed user flows, wire-frames (conceptual), and key screen mockups/descriptions.
3. Specify usability requirements and accessibility considerations.
4. Populate or create the `front-end-spec-tmpl` document.
5. Ensure that this PRD is updated or clearly references the detailed UI/UX specifications derived from your work, so that it provides a comprehensive foundation for subsequent architecture and development phases.

Please guide the user through this process to enrich the PRD with detailed UI/UX specifications.

----- END Design Architect `UI/UX Specification Mode` Prompt START Architect Prompt ------

## Initial Architect Prompt

Based on our discussions and requirements analysis for Practice Bridge, I've compiled the following technical guidance to inform your architecture analysis and decisions to kick off Architecture Creation Mode:

### Technical Infrastructure

- **Repository & Service Architecture Decision:** Standalone monorepo (Nx + pnpm workspaces) with modular monolith — Next.js 15 frontend and NestJS 11 + Fastify backend as separate apps within Practice Bridge's own repo. This is a new project, not inside any tenant's codebase. Tenants integrate via REST API (S2S).
- **Starter Project/Template:** New project. The Bassicology codebase provides useful architectural patterns to reference (Zustand, TanStack Query, Supabase Auth, shadcn/ui, NestJS + Fastify, PM2), but Practice Bridge must be built independently in its own repository.
- **Hosting/Cloud Provider:** Vercel (frontend — practicebridge.ai), Railway (backend), Supabase (database + auth + storage + CDN) — all independent from any tenant's infrastructure
- **Frontend Platform:** Next.js 15 (App Router), React 19, TypeScript 5.7, Tailwind CSS 3.4, shadcn/ui, Radix UI
- **Backend Platform:** NestJS 11 + Fastify, TypeScript 5.7, CQRS pattern
- **Database Requirements:** Supabase (PostgreSQL) with Row-Level Security. Practice Bridge's own database — not shared with any tenant. Multi-tenant from day one (`tenant_id` on all tables). Immutable session snapshots for assignments. Semester-scoped data.

### Technical Constraints

- Fastify, not Express — all middleware and plugins follow Fastify patterns
- ESM imports — relative imports require `.js` extension, alias imports do not
- pnpm only — never npm or yarn
- PM2 for local development — not `pnpm dev`
- No browser microphone input — deliberate product decision
- No server-side audio processing — server handles only metadata. Exception: teacher recordings uploaded as session assets and async audio transcoding pipeline.
- Supabase RLS enforced at database level — defense in depth with API validation as secondary
- WebSocket protocol (PB-Audio v1) must be additive and platform-agnostic from day one
- Independent infrastructure — Practice Bridge does not share database, hosting, or deployment with any tenant. All tenant communication is via REST API with S2S authentication.
- Tenant S2S API ships in Epic 1 — Bassicology integrates from day one, not at extraction

### Deployment Considerations

- CI/CD: automated tests on every PR, deploy on merge to main
- Zero-downtime deployments
- Three environments: local (PM2), staging (Vercel preview + Railway staging + Supabase staging), production
- Preview deployments per PR on Vercel
- practicebridge.ai domain configured from the start

### Local Development & Testing Requirements

- PM2 ecosystem config for frontend (:3001) and backend (:3000)
- Vitest for unit and integration tests, Playwright for e2e
- Supabase local instance for development
- 70% coverage target for backend business logic, 50% for frontend components
- Manual testing checklist for audio playback across browsers
- S2S API integration tests: simulate tenant calls with platform API keys

### Other Technical Considerations

- **Security:** OWASP Top 10 compliance, signed URLs for audio assets, rate limiting (per user and per tenant), GDPR/COPPA/CCPA compliance
- **Scalability:** 1,000 concurrent users at MVP launch, stateless API for horizontal scaling, CDN for audio assets
- **Offline capability:** Session player must work offline once preloaded (IndexedDB for queued results, service worker for app shell). Full offline mode (SQLite) at Week 30+.
- **Audio pipeline:** Accept multiple formats on upload, async transcode to MP3 192kbps, progressive preload (current + next step), storage quotas per tier
- **i18n:** Externalized strings from day one, locale-aware formatting, English only at MVP
- **Accessibility:** WCAG 2.1 AA for core flows
- **Multi-tenant from day one:** Practice Bridge is its own platform. `tenant_id` on all tables, REST API serves both direct users and tenants, S2S authentication with platform API keys. No extraction needed — it's already standalone.

----- END Architect Prompt -----

---

## Appendix A: Bassicology Integration Story (Tenant-Side Work)

*This appendix describes the work required on the Bassicology side to integrate with Practice Bridge's S2S API. Since you are the sole developer building both platforms, this lives alongside the Practice Bridge PRD so all integration work is visible in one place. This is NOT Practice Bridge feature work — it's Bassicology calling Practice Bridge's API.*

### Context: What Bassicology Has Today

Bassicology is an existing NestJS + Next.js monorepo (`bassnotion-monorepo-v1/`) with:

| Layer | Current State | Key Files |
|-------|--------------|-----------|
| **Auth** | Supabase Auth (email/password, magic link, Google OAuth). Zustand store + TanStack Query. | Backend: `domains/user/auth/auth.service.ts` · Frontend: `domains/user/hooks/use-auth.ts`, `components/auth/AuthProvider.tsx` |
| **Exercises** | MIDI-based exercises loaded from Supabase. Repository pattern with caching. | Backend: `domains/exercises/exercises.controller.ts` · Frontend: `domains/exercises/repositories/exercise.repository.ts` |
| **Playback** | 699-file audio engine — Tone.js, Web Audio, transport, MIDI pipeline, instruments (bass, drums, harmony, metronome). | Frontend: `domains/playback/` — `services/core/PlaybackEngine.ts`, `hooks/useAudio.ts`, `contexts/TransportContext.tsx` |
| **Billing** | Stripe (checkout, subscriptions, customer portal, webhooks). Product tiers + access gating. | Backend: `domains/billing/` · Frontend: `domains/billing/hooks/useBilling.ts` |
| **Tutorials** | Video sync (Bunny Stream), exercises linked to tutorial sections. Admin CRUD. | Backend: `domains/tutorials/` · Frontend: `domains/widgets/components/YouTubeWidgetPage/` |

### Story B.1: Practice Bridge Service Adapter (Backend)

As the Bassicology backend, I need an adapter service that encapsulates all communication with the Practice Bridge S2S API so that integration is clean, testable, and isolated.

**Acceptance Criteria:**

- Create `PracticeBridgeServiceAdapter` in `apps/backend/src/shared/services/practice-bridge-adapter.ts`
- Constructor takes: PB API base URL, platform API key, HTTP client
- Methods mirror Practice Bridge API endpoints used by Bassicology:
  ```typescript
  // Account lifecycle
  createAccount(email, displayName, instrument): Promise<{pbAccountId, accessToken, refreshToken}>
  deleteAccount(pbAccountId): Promise<void>
  exportAccountData(pbAccountId): Promise<JSON>

  // Token management
  refreshAccessToken(refreshToken): Promise<{accessToken, refreshToken}>

  // Sessions & scoring (post-MVP — when PB Desktop adds scoring)
  submitExerciseResult(pbAccountId, exerciseId, metrics): Promise<ScoreResult>
  getStudentProgress(pbAccountId): Promise<ProgressSummary>
  getStudentStreaks(pbAccountId): Promise<StreakData>
  ```
- Store encrypted `refreshToken` per user in Bassicology's own `profiles` table (new column: `pb_account_id`, `pb_refresh_token_encrypted`)
- Token refresh logic: auto-refresh on 401, retry once, fail gracefully
- S2S failure handling per practice-bridge-technical.md Section 7.5:
  - PB API down on signup → queue auto-creation in transactional outbox, retry with exponential backoff. Student uses Bassicology immediately.
  - PB API down on result submission → queue in outbox, retry async. Student sees "Score saved!" immediately.
  - PB API slow (>3s) → 5s timeout, queue for retry
- Register as NestJS provider in `SharedModule`, injectable into any domain service
- Unit tests with mocked HTTP client covering: happy path, 401 refresh, timeout, PB down (outbox)

*Note: This adapter is a pure HTTP client wrapper. No direct DB access to Practice Bridge's database. Ever.*

### Story B.2: Account Sync on Signup (Backend + Frontend)

As a student signing up on Bassicology, I want my Practice Bridge account created automatically so that I get practice scoring and analytics without a separate signup.

**Acceptance Criteria:**

- **Backend** (`auth.service.ts` — `registerUser()` method):
  - After successful Supabase Auth signup and Bassicology profile creation, call `practiceBridgeAdapter.createAccount()`
  - Store `pb_account_id` and encrypted `pb_refresh_token` on the Bassicology `profiles` row
  - If PB API is down: signup still succeeds on Bassicology. PB account creation queued in outbox. Background worker retries.
  - If PB API returns 409 (duplicate email): log warning, link existing PB account

- **Backend** (`user.service.ts` — `deleteProfile()` method):
  - On account deletion: call `practiceBridgeAdapter.deleteAccount(pbAccountId)` before deleting Bassicology data
  - If PB API fails: proceed with Bassicology deletion, queue PB deletion for retry

- **Frontend** — no changes needed. The PB account creation is invisible to the user. All PB tokens are managed server-side.

- **Database migration**: Add to Bassicology's `profiles` table:
  ```sql
  ALTER TABLE profiles
    ADD COLUMN pb_account_id UUID,
    ADD COLUMN pb_refresh_token_encrypted TEXT;
  ```

- Integration test: signup → verify PB account created → verify `pb_account_id` stored → verify login works → verify delete cascades

### Story B.3: Exercise Result Submission (Week 20-26 — When Full Desktop Ships)

As a Bassicology student who completed an exercise, I want my performance metrics sent to Practice Bridge so that my teacher sees my progress and I build streaks.

**Acceptance Criteria:**

- **When this ships:** After Practice Bridge Desktop full mixer (Epic 11, Week 20-26). Bassicology requires the full Desktop experience — 4-6ms audio latency, Desktop-owned backing track playback, and live scoring via note event streaming. Browser-only mode is not sufficient for the Bassicology exercise experience.

- **Frontend** — on exercise completion in the playback engine:
  - Capture metrics: exercise ID, duration, notes played, accuracy (from PB Desktop note events), tempo, attempts
  - Call Bassicology backend endpoint: `POST /api/v1/practice/submit`
  - Show result from Practice Bridge (score, feedback, streak update)

- **Backend** — new endpoint `POST /api/v1/practice/submit`:
  - Validates Bassicology auth (student must be logged in)
  - Retrieves user's PB access token (refresh if expired)
  - Calls `practiceBridgeAdapter.submitExerciseResult()` with the metrics
  - Returns PB scoring response to frontend
  - On PB API failure: queue in outbox, return optimistic "Score saved" to student

- **Frontend** — student dashboard integration:
  - Call `GET /api/v1/practice/progress` (new Bassicology endpoint that proxies PB API)
  - Display: practice streaks, recent scores, session history
  - TanStack Query key: `['practice', 'progress', userId]`

- **Key files to modify:**
  - `apps/frontend/src/domains/playback/` — exercise completion hook (capture metrics)
  - `apps/frontend/src/domains/user/components/DashboardContent/` — add practice progress section
  - `apps/backend/src/domains/` — new `practice/` domain with controller, service, DTOs

### Story B.4: Billing Coordination

As the Bassicology platform, I need to handle billing independently from Practice Bridge so that students pay through Bassicology's Stripe, not directly to Practice Bridge.

**Acceptance Criteria:**

- Bassicology continues to own its Stripe integration — students subscribe to Bassicology plans ($9/student, $29/teacher)
- Bassicology pays Practice Bridge a per-user API fee (negotiated separately, not in-app)
- No changes to Bassicology's billing flow — `domains/billing/` is untouched
- Practice Bridge's billing (for direct practicebridge.ai users) is completely separate
- Access gating in Bassicology remains as-is — Bassicology gates Bassicology features, PB gates PB features via S2S token validity
- If Bassicology student's subscription lapses: Bassicology stops calling PB API for that user (PB tokens become unused). No cascading cancellation needed.

*This story is mostly documentation — confirming that billing stays independent. No code changes unless the pricing model requires checking PB subscription status.*

### Integration Sequence (Recommended)

**Critical dependency:** Bassicology requires PB Desktop with full mixer (not just listener-only v1). The scored exercise experience with 3D fretboard and 4-6ms audio latency is the core Bassicology value prop — browser-only mode (20-50ms latency, no live scoring) is not acceptable. This means Bassicology ships when Epic 11 (Full Desktop) delivers the mixer, not at Week 14 with listener-only Desktop.

```
                    Bassicology Side                    Practice Bridge Side
                    ────────────────                    ────────────────────
Week 1-4:           —                                   Epic 1: Foundation + Tenant API
                                                        (Story 1.3b ships S2S API)

Week 3-4:           Story B.1: Build adapter            API is live, Bassicology can test
                    Story B.2: Account sync on signup   against staging

Week 5-14:          Story B.4: Confirm billing model    Epics 2-7: MVP (practicebridge.ai
                    Test S2S integration end-to-end     ships for direct users at Week 12-14
                    Build Bassicology UI & exercises     with self-assessment mode)

Week 14-20:         Continue Bassicology UI build       Epic 10: Desktop v1 (listener only)
                    Test with Desktop v1 (tuner, note   — scoring works but audio still from
                    events) but NOT ship yet            browser (20-50ms). Not shippable for
                                                        Bassicology.

Week 20-26:         Story B.3: Exercise submission      Epic 11: Full Desktop (mixer, CPAL
                    Full integration testing             audio output, 4-6ms latency).
                    ──────────────────────────           THIS is when Bassicology can ship.
                    BASSICOLOGY SHIPS (~Week 24-26)     Desktop owns audio, browser is display
                                                        + scoring engine only.
```

### What Stays in Bassicology (Never Moves to Practice Bridge)

- 3D fretboard visualization (`domains/playback/components/FretboardVisualizer/`)
- Audio engine / Tone.js / Web Audio (`domains/playback/modules/`)
- Video sync / Bunny Stream (`domains/widgets/`)
- Bass-specific exercises and MIDI content (`domains/exercises/`)
- Tutorial system (`domains/tutorials/`)
- Assessment system (`domains/assessment/`)
- All Bassicology UI/UX and branding

### What Practice Bridge Owns (Bassicology Calls via API)

- Student practice sessions (creation, assignment, tracking)
- Scoring engine (note comparison, DTW timing, accuracy)
- Practice streaks and analytics
- Teacher dashboard data
- Class management
- Session Builder
- Exercise library (Practice Bridge's own generic library — Bassicology's bass exercises are separate)
