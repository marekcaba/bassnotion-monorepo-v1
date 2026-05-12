# PRACTICE BRIDGE — Condensed Specification

**Version 6.0 — February 2026**
**CONFIDENTIAL — practicebridge.ai**

*practicebridge.ai — personalized guided practice sessions, designed by your teacher or by you, delivered every time you sit down to play.*

---

## 1. What It Is

The product is not a practice tracker. It is not a music education platform. It is not a curriculum. It is the infrastructure layer between a teacher's pedagogy — or a student's own goals — and the actual practice sessions that happen five times a week. The platform does not teach. The teacher teaches. The student practices. practicebridge.ai makes sure every practice session is as guided, structured, and measurable as the teaching itself.

**Development strategy (v6.0):** Bassicology — a bass-specific education product built on Practice Bridge capabilities — is the first product that ships, at Week 12-14 in browser-only mode. Practice Bridge capabilities (session builder, scoring, analytics) are features embedded inside Bassicology. Practice Bridge Desktop adds live scoring at Week 20-26. The Practice Bridge standalone multi-instrument platform is extracted later (Week 34-42) when the product has been validated with real users and revenue. This document describes the full Practice Bridge vision; the build order prioritizes shipping Bassicology first. See [practice-bridge-business.md](practice-bridge-business.md), Section 19 for details.

A violin teacher types: "Autumn Leaves bridge — right hand only at 60% tempo until 3 consecutive above 85%, then left hand, then together, ramp to full tempo." An AI agent translates her intent into a structured session automatically. She reviews it, assigns it to her studio. That evening, a student opens practicebridge.ai, clicks Start Session. The browser downloads all audio. The student practices — with a desktop app, mobile app, or just the browser. When the student finishes, the teacher sees exactly what happened. The cycle repeats.

**Practice Bridge** (practicebridge.ai) is the product. Four clean parts:

1. **practicebridge.ai (Browser)** — the primary interface. The laptop screen is always the primary display. Teacher side: AI-powered Session Builder, class management, results dashboard, feedback. Student side: session player, practice dashboard, scores, streaks, leaderboards. Owns all data. This is what generates revenue.

2. **Practice Bridge Desktop** (optional — power users) — the professional audio engine (Tauri/Rust, system tray). For students with real audio interfaces. Listens to whatever is happening inside the computer — DAW output, MIDI, audio interface input. Captures instrument input (4-6ms latency), streams note events to browser via localhost WebSocket. Handles Jam-Along stem removal. UI is only an audio source dropdown. **Practice Bridge Desktop v1 ships at Week 20-26 as a listener-first tray icon** — pYIN pitch detection and note event streaming only. Mixer, stem removal, and backing track playback are added in later milestones (Week 26-34). Bassicology v1.0 launches at Week 12-14 in browser-only mode without Practice Bridge Desktop. Practice Bridge Desktop is its own product — not a Bassicology feature.

3. **Practice Bridge Mobile** (optional — acoustic instruments, beginners) — the companion app. Audio out: session audio to phone headphones. Audio in: phone mic captures instrument, streams onset/pitch data to browser via WiFi. Vision: phone camera → MediaPipe → coarse hand position data only (raw video never leaves device). Phone + headphones = complete practice setup.

4. **The browser** — the session experience. Downloads the full session audio package at start. Runs the session script: conditions, branching, progression. Displays scoring when Desktop or Mobile is connected. Works without either — no browser microphone, no compromised fallback.

**The Programmable Session Builder** is the core differentiator. Teachers build sessions with conditions, branching, stacked variations, and contextual instructions — or describe them in plain language and let the AI agent build the structure automatically. Alternatively, teachers can use **Live Lesson Mode** to capture lessons as they happen and generate practice sessions automatically (see [practice-bridge-live-lesson.md](practice-bridge-live-lesson.md)). Not a playlist — a programmable practice script.

**The .ai is literal.** Year 1: AI builds what the teacher describes. Year 2: it knows the student's history. Year 3: it draws on aggregate data to suggest what works best. The AI session builder is the foundation of the platform's intelligence layer.

**Market context:** Tonara (closest competitor) shut down late 2023, displacing ~15,000-25,000 teachers. SmartMusic ($3/student/mo) is locked to their content library. The gap: nobody has a platform where the teacher is the content creator, the session is programmable, the platform listens with professional audio, and an AI agent eliminates the learning curve.

**Bassicology-first, then tenants:** Bassicology is the first product built on Practice Bridge capabilities — it ships at Week 12-14 and generates revenue immediately. The tenant REST API for third-party platforms is extracted later (Week 34-42) when Practice Bridge becomes a standalone platform. At that point, Bassicology becomes the first tenant. Future platforms integrate via the tenant API, inheriting scoring, analytics, and teacher features while providing instrument-specific content.

**Key insight:** All audio processing happens locally. No audio ever reaches any server. Raw video from mobile camera never leaves the device. Only anonymous performance metrics (scores, timing, BPM, key) reach the server.

---

## 2. How It Works — Core Loop

*At launch (Bassicology v1.0, Week 12-14), the core loop runs in browser-only mode with self-assessment conditions. Practice Bridge Desktop live scoring is added at Week 20-26.*

1. **Student opens practicebridge.ai.** Sees today's assigned sessions. Page detects Practice Bridge Desktop (via WebSocket) or Mobile (via WiFi) — if available. Green: "Live scoring enabled." Neither? "Play along mode."
2. **Session preload.** Student clicks Start. Browser downloads entire session package (manifest + all audio) before first step. No mid-session downloads.
3. **Practice begins.** Session script runs: "Right hand only @ 60% tempo." Browser plays backing track. Desktop connected: mixes backing + instrument in headphones, scores in real time. Mobile connected: session audio through phone headphones, phone mic captures instrument, scores with wider tolerances. Neither: student plays in room, self-assessment replaces scoring.
4. **Conditions and progression.** Browser evaluates pass conditions. Session auto-advances when met.
5. **Branching.** If student struggles, session diverts to remediation. Student sees a simpler step — not "you failed."
6. **Session complete.** Summary: steps, attempts, scores, time. Anonymous metrics sync. No audio, no song name.

**What Practice Bridge Desktop does:** Audio I/O (CPAL), pitch detection (pYIN, direct Rust implementation), onset detection, dynamics, AI stem removal (ONNX), BPM/key, fingerprinting, WebSocket streaming. *Practice Bridge Desktop v1 (Week 20-26) includes pitch detection, onset detection, and note event streaming only. Mixer, stem removal, BPM/key detection, and fingerprinting are added at Week 26-34.*

**What Mobile does:** Audio out (session → headphones), audio in (mic → pitch/onset → browser), vision (camera → MediaPipe → hand position), latency calibration.

**What the browser does:** AI Session Builder (teacher), session player (student), teacher dashboard, student dashboard, scoring logic (DTW in TypeScript), analytics, leaderboards, billing.

---

## 3. Architecture

```
                       TEACHER / STUDENT BROWSER
                      ┌──────────────────────────┐
                      │  practicebridge.ai        │
                      │  AI Session Builder,      │
                      │  scoring, dashboards      │
                      │  ALL INTELLIGENCE HERE    │
                      └─────┬────────┬────────┬───┘
              ws://localhost │        │ WiFi   │ HTTPS
                     :9876   │        │        │
            ┌────────────────┘        │        └──────────────────┐
            ▼                         ▼                           ▼
┌────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────┐
│  PB Desktop        │  │  PB Mobile           │  │  practicebridge.ai       │
│  (Tauri, power     │  │  (companion app)     │  │  (Server + REST API)     │
│   users)           │  │                      │  │                          │
│  Internal audio /  │  │  Audio OUT: session   │  │  Accounts, sessions,     │
│  DAW / interface   │  │   → headphones       │  │  scores, analytics       │
│  Stem removal      │  │  Audio IN: mic →     │  └────────────┬─────────────┘
│                    │  │   onset/pitch data   │               │ S2S API
└────────────────────┘  │  Vision: camera →    │     ┌─────────┴─────────┐
                        │   hand position      │     ▼                   ▼
                        └──────────────────────┘  ┌────────┐  ┌──────────────┐
                                                  │Bassic. │  │Future Tenants│
                                                  └────────┘  └──────────────┘
```

*In the v6.0 build order, Bassicology IS the browser app at launch (Week 12-14). Practice Bridge Desktop connects at Week 20-26. The tenant architecture (Bassicology as a separate client calling the PB API) applies after Practice Bridge is extracted as a standalone platform at Week 34-42.*

### Data Ownership

| Owner | Data |
|---|---|
| **practicebridge.ai (Server)** | Accounts, sessions, scores, assignments, rosters, analytics, streaks, leaderboards, AI session drafts |
| **Tenants** (e.g., Bassicology) | Instrument-specific content; submit practice data via S2S API |
| **Desktop/Mobile (local)** | Cached session audio, offline results, local analytics |
| **Neither (never stored)** | Audio files, raw video, song names, AcoustID fingerprints |

### Communication & API

| Channel | Path | Latency |
|---|---|---|
| Localhost WebSocket | Browser ↔ Desktop | sub-1ms |
| WiFi | Browser ↔ Mobile | 10-50ms |
| HTTPS | Browser ↔ Server | 50-200ms |
| S2S REST API | Tenant ↔ Server | 50-200ms |

**REST API endpoints:** `/api/v1/accounts`, `/sessions`, `/sessions/{id}/steps`, `/sessions/{id}/assign`, `/sessions/{id}/results`, `/assignments`, `/students/{id}/analytics`, `/leaderboards/{songHash}`, `/classes`, `/feedback`, `/accounts/{id}` (DELETE for GDPR), `/accounts/{id}/export` (GET for GDPR).

**Auth:** Direct users → Supabase session. Tenants → OAuth2-style S2S (platform API key + short-lived token). Failure handling via transactional outbox + exponential backoff. Idempotent results endpoints.

**No browser microphone.** Deliberate product decision. Browser mic quality is insufficient for scoring, latency is unacceptable, split-ear UX is poor. Two clean input paths: Desktop (power users) or Mobile (everyone else).

---

## 4. Key Features

### AI Session Builder

Teacher types in plain language: "Elis, C major scale, right hand at 60%, 3 correct passes, then left hand, then together, 15 minutes." AI agent (n8n + Claude/GPT-4) builds structured session automatically. Teacher reviews, adjusts, approves. First session: 2 minutes of typing. Long-term: AI knows student history, suggests calibrated sessions. **Live Lesson Mode** captures lessons directly — teacher demonstrates, platform records, session builds itself. See [practice-bridge-live-lesson.md](practice-bridge-live-lesson.md).

### Session Builder (Programmable Practice)

Sessions contain **steps** with audio, instructions, scoring mode, tempo, and **conditions**. Condition types: score threshold, repetition, time limit, self-assessment (first-class, not fallback), combined. **Branching:** remediation paths invisible to student. **Stacked variations:** same material at increasing difficulty. **Session preload:** everything downloads at start.

### Scoring Engine (Split Architecture)

Desktop/Mobile detects notes, streams to browser. Browser scores in TypeScript.

**Metered Scoring** — DTW timing analysis. For exercises, scales, etudes.
**Expressive Scoring** — Note accuracy (40%), dynamics (30%), completeness (30%). No timing. For rubato, interpretation.

### Instrument Profiles

Each instrument defines: input type, pitch range, detection mode, tuning, known artifacts, scoring approach. Fully solved (monophonic): trumpet, sax, flute, violin, voice, bass, etc. Solved (MIDI): piano, electronic drums. Onset-only: acoustic drums (e-kit via MIDI recommended; internal laptop mic explicitly not supported for drums).

### Computer Vision (Mobile Camera)

Coarse hand position only — not fingers, not frets. Audio knows pitch + video knows position zone → resolves string/octave ambiguity. MediaPipe on-device, two-point calibration, ~20 bytes/update at 10Hz. Raw video never leaves phone.

### Stem Removal, Leaderboards, Teacher Dashboard, Browser Extension, Offline, Self-Assessment

All unchanged from v5.0 — see full spec Sections 10-14 for details.

---

## 5. Tech Stack

### Practice Bridge Desktop
Tauri 2.x (Rust), CPAL, ort 2.0 (ONNX), tract, tokio-tungstenite, SQLite. macOS + Windows. *Practice Bridge Desktop v1 (listener-first, Week 20-26): Tauri, CPAL (input only), pyin-rs, tokio-tungstenite. Full stack (ort, tract, SQLite, mixer, stem removal) added at Week 26-34+.*

### Practice Bridge Mobile
Flutter (Dart). Platform-native mic/audio APIs. MediaPipe Hands. pYIN pitch detection (via FFI to Rust). iOS + Android.

### practicebridge.ai (Server + Web)
Supabase (PostgreSQL), Railway (API), Vercel (frontend), n8n (AI orchestration), Claude/GPT-4 API (session generation).

---

## 6. Data Model

### Practice Bridge Server DB

```
profiles, classes, class_members, assignments
practice_results    — session_step_id, scoring_mode, attempt_number, scores, practiced_at
leaderboard_entries — song_hash (opaque), student_id, score
sessions, session_steps, session_conditions, session_branches, session_assignments
ai_session_drafts   — teacher_id, prompt_text, generated_json, approved, session_id
platform_integrations — platform_key, api_key_hash, webhook_url
```

All tables include `tenant_id`. Tenants maintain own DB for instrument-specific content.

---

## 7. Build Order & Timeline

| Week | Milestone | Key Deliverable |
|------|-----------|----------------|
| 1-4 | Bassicology Foundation | Next.js, Supabase, auth, UI, exercise data model |
| 5-8 | Billing + Content | Stripe ($9/$29), tutorial player, YouTube sync |
| 9-12 | Teacher Features | Session builder, class management, teacher dashboard |
| **12-14** | **SHIP: Bassicology v1.0** | **Browser-only, self-assessment, revenue begins** |
| 14-20 | AI + Power Features | AI session builder, Live Lesson Mode ([practice-bridge-live-lesson.md](practice-bridge-live-lesson.md)) |
| 20-26 | Practice Bridge Desktop v1 | Tray icon listener, pYIN, PB-Audio v1 protocol, live scoring |
| 26-34 | Stem Removal + Mobile | ONNX, Jam-Along, mixer, Practice Bridge Mobile (Flutter) |
| 34-42 | Practice Bridge Standalone | Tenant API, practicebridge.ai branding, developer portal |

Bassicology ships first — revenue starts at Week 12-14. Practice Bridge Desktop is a listener-first tray icon at Week 20-26 (its own product, not a Bassicology feature). Practice Bridge becomes a standalone multi-instrument platform at Week 34-42. See [practice-bridge-business.md](practice-bridge-business.md), Section 19 for milestone details.

---

## 8. Pricing Model

| Tier | Price | Target User |
|---|---|---|
| **Student** | $9/mo | Every student — with or without a teacher |
| **Solo Teacher** | $29/mo | Session Builder, AI builder, dashboard, analytics (students pay separately) |
| **Studio** | $79/mo | Multiple teachers, shared session library (students pay separately) |
| **Institution** | Custom ($8-12/teacher/mo) | Annual contracts, LMS integration |

Every student pays $9/mo — no free tier. Desktop and Mobile always free. Unit economics: 1 teacher + 15 students = $164/mo ($29 + $135). Teacher is acquisition channel, students are revenue multiplier.

---

## 9. Legal Position

Four pillars: (1) Betamax Doctrine — 18+ features with zero copyright involvement, (2) no server-side audio, (3) stem removal not separation, (4) user responsibility via ToS.

Moises AI (70M+ users, $50.2M raised, no litigation) validates the market. Practice Bridge is more conservative on every dimension.

---

## 10. Strategy & Competitive Position

### Five-Layer Moat
1. **Session library** — switching cost compounds monthly
2. **Teacher network** — GitHub for pedagogy, network effect
3. **Student progress history** — bilateral lock-in
4. **Relationship graph** — invisible structural asset
5. **Longitudinal performance dataset** — foundation for AI teacher after 3 years at scale

### Data Strategy
"Join the world's largest study on how musicians actually improve." Real behavioral data → AI recommendations, adaptive personalization, publishable research. COPPA/GDPR compliant, real anonymization, no audio leaves device, explicit opt-in.

### Competitive Map

| Competitor | Gap |
|---|---|
| **Tonara** (shut down 2023) | Had assignments, no audio. ~15-25K teachers displaced. |
| **SmartMusic** ($3-4/student) | Locked content, teachers can't upload. Browser mic only. |
| **Practice Space** ($9.99) | Scheduling placeholder. Low switching cost. |
| **Moises** ($9.99) | Stems but no pedagogy or teacher features. |
| **Yousician/Simply Piano** | Consumer apps that teach. Different category entirely. |

**The gap:** Programmable sessions + professional audio + AI builder + teacher dashboard + scoring. Nobody combines all five.

### Multi-Tenant Vision
`tenant_id` on every table. `instrumentProfile` configures Desktop/Mobile for any instrument. Tenants integrate via developer portal + S2S API.

---

*This document is a condensed version of the full specification (v6.0, ~3,500 lines across three documents + addendum). For product context and user flows, see [practice-bridge-product.md](practice-bridge-product.md). For protocol definitions, scoring algorithms, and implementation specifics, see [practice-bridge-technical.md](practice-bridge-technical.md). For pricing, development milestones, and legal analysis, see [practice-bridge-business.md](practice-bridge-business.md). See [practice-bridge-index.md](practice-bridge-index.md) for the complete reading guide.*
