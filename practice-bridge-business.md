# PRACTICE BRIDGE — Business, Strategy & Legal

**Version 6.0 — February 2026**
**CONFIDENTIAL — practicebridge.ai**

*Sections 17-20 + Appendix A. For product context, see [practice-bridge-product.md](practice-bridge-product.md). For technical details, see [practice-bridge-technical.md](practice-bridge-technical.md).*

---

## 17. Licensing & Infrastructure Costs

### 17.1 Practice Bridge Specific Costs

| Item | Cost | Frequency |
|---|---|---|
| Apple Developer Program | $99 | Per year |
| Windows Code Signing Certificate (EV) | ~$300 | Per year |
| DMCA Agent Registration | $6 | Per 3 years |
| Chrome Web Store Developer Registration | $5 | One-time |
| **Total Year 1** | **~$406** | |

### 17.2 What Is Free

- Separation model and weights (MIT licensed, open community weights)
- ONNX Runtime inference engine via `ort` (MIT)
- `tract` real-time inference engine (MIT/Apache 2.0)
- Tauri 2.x application framework (MIT)
- CPAL audio library (Apache 2.0)
- tokio-tungstenite WebSocket library (MIT)
- Chromaprint / AcoustID fingerprinting (LGPL / free API)
- MusicBrainz metadata API (CC0)
- Rust toolchain and ecosystem
- Browser extension APIs

### 17.3 practicebridge.ai Hosting Infrastructure

| Service | Tier | Estimated Cost |
|---|---|---|
| Supabase | Pro ($25/mo) | Database, auth, storage, CDN for session audio assets |
| Railway | Starter ($5-20/mo) | REST API server, background workers |
| Vercel | Pro ($20/mo) | Frontend hosting (practicebridge.ai) |
| practicebridge.ai domain | ~$15/yr | Domain registration |

*Estimated total: ~$50-65/mo at launch. Scales with user count but remains low — servers handle only metadata API calls, not audio processing.*

### 17.4 Cost Advantage: Local Processing

Because all audio processing and ML inference occurs on the student's device, Practice Bridge incurs zero GPU server costs. Competing products like Moises process stems on cloud GPU infrastructure, paying per-song inference costs that scale linearly with user growth. Practice Bridge's architecture means infrastructure costs remain nearly flat regardless of user count — servers only handle lightweight metadata API calls. This is the fundamental cost advantage of the local-processing model.

---

## 18. Pricing Model

| Tier | Monthly Price | Target User | What's Included |
|------|---------------|-------------|-----------------|
| **Student** | $9/mo | Every student — with or without a teacher | Full session player, leaderboards, Jam-Along, practice analytics, streaks, scoring |
| **Solo Teacher** | $29/mo | Independent music teachers | Session Builder, AI session builder, teacher dashboard, analytics, class management (does NOT include student subscriptions) |
| **Studio** | $79/mo | Multi-teacher studios | Multiple teacher accounts, studio admin dashboard, shared session library (does NOT include student subscriptions) |
| **Institution** | Custom ($8-12/teacher/mo) | Schools, conservatories | Annual contracts, LMS integration, institutional admin, volume pricing (student subscriptions negotiated separately) |

**Every student pays $9/mo.** There is no free tier for students enrolled in a teacher's class. The teacher subscription covers the teacher's tools (Session Builder, dashboard, analytics, class management). The student subscription covers the student's tools (session player, scoring, leaderboards, Jam-Along, practice analytics). Both sides pay for what they use.

**Practice Bridge Desktop and Mobile are always free.** There is no separate charge for the audio engine or companion app. Every user — regardless of tier — gets the same stem removal quality, the same scoring engine, the same audio latency, the same computer vision. Feature gating is on the platform side (Session Builder, class management, analytics depth), not on audio quality.

**Jam-Along usage limits** are a secondary monetization lever. All students get a generous Jam-Along quota per month. Higher-tier institutional plans may include increased quotas.

**The student subscription is aspirational — students want the app, not tolerate it.** Every student pays directly. Not imposed by teacher. Students want this independently for progress tracking and honest feedback. The core practice experience (sessions, exercises, scoring) is compelling enough that students pay for the analytics, leaderboards, and Jam-Along access. Direct subscription, not teacher-mediated.

**Unit economics:** 1 teacher + 15 students = $164/month total per teacher relationship ($29 teacher + 15 × $9 students). The teacher is the acquisition channel. Students are the revenue multiplier. A studio with 3 teachers and 45 students = $484/month ($79 studio + 45 × $9 students). Teachers pay because Session Builder + AI session builder + analytics replace hours of manual assignment tracking.

**Tenant pricing:** Tenants (e.g., Bassicology) negotiate separate revenue-share or per-user agreements. Tenant users are billed through the tenant's own subscription system — they do not pay Practice Bridge directly. The tenant pays Practice Bridge a per-user API fee that is lower than the retail student price.

### 18.1 Bassicology Pricing (Launch)

Bassicology launches with the same pricing structure as the Practice Bridge platform:

| Tier | Monthly Price | Target User |
|------|---------------|-------------|
| **Student** | $9/mo | Bass students — with or without a teacher |
| **Solo Teacher** | $29/mo | Independent bass teachers — Session Builder, dashboard, analytics |

Bassicology pricing is bass-focused and may be adjusted independently. Practice Bridge standalone pricing (when it launches separately at Week 34-42) may differ based on the broader instrument coverage and multi-tenant positioning.

---

## 19. Development Strategy & Milestones

### 19.1 Bassicology-First Strategy

The v5.1 specification assumed Practice Bridge ships as a standalone multi-instrument platform first (56-84 weeks), with Bassicology onboarded as a tenant in Phase 9. **v6.0 inverts this.** Bassicology — the bass-specific education product — is the first product that ships and generates revenue. Practice Bridge capabilities (session builder, scoring, analytics, teacher dashboard) are features embedded inside Bassicology from day one.

Bassicology v1.0 ships at Week 12-14 in browser-only mode with self-assessment and time-based conditions. Revenue starts immediately: $9/student + $29/teacher. Practice Bridge Desktop adds live scoring at Week 20-26. The full Practice Bridge standalone platform — multi-instrument, multi-tenant, with its own branding and domain (practicebridge.ai) — is extracted from the working Bassicology codebase at Week 34-42. This eliminates the "build everything, then monetize" risk of the original plan. Real users validate the product before the standalone platform is built.

The data model includes `tenant_id` on all tables from Week 1 — this costs nothing upfront and ensures the extraction to a multi-tenant platform is clean when the time comes. But until Week 34-42, there is only one tenant: Bassicology.

### 19.2 Practice Bridge Desktop: Listener-First Architecture

Practice Bridge Desktop v1 is not the full-featured audio engine described in v5.1. It is a **listener-first tray icon** — a simple application that captures audio from the student's default input device, runs pYIN pitch detection, and streams note events to the browser via localhost WebSocket. No mixer, no backing track playback, no stem removal.

Practice Bridge Desktop speaks a generic **PB-Audio v1 protocol** (see [practice-bridge-technical.md](practice-bridge-technical.md), Section 7.1a) with no Bassicology-specific code. It receives an `instrumentProfile` message from the browser at connection time and configures its pitch detection accordingly. The same Practice Bridge Desktop binary works with Bassicology, the future practicebridge.ai standalone platform, and any future tenant — without modification.

The pipeline is **additive**. Each later milestone adds new modules to Practice Bridge Desktop without breaking existing functionality:
- **Week 20-26 (v1):** pYIN pitch detection, onset detection, tuner data, note event streaming. Capabilities: `["scoring", "tuner"]`.
- **Week 26-34:** Mixer (instrument + backing → headphones), backing track playback via CPAL, `ort` ONNX stem removal, BPM/key detection, AcoustID fingerprinting. Capabilities expand: `["scoring", "tuner", "stemRemoval", "mixer", "transport"]`.
- **Week 34+:** Offline SQLite storage, CLI headless mode, multi-take recording, beat grid locking. Full Practice Bridge Desktop as described in the product and technical specs.

Practice Bridge Desktop is its own product — it ships alongside Bassicology but is not a Bassicology feature. When Practice Bridge goes standalone, the same binary serves all platforms.

### 19.3 Milestone Timeline

| Week | Milestone | Key Deliverable |
|------|-----------|----------------|
| 1-4 | Bassicology Foundation | Next.js app, Supabase auth, UI framework, exercise data model |
| 5-8 | Billing + Content | Stripe subscriptions ($9/$29), tutorial player, YouTube sync, content delivery |
| 9-12 | Teacher Features | Simplified Session Builder, class management, teacher dashboard |
| **12-14** | **SHIP: Bassicology v1.0** | **Browser-only, self-assessment conditions, revenue generation begins** |
| 14-20 | AI + Power Features | AI Session Builder (n8n + LLM), Live Lesson Mode, full branching/variations |
| 20-26 | Practice Bridge Desktop v1 | Tray icon listener, pYIN, PB-Audio v1 WebSocket, live scoring in browser |
| 26-34 | Stem Removal + Mobile | ONNX inference, Jam-Along, mixer, Practice Bridge Mobile (Flutter) |
| 34-42 | Practice Bridge Standalone | Tenant API, S2S auth, practicebridge.ai branding, developer portal |

### 19.4 What Ships at Each Milestone

#### Weeks 1-4 — Bassicology Foundation

**Bassicology Web:** Next.js 15 app with Supabase database and auth. Exercise data model with `tenant_id` on all tables (future-proofing for multi-tenancy). Basic student dashboard (practice history, exercises). UI framework (shadcn/ui, Tailwind). This builds Bassicology directly — not Practice Bridge infrastructure.

**Bassicology API:** REST API server (NestJS + Fastify). Account creation, exercise CRUD, basic analytics. Supabase database with the schema from [practice-bridge-technical.md](practice-bridge-technical.md), Section 15.1 — adapted for Bassicology's bass-specific content.

#### Weeks 5-8 — Billing + Content Delivery

**Bassicology Web:** Stripe integration ($9/student, $29/teacher). Tutorial player with YouTube sync. Content delivery pipeline for exercise audio and backing tracks. Student subscription flow.

**Bassicology API:** Billing webhooks, subscription management, content asset management.

#### Weeks 9-12 — Teacher Features

**Bassicology Web:** Simplified Session Builder (linear sessions, basic conditions: score threshold, repetition, time limit, self-assessment). Class management (create classes, invite students, view roster). Teacher dashboard with basic analytics (per-student practice time, session completion rates). Assignment creation and tracking.

**Bassicology API:** Session CRUD, assignment endpoints, class/roster management, teacher feedback endpoints.

#### Weeks 12-14 — SHIP: Bassicology v1.0

**Bassicology v1.0 launches in browser-only mode.** All students use self-assessment ("I nailed it" / "Needs work") and time-based conditions. No Practice Bridge Desktop required, no live scoring. The session structure, instructions, branching, and teacher feedback all work — only automated scoring is absent. Self-assessment is a first-class condition type, not a degraded fallback.

Revenue generation begins: $9/student + $29/teacher. The teacher is the acquisition channel. Students are the revenue multiplier.

#### Weeks 14-20 — AI Session Builder + Power Features

**Bassicology Web:** AI Session Builder (natural language → structured session via n8n + LLM). **Live Lesson Mode** — capture lessons directly, auto-generate practice sessions from teacher demonstration and voice instruction (see [practice-bridge-live-lesson.md](practice-bridge-live-lesson.md)). Full branching, stacked variations, expressive scoring logic. Advanced analytics dashboards. Leaderboards and streak tracking.

**Bassicology API:** n8n webhook integration for AI session builder. Live Lesson Mode endpoints ([practice-bridge-live-lesson.md](practice-bridge-live-lesson.md), Section 11). Advanced analytics queries.

**Live Lesson Mode is prioritized** within this milestone as the primary session input method — it demonstrates value in the teacher's first lesson, creates irreversible switching cost, and is the primary word-of-mouth driver. See [practice-bridge-live-lesson.md](practice-bridge-live-lesson.md), Section 9.2.

#### Weeks 20-26 — Practice Bridge Desktop v1

**Practice Bridge Desktop v1:** Tauri 2.x tray icon application. CPAL audio input capture from default device. pYIN pitch detection (`pyin-rs`, direct Rust implementation). Onset detection and dynamics analysis. Tuner data streaming. WebSocket server (`tokio-tungstenite`) on `ws://localhost:9876` implementing PB-Audio v1 protocol (see [practice-bridge-technical.md](practice-bridge-technical.md), Section 7.1a). Deep link handler (`practicebridge://`). **`instrumentProfile` message support from day one** — defaults to bass, but the protocol is instrument-agnostic.

**What Practice Bridge Desktop v1 does NOT include:** Mixer (instrument + backing → headphones), backing track playback via CPAL, ONNX stem removal, BPM/key detection, AcoustID fingerprinting, browser extension tab capture, multi-take recording, SQLite offline storage, CLI headless mode.

**Bassicology Web:** WebSocket client for Practice Bridge Desktop connection. Live scoring display. Tuner visualization. Connection status indicator: "Practice Bridge Desktop connected — live scoring enabled" or "Practice Bridge Desktop not detected — using self-assessment mode."

Key risk: Low-latency audio monitoring on Windows. Mitigated by the three-tier latency system ([practice-bridge-technical.md](practice-bridge-technical.md), Section 9.5): ASIO → WASAPI Exclusive → WASAPI Shared, with honest latency communication to the student at each tier.

#### Weeks 26-34 — Stem Removal + Mobile

**Practice Bridge Desktop (expanded):** `ort` ONNX inference, model loading, segmented streaming pipeline, instrument-removed mix computation, crossfade assembly, progressive purge. Mixer (instrument input + backing track/stem-removed mix → headphones). Backing track playback via CPAL. BPM/key detection, AcoustID fingerprinting. **Stem target configurable via `instrumentProfile`**. Browser extension support (`tabCapture` PCM streaming).

**Practice Bridge Mobile:** Flutter (Dart) native app. Audio pipeline: session audio playback to headphones (audio out), phone mic capture with on-device pYIN pitch detection and onset analysis via FFI to shared Rust engine (audio in), structured note event streaming to browser via WiFi. Computer vision: MediaPipe Hands integration, two-point calibration, coarse hand position extraction.

**Bassicology Web:** Stem removal UI (Jam-Along mode), mobile pairing flow, song metadata display (local-only).

Key risk: Model conversion from PyTorch to ONNX; GPU memory management across hardware.

#### Weeks 34-42 — Practice Bridge Standalone

Extract the Practice Bridge platform from Bassicology:
- practicebridge.ai domain and branding (separate from Bassicology)
- Tenant API: S2S authentication (platform API keys, OAuth2 token model)
- Developer portal: API documentation, platform registration, API key management
- Bassicology becomes the first tenant of the Practice Bridge platform
- Webhook configuration for tenant integrations
- Rate limiting and usage analytics per tenant
- Institutional features: school admin dashboard, bulk onboarding, grade export, LMS integration

The API endpoints already exist from Weeks 1-34. This milestone adds S2S authentication, tenant scoping, branding separation, and developer onboarding — not new data models.

**Practice Bridge Desktop (expanded):** SQLite local storage, offline mode, CLI entry point via `clap`, batch analysis commands. Beat grid locking, MusicBrainz metadata lookup, multi-take recording. Full Practice Bridge Desktop as described in the product and technical specs.

### 19.5 Why Bassicology First

**Revenue at Week 12-14 vs. Week 52-78.** The v5.1 plan did not generate revenue until the Tenant API shipped in Phase 9 (Week 52-78). The v6.0 plan generates revenue at Week 12-14 — a 40-64 week improvement in time-to-revenue.

**Real users validate the product.** Bassicology puts the session builder, teacher dashboard, and student experience in front of real bass teachers and students before the standalone platform is built. Product decisions are informed by actual usage, not speculation.

**Practice Bridge Desktop architecture informed by usage data.** By the time Practice Bridge Desktop ships at Week 20-26, Bassicology has been live for 6-12 weeks. The WebSocket protocol, scoring display, and connection flow are designed based on real browser-side experience.

**Tenant API designed from a working product.** When the tenant API is extracted at Week 34-42, it's modeled on an API that has been serving real traffic for 20-28 weeks. No speculative endpoint design.

**The full Practice Bridge vision is preserved.** Nothing is removed from the specification — stem removal, multi-instrument support, institutional features, offline mode, CLI, mobile companion, computer vision — all of it ships. The difference is build order and time-to-revenue.

---

## 20. Upgrade Path, Market Context & Future

### 20.1 Progressive Upgrade Path

**Practice Bridge Desktop pipeline expansion (listener-first):** Practice Bridge Desktop v1 ships at Week 20-26 as a tray icon listener with pYIN pitch detection only. Later milestones add modules additively: mixer + backing track playback (Week 26-34), stem removal (Week 26-34), BPM/key detection (Week 26-34), browser extension tab capture support, beat grid locking, and offline storage. Each module plugs into the existing PB-Audio v1 protocol without breaking changes — new capabilities are announced via the `capabilities` array in the WebSocket handshake message (see [practice-bridge-technical.md](practice-bridge-technical.md), Section 7.1a). The pipeline never requires architectural rewrites.

**Stem removal model:** Loaded as an ONNX file. Upgrading means swapping one file. New models are pushed as background downloads without requiring an app update.

**Segment size:** Configurable between 6-30 seconds. Can be adjusted automatically based on detected hardware.

**Session Builder:** Starts with linear sessions, score/repetition/time/self-assessment conditions, and single-level branching. Future expansions: conditional loops ("repeat until comfortable"), parallel tracks ("practice left hand while listening to right hand reference"), session templates (teacher shares a session structure, another teacher customizes it for their class), AI-suggested branching (the system proposes remediation steps based on class-wide failure patterns).

**Scoring algorithm:** Lives in the browser — can be A/B tested, iterated, and updated instantly without shipping Practice Bridge Desktop updates. Starts with DTW-based Metered scoring and rule-based Expressive scoring. Future: ML-based Expressive scoring that learns from reference recordings, ensemble scoring (evaluate multiple instruments together), sight-reading mode (generate random passages and score on the fly).

**Expressive scoring expansion:** Initial Expressive mode scores note accuracy, dynamics, and completeness. Future additions: articulation scoring (staccato, legato, accents), phrasing analysis (musical sentence structure), vibrato quality (for strings and voice), pedal usage (for piano).

**Audio fingerprinting:** Starts with Chromaprint/AcoustID (free). Can later integrate commercial fingerprinting for better coverage.

**Stem removal model quality:** All users get the best available model — no quality tiering. Tiering stem removal quality would create a two-class scoring system where free users get worse separation, leading to lower scores through no fault of their own practice. This undermines trust in the scoring system and makes leaderboards unfair. Instead, monetize through feature access and usage limits (see Section A.12): free users get fewer Jam-Along sessions per day, paid users get more. The stem removal quality is the same for everyone. If a commercial model (e.g., AudioShake) becomes available, it replaces the open-source model for all users — the cost is absorbed as infrastructure, not passed to the student as a paywall.

**Mobile companion app (Flutter, shared Rust audio engine):** The mobile companion app uses Flutter (Dart) for UI and platform integration, with the core Rust audio modules (pYIN pitch detection, onset analysis, scoring, tuner) exposed via FFI through Flutter platform channels. This architecture was chosen over React Native because the app is hardware-interface-heavy (audio I/O, camera, WiFi streaming) where Flutter's compiled-to-native approach delivers better audio/camera latency and more consistent cross-platform behavior.

- **No localhost WebSocket.** Mobile browsers cannot connect to a localhost server running on the same device in the same way. The mobile app communicates with the browser on the student's laptop via WiFi (not localhost).
- **Communication model:** The mobile app is a companion sensor — audio in (phone mic → pYIN → note events → browser via WiFi), audio out (session audio → phone headphones), and vision in (camera → MediaPipe → hand position → browser via WiFi). The laptop browser remains the primary UI.
- **Reduced scope:** Stem removal is computationally intensive and does not run on mobile hardware. The mobile app ships with exercise scoring, tuner, hand tracking, and audio I/O — but not Jam-Along stem removal.
- **Shared code:** The Rust audio engine (pYIN pitch detection, onset detection) compiles to both iOS and Android via FFI. Estimated 60-70% of the core audio logic is reusable. Flutter handles the platform-specific audio I/O (CoreAudio on iOS, Oboe/AAudio on Android) and camera integration.

**Bottom line:** The mobile companion app shares the Rust audio engine with Desktop but is architecturally distinct — a sensor/speaker that streams data to the browser, not a standalone practice platform.

**Audio-to-notation (future):** The `candle` Rust ML framework includes an optimized Whisper implementation (~120ms latency on Apple Silicon). A future feature could transcribe the student's playing to notation/tablature in real time.

**Full stem separation (future, legal-dependent):** If the legal landscape clarifies (Moises continues unchallenged, industry partnerships emerge), the engine can be expanded to expose per-stem controls. The multi-model architecture supports this without architectural changes — only the post-processing step changes from "discard stems, output instrument-removed mix" to "expose stems to user."

**⚠️ Critical constraint: cloud-based audio processing (uploading audio to a server) would introduce significant legal exposure by creating server-side copies. The local-only processing architecture must be maintained as a core design principle.**

### 20.2 Tenant Architecture

**Bassicology-first, then tenants.** In v6.0, Bassicology is not a tenant — it is the product. The tenant architecture described below applies when Practice Bridge is extracted as a standalone platform (Week 34-42). At that point, Bassicology becomes the first tenant of the Practice Bridge platform. The multi-tenant data model (`tenant_id` on all tables) is designed into Bassicology from day one so the extraction is clean, but tenant API endpoints, S2S authentication, and the developer portal are built after Bassicology has proven the product.

Practice Bridge is the platform. Tenants add instrument-specific content and UX on top.

The API and data model are designed for multi-tenancy from day one (`tenant_id` on all tables, `platform_integrations` table for API keys). Weeks 34-42 (Section 19.3) open the Tenant API — the data model already supports it.

**Instrument-agnostic audio pipeline:** The only instrument-specific configuration is the `instrumentProfile` message ([practice-bridge-technical.md](practice-bridge-technical.md), Section 7.2):

| Pipeline Component | Instrument-Specific Config | Default (Bass) |
|---|---|---|
| **Pitch detection** (pYIN) | Frequency range | 41Hz–400Hz (bass). Guitar: 80Hz–1.2kHz. Piano: 27Hz–4.2kHz. Voice: 80Hz–1.1kHz. |
| **Stem removal** model | Which stem to attenuate | Bass. Guitar: guitar stem (requires 6-stem model). Vocals: vocal stem. Drums: drum stem. |
| **Onset detection** | Sensitivity thresholds | Tuned for plucked bass. Adjust for picked guitar, hammer-on piano, breath-onset voice. |
| **Scoring tolerance** | DTW tolerance parameters | Bass-appropriate. Tighter for piano (exact pitch), looser for voice (vibrato). |

Practice Bridge Desktop receives an `instrumentProfile` from the browser at connection time:

```json
{
  "type": "instrumentProfile",
  "instrument": "bass",
  "pitchRange": { "minHz": 41, "maxHz": 400 },
  "stemTarget": "bass",
  "onsetSensitivity": 0.6,
  "scoringTolerance": { "pitchCents": 50, "timingMs": 80 }
}
```

The Practice Bridge Desktop binary is the same for all instruments — no per-instrument builds. The browser tells Desktop what instrument to listen for.

**Bassicology as first tenant:** Bassicology adds bass-specific exercises, 3D fretboard visualization, YouTube sync, and bass pedagogy on top of Practice Bridge. Bassicology users get the full Practice Bridge experience (sessions, scoring, analytics) without knowing Practice Bridge is the underlying platform. Bassicology pays a per-user API fee and handles its own billing and content.

### 20.3 Market Context

Practice Bridge enters a market with a clear gap:

**Tonara** (shut down late 2023): Teacher assignment platform with practice tracking. Estimated 15,000-25,000 active teachers at shutdown. No audio processing, no scoring, no session builder. Teachers loved the assignment workflow but students found it "one more app to check." Tonara's shutdown left its teacher base (K-12 music programs, private studios) without a replacement — these users are currently displaced, using inferior substitutes, and ready to move to something genuinely better. **Primary acquisition target.** Practice Bridge's Session Builder fills this gap with dramatically deeper functionality.

**SmartMusic / MakeMusic Cloud** ($3-4/student/mo): Assessment-focused, locked content library (Hal Leonard), institutional contracts. Teachers cannot upload their own content or build custom sessions without significant friction. Strong in band programs but weak for private teachers, string players, and non-classical genres. Their content library is the product — practicebridge.ai makes the teacher's content the product. Practice Bridge's teacher-as-content-creator model is the core differentiator. Browser mic scoring only — no professional audio quality.

**Practice Space** ($9.99/mo): Captured Tonara refugees as a placeholder. Digital assignment book. No audio listening, no scoring, no session logic. Teachers are not deeply attached — low switching cost away from it.

**Moises** (freemium, $9.99/mo premium): Stem separation app for musicians. Consumer-focused, no teacher features, no structured practice, no scoring. Moises proves market demand for stem separation but does not serve the teacher-student workflow.

**Yousician / Simply Piano / Flowkey** (consumer subscriptions): Consumer apps that teach their own curriculum. Completely different product category. Not competitors — they teach. practicebridge.ai does not teach. These apps are the teacher; Practice Bridge empowers the human teacher. A student uses Yousician to learn scales and then uses practicebridge.ai because their violin teacher assigns sessions there.

**The gap:** No existing product combines all six: (1) programmable practice sessions with conditions and branching, (2) professional audio engine with real-time scoring, (3) AI session builder that eliminates the learning curve, (4) teacher dashboard with per-student analytics, (5) stem removal for play-along practice, (6) **automatic session generation from lesson capture** — Live Lesson Mode eliminates the teacher's session-building workflow entirely, generating practice plans as the teacher teaches ([practice-bridge-live-lesson.md](practice-bridge-live-lesson.md)). SmartMusic has scoring but locked content. Tonara had assignments but no audio. Moises has stems but no pedagogy. Yousician teaches but doesn't support human teachers. No competitor captures lessons directly. Practice Bridge is the first to combine all six. The space is empty and the window is open.

### 20.4 Strategic Moat

Practice Bridge's competitive advantage compounds over time through five reinforcing layers:

**Layer 1 — Session Library (Switching Cost).** Every session a teacher builds lives on practicebridge.ai. Conditions, branching logic, audio references, contextual instructions — all encoded in the platform's format. After 200 sessions, switching to a competitor means rebuilding from scratch. This switching cost compounds monthly, automatically, as the teacher invests more in their craft.

**Layer 2 — Teacher Network (Network Effect).** Teachers share sessions with each other — a GitHub for music pedagogy. A violin teacher in Boston finds a Bach suite session built by a teacher in London, forks it, adjusts the branching for her students. More teachers = richer session library = more valuable to every new teacher who joins. Network effect that no competitor starting today can replicate.

**Layer 3 — Student Progress History (Bilateral Lock-in).** Every student's longitudinal practice record lives on practicebridge.ai. Six months of sessions, every attempt, every score, every struggle point, every branching path taken. The teacher loses this view if the student switches platforms. The student loses their continuity. Bilateral lock-in — both sides have reasons to stay.

**Layer 4 — Relationship Graph (Invisible Asset).** The platform knows the structure of the music teaching world — who teaches whom, which studios share teachers, which students study multiple instruments, which teachers build the most effective sessions. Built invisibly as teachers and students connect. This graph has value for recommendations, partnerships, and understanding the market.

**Layer 5 — Longitudinal Performance Dataset (Unassailable Position).** After 3 years at scale, Practice Bridge accumulates the largest dataset on how humans learn musical instruments ever collected. Not self-reported survey data — actual behavioral data from actual practice measured objectively at scale. Every session run, every scoring result, every branching decision, every improvement trajectory. This dataset is the foundation of the AI teacher (see Section 20.5) and represents a competitive position that no competitor can buy, copy, or shortcut. Live Lesson Mode ([practice-bridge-live-lesson.md](practice-bridge-live-lesson.md)) contributes an additional data dimension: the structure of what teachers actually teach — captured lessons with auto-generated domain classifications inform future AI recommendations of "what to teach next."

### 20.5 Data Strategy

**The positioning:** "Join the world's largest study on how musicians actually improve."

This is not spin. It is true. The platform generates real behavioral data from real students practicing real instruments, measured objectively at scale. That dataset — accumulated over years — is the foundation of:

- **AI session recommendations** that draw on what actually works across thousands of teachers, not what one teacher intuits
- **Adaptive session personalization** calibrated to individual student learning patterns, instrument, and skill level
- **Publishable music education research** — partner with conservatories and universities to produce peer-reviewed studies on practice effectiveness
- **The AI teacher** — not replacing the human teacher but informing them with evidence no individual teacher could accumulate alone

**Legal requirements for data collection:**
- COPPA compliance for students under 13 — explicit parental consent required before any data collection
- GDPR compliance for EU students — right to access, rectification, erasure, and portability
- Real anonymization — not just name removal, proper k-anonymity ensuring individuals cannot be re-identified
- Video processed locally on mobile device, never stored as raw video — only structured position data retained
- No audio ever leaves the device — only structured note events and scores
- Explicit opt-in for aggregate data contribution, explained in plain language during onboarding

**Current status:** This is aspirational and part of the long-term roadmap. The current pricing model (Section 18) does not include a data contributor free tier. Future consideration: a data contributor model where anonymized practice data contributes to platform AI in exchange for reduced pricing. Any such model would require clear consent mechanisms, easy opt-out, and transparent data handling.

---

## Appendix A: Legal Framework

*This appendix contains the complete legal analysis and defense strategy. The technical safeguards are described in the main document ([practice-bridge-product.md](practice-bridge-product.md) Sections 3.4, 3.5 and [practice-bridge-technical.md](practice-bridge-technical.md) Sections 10.2, 10.7, 11.3, 14.2). This appendix covers the legal reasoning, precedents, contractual defenses, and business strategy.*

*Note: Practice Bridge (practicebridge.ai) is the primary product. Tenants like Bassicology (bassicology.com) add instrument-specific content on top. This tenant architecture strengthens the legal defense: the core platform is an instrument-agnostic practice infrastructure provider with no knowledge of what content any tenant offers. Where this appendix references "Bassicology," the same legal arguments apply to any tenant — the analysis uses Bassicology as the concrete example because it is the first tenant.*

### A.1 Core Legal Position

Practice Bridge's legal architecture rests on four pillars:

**Pillar 1 — Betamax Doctrine (Sony v. Universal, 1984):** A product does not constitute contributory copyright infringement if it is capable of substantial noninfringing uses. Practice Bridge has 14 features with zero copyright involvement. Its non-infringing uses (tuner, original exercises, technique analysis, practice analytics, coaching, student's own recordings, local-only mode, CLI analysis) far exceed those of the original VCR.

**Pillar 2 — No Server-Side Audio Processing or Song Identification:** All audio processing occurs locally on the student's device. Neither Practice Bridge's nor Bassicology's servers ever receive, store, process, or transmit any audio — original or processed. Song identification (title, artist) is performed locally via AcoustID and is never transmitted to any server. The only data that reaches server infrastructure is anonymous performance metadata: scores, timing accuracy, BPM, key. Neither Practice Bridge's API nor Bassicology's servers have knowledge of which specific copyrighted songs a student processes.

**Pillar 3 — Real-Time Audio Transformation, Not Decomposition:** The stem removal feature applies a real-time audio transformation — analogous to noise cancellation, equalization, or dynamic range compression. No isolated copies of any component of the audio (bass, vocals, drums) are ever created, stored, or exposed to the student. Intermediate model outputs are transient computation artifacts that exist only within the processing pipeline and are discarded immediately after use. The only outputs are: (a) the original audio (which the student already possesses) and (b) an instrument-attenuated version that plays in real time to headphones and is progressively purged from a rolling ~30-second RAM buffer. This is analogous to the buffer held non-infringing in *Cartoon Network v. Cablevision* (2nd Circuit, 2008).

**Pillar 4 — User Responsibility:** The Terms of Service require students to warrant they possess all rights necessary to process any audio content. Practice Bridge reads audio from the student's local files or receives a stream from the browser extension's `tabCapture` API. It does not integrate with, connect to, or reference any streaming platform.

**Note on scoring reference note events (Section 10.7):** The scoring engine extracts note events (pitch, onset, timing) from the instrument estimate to create a reference for DTW comparison. A complete note event sequence could be characterized as a structured transcription of a copyrighted musical line. This is acknowledged as a gray area. The defense: note events are (1) imprecise ML approximations (not verified scores), (2) transient (never persisted, exported, or displayed as notation), (3) consumed solely for educational measurement (not reproduction), and (4) incapable of reconstructing audio. This is analogous to a music teacher mentally tracking which notes a student plays — an internal representation used for evaluation, not a published transcription. The transience and purpose distinguish this from actionable transcription. Exercises (Bassicology-owned content) carry zero risk since the reference is owned original content.

### A.2 Why Stem Removal Is Legally Stronger Than Stem Separation

Full stem separation (producing 4 isolated stems) creates 4 distinct reproductions of the copyrighted work's component parts. Each isolated stem — an a cappella vocal track, an isolated drum track — is independently valuable and independently infringing if distributed.

Stem removal creates **zero isolated reproductions**. The engine produces a single modified version of the audio (original minus instrument) that plays in real time. No individual component can be extracted, saved, or accessed by the student. The internal model computation is no different from any other audio processing algorithm that uses intermediate buffers — like a multi-band compressor that splits audio into frequency bands internally but outputs a single processed signal.

This reframes the feature from "we decompose copyrighted audio into parts" to "we apply an audio effect." The latter has no copyright precedent against it.

### A.3 Browser Extension Legal Considerations

The browser extension captures audio using the browser's own `tabCapture` API, which requires explicit user permission per tab. This is functionally equivalent to the student connecting an audio cable from their speaker output to their audio interface input — a standard practice in music education. The extension:

- Does not circumvent any DRM or technological protection measures
- Does not intercept encrypted streams — `tabCapture` accesses the decoded audio output, the same signal that reaches the student's speakers
- Requires active user consent for each capture session
- Is architecturally identical to screen-recording extensions (Loom, OBS browser source) which are widely distributed via Chrome Web Store

### A.4 Live Stream Stem Removal: Time-Shift + Transformation Defense

In Jam-Along Streaming Mode ([practice-bridge-product.md](practice-bridge-product.md), Section 6.4, Option B), the student plays audio in their browser (e.g., a YouTube video), the browser extension captures that tab's audio via `tabCapture`, and Practice Bridge processes it through the stem removal engine with a ~15-second delay before outputting instrument-removed audio to headphones. This flow combines two well-established legal doctrines.

#### A.4.1 Time-Shifting (Sony v. Universal, 1984)

The student is listening to audio they are already entitled to hear — it is actively playing in their browser. The ~15-second processing delay is functionally **time-shifting**: the same content, played back moments later through an audio transformation. The Supreme Court held in *Sony v. Universal* (1984) that time-shifting for personal, non-commercial use constitutes fair use.

#### A.4.2 Transient Buffer (Cartoon Network v. Cablevision, 2008)

Practice Bridge maintains a rolling ~15-30 second RAM buffer of audio being processed. This is directly analogous to the buffer that the 2nd Circuit held non-infringing in *Cartoon Network v. Cablevision*: transient, rolling, never written to disk, and existing solely to enable real-time playback. The stem removal transformation is applied within this buffer. As each segment is played, it is zeroed and deallocated.

#### A.4.3 Tab Capture Audio Routing (Two-Phase)

When `chrome.tabCapture` captures a tab's audio, the tab is **muted at the OS level** — the browser no longer sends audio to speakers. Practice Bridge becomes the **sole audio output path** from the moment of capture. The student always hears exactly one copy of the audio through headphones.

The key design question: what does the student hear during the ~15 seconds while the stem removal buffer fills? The answer is a two-phase approach:

**Phase 1 — Passthrough (t=0s to ~14s):** Practice Bridge receives the captured PCM and immediately routes it to headphones alongside the student's live instrument input. The student hears the full original mix + their own playing. No silence gap. Stem removal processes in the background.

**Phase 2 — Crossfade (t≈14s+):** When the first stem-removed segment is ready, Practice Bridge crossfades from the passthrough to the instrument-removed mix over ~2 seconds. The student now hears everything-minus-instrument + their own playing.

```
LIVE STREAM FLOW (Tab Capture — Two Phase):

Browser tab (playing audio) → tabCapture API (tab muted at OS level)
                                        ↓
                              PCM over ws://localhost
                                        ↓
                              ┌─────────────────────────────────┐
                              │ Practice Bridge                  │
                              │                                  │
                              │ Phase 1 (0-14s): passthrough    │
                              │   PCM → mixer → headphones      │
                              │   (full mix + live instrument)   │
                              │                                  │
                              │ Phase 2 (14s+): stem removal    │
                              │   PCM → model → minus-instrument│
                              │   → mixer → headphones           │
                              │   (crossfade from passthrough)   │
                              └─────────────────────────────────┘
                                        ↓
Instrument → audio interface → Practice Bridge mixer → CPAL → 🎧 headphones
```

At no point does the student hear silence. At no point do two simultaneous copies of the audio exist in the output path — the tab is muted at the OS level, and Practice Bridge is the sole audio output.

#### A.4.4 Legal Equivalence: File Mode vs. Live Stream Mode

| Dimension | File Mode ([practice-bridge-product.md](practice-bridge-product.md), Section 6.4, Option A) | Live Stream Mode ([practice-bridge-product.md](practice-bridge-product.md), Section 6.4, Option B) | Legal Difference |
|---|---|---|---|
| Audio source | Student's local file | Student's browser audio output | **None** — student has access to both |
| Copy created? | Transient RAM buffer | Transient RAM buffer (~15-30s rolling) | **None** — both are transient |
| Written to disk? | No | No | **None** |
| Duration in memory | Rolling ~30s window | Rolling ~15-30s window | Stream mode slightly smaller |
| Student initiated? | Yes (opens file via native picker) | Yes (clicks "Capture Tab Audio") | **None** |
| Output | Instrument-removed audio to headphones | Instrument-removed audio to headphones | **None** |
| Stems exposed? | No | No | **None** |

The two modes are legally identical. If anything, the live stream mode carries *slightly less* risk because:

- **Smaller buffer** — constrained by real-time processing, not file length
- **No seek** — the student cannot rewind or replay processed segments (they are purged)
- **Self-limiting** — the ~15s delay makes this useless for passive listening; only tolerable for deliberate practice
- **No file on disk** — the student never selects, copies, or references an audio file

#### A.4.5 The Delay as Legal Evidence of Educational Purpose

The ~15-second processing delay is a powerful indicator that the feature is designed for practice, not consumption:

- No one would choose to listen to music with a 15-second delay for enjoyment
- The only reason to tolerate this delay is to wait for stem removal so you can **play along and practice**
- This reinforces Fair Use Factor 1 (purpose and character): the use is transformative and educational

### A.5 Grokster Mitigation (MGM v. Grokster, 2005)

The Grokster standard imposes liability for inducement: distributing a product with the object of promoting its use to infringe copyright. The following measures ensure Bassicology does not cross this line:

- Marketing emphasizes music education, not play-along with copyrighted music
- All demos and screenshots use royalty-free, public domain, or Bassicology-original content
- Onboarding starts with original exercises, not stem removal
- No streaming platform is named in marketing, UI, or documentation
- Stem removal is presented as a *practice tool*, not a stem separation product
- Official social media does not engage with user-generated content showing copyrighted song usage
- No features exist that only make sense for the copyrighted music workflow

### A.6 Moises Precedent (Detailed Analysis)

Moises (moises.ai) operates the same product category at massive scale: 70+ million users, AI stem separation (full 4-stem with WAV export), practice tools, song identification, performance scoring. $50.2M raised across three funding rounds, including a $40M Series A led by Connect Ventures (CAA + NEA partnership) with participation from music industry figures including Steve Aoki, Freddy Wexler, and 3LAU. No litigation from any rights holder has been reported despite Moises offering *more* legally exposed features than Bassicology (full stem isolation, stem export, cloud-side processing).

**Why Moises has not been sued — the five pillars of their defense:**

1. **Ethically Trained Models:** Moises trains AI models exclusively on data they own or license. Their General Counsel has 20 years of music licensing experience.

2. **User Responsibility Transfer (Betamax Model):** Moises' Terms of Service require users to affirm they "are the creator and owner of the User Content, or have the necessary licenses, rights, consents, and permissions."

3. **DMCA Safe Harbor Compliance:** Moises maintains active DMCA takedown procedures and terminates repeat infringers. This qualifies for Section 512(c) safe harbor.

4. **No Streaming URL Support:** Moises explicitly refuses streaming service URLs (Spotify, Apple Music, etc.) and explains that DRM-encrypted audio "cannot be extracted or altered by third-party software."

5. **Music Industry Strategic Alignment:** Investors include CAA, Samsung Next, and individual artists. Moises partnered with Audible Magic for content identification and SourceAudio for enterprise stem separation.

**Key insight: Moises' protection is primarily contractual, corporate, and relational — not technical.** They do full stem separation, export isolated stems as WAV, and process audio on their own cloud servers. Bassicology's Practice Bridge operates in this established, tolerated category with a smaller footprint (no isolated stems, local processing only), stronger educational positioning, and a more conservative feature set.

### A.7 Platform Terms of Service Considerations

Spotify, Apple Music, and YouTube all prohibit routing audio through third-party tools in their Terms of Service. However:

- *Van Buren v. United States* (2021) held that ToS violations alone do not constitute criminal CFAA violations
- Consequences of ToS violations are contractual (account termination), not criminal
- Practice Bridge does not integrate with any platform API — it reads local files or receives audio from the browser's `tabCapture` API
- The browser extension uses a standard API also used by recording extensions, accessibility tools, and meeting software

### A.8 International Risk Summary

| Jurisdiction | Risk Level | Key Constraint |
|---|---|---|
| United States | 🟢 LOW-MODERATE | Betamax protective; Moises precedent; no isolated stems reduces exposure |
| European Union | 🟡 MODERATE | Article 4 TDM likely inapplicable; rights holder opt-out available |
| United Kingdom | 🟡 MODERATE-HIGH | No applicable exception; s.29A CDPA non-commercial only |
| Japan | 🟡 MODERATE | Art. 30-4 "enjoyment" exclusion; audio transformation framing helps |
| Canada | 🟡 MODERATE | Fair dealing limited; audio effect framing helps |
| Australia | 🟡 MODERATE-HIGH | No fair use doctrine; narrow fair dealing only |

*Risk levels are reduced across jurisdictions compared to full stem separation because no isolated copies of any component are created. Local-Only Mode ([practice-bridge-technical.md](practice-bridge-technical.md), Section 14.1) further mitigates risk.*

### A.9 Required Legal Infrastructure

- DMCA Agent Registration ($6/3 years) with US Copyright Office → *See Section A.11*
- Notice-and-takedown procedures documented and accessible → *See Section A.11*
- Repeat infringer policy in Terms of Service → *See Section A.11*
- User warranty: "I possess all rights necessary to process this content" → *See Section A.10*
- Stem removal disclaimer: processed audio remains subject to original copyright → *See Section A.10*
- Indemnification clause: students indemnify Bassicology against IP claims → *See Section A.10*
- Limitation of liability capped at 12 months' fees → *See Section A.10*
- Acceptable Use Policy with anti-bulk and anti-commercial-abuse provisions → *See Section A.12*
- Training data provenance documentation for all shipped models → *See Section A.13*
- Age gate: minimum age 13 (COPPA compliance)
- Privacy disclosures: GDPR/CCPA compliant
- Browser extension privacy policy: tab audio is captured locally and never transmitted to servers

### A.10 Terms of Service (Required Before Launch)

The Terms of Service must establish clear user responsibility and legal safe harbor. Key clauses:

**User Content Warranty:**
> "You represent and warrant that you are the creator and owner of the User Content you process through Practice Bridge, or that you have the necessary licenses, rights, consents, and permissions to authorize such processing. User Content must not infringe, violate, or misappropriate any third-party right, including any copyright, trademark, patent, trade secret, moral right, or right of publicity."

**No Ownership Claim on Output:**
> "As between you and Bassicology, Bassicology does not claim ownership of your outputs (instrument-removed audio, practice recordings, scores). You retain all rights in your outputs, subject to the rights of third parties in any underlying content."

**Indemnification:**
> "You agree to indemnify, defend, and hold harmless Bassicology and its officers, directors, employees, and agents from any claims, damages, or expenses arising from your use of the Service, including but not limited to claims arising from User Content that you do not have the right to process."

**Limitation of Liability:**
> "Bassicology's total liability to you for any claims arising out of your use of the Service shall not exceed the total amount of fees paid by you to Bassicology in the twelve (12) months preceding the claim."

**Acknowledgment of Legal Uncertainty:**
> "Copyright law is complex and evolving. Laws differ by jurisdiction. You are responsible for ensuring your use of the Service complies with applicable laws in your jurisdiction."

**User-Generated Content (UGC) Responsibility:**
> "You are solely responsible for any content you post, share, or transmit through the Service, including but not limited to comments, profile information, practice session descriptions, and social posts. You represent that your UGC does not infringe any third-party rights. Bassicology does not endorse, verify, or adopt any user-generated content."

**Leaderboard & Social Feature Terms:**
> "Leaderboard rankings and practice session metadata are generated from anonymous, non-reversible identifiers. Bassicology does not identify, store, or display the titles of songs you practice. Any association between your practice sessions and specific songs exists solely on your device. If you choose to publicly identify a song in connection with your practice activity, you do so at your own discretion and responsibility."

**Right to Remove UGC:**
> "Bassicology reserves the right to remove, disable, or restrict access to any user-generated content at its sole discretion, without prior notice, for any reason, including but not limited to content that references copyrighted works in a manner that may expose the platform to legal risk."

### A.11 DMCA Takedown Procedure (Required Before Launch)

Bassicology must qualify for DMCA Section 512(c) safe harbor. Requirements:

1. **Designated DMCA Agent:** Register with the US Copyright Office ($6/3 years). Publish agent contact information on practicebridge.ai/dmca. Tenants publish their own DMCA contact on their own domains.

2. **Takedown Response Process:**
   - Accept DMCA takedown notices via email (dmca@practicebridge.ai) and web form. Tenants handle their own DMCA processes for tenant-specific content
   - Respond to valid notices within 48 hours
   - Disable access to identified material or functionality as applicable
   - Notify the affected user (counter-notification rights)

3. **Repeat Infringer Policy:** Terminate accounts of users determined to be repeat infringers. Maintain internal records of infringement notices per user.

4. **No Actual Knowledge:** The system architecture ensures neither Practice Bridge's nor Bassicology's servers ever receive song identification data ([practice-bridge-product.md](practice-bridge-product.md), Section 3.4). This establishes that neither platform has actual or constructive knowledge of specific infringing activity.

5. **Good Faith:** Bassicology will remove or disable access to material it believes in good faith is infringing, even absent a formal DMCA notice.

*Note: Because Practice Bridge processes audio locally and no audio reaches any server (Practice Bridge API or Bassicology), the DMCA process primarily applies to: (a) user-generated text content on either platform (forum posts, comments, profile descriptions, social shares, leaderboard annotations), (b) marketing materials, and (c) exercise content disputes. See Section A.17 for UGC-specific shields.*

### A.12 Acceptable Use Policy

**Prohibited Uses:**
- Processing audio from streaming services by circumventing DRM or technological protection measures
- Bulk processing of audio files for commercial redistribution
- Using the Service to create, distribute, or sell isolated stems, bootleg remixes, or unauthorized derivative works
- Operating a business where the Service is used to process an abnormally high number of media files for third parties
- Generating stems for sale as loops, samples, or sound libraries
- Redistributing, sharing, or publicly performing instrument-removed audio without appropriate rights

**Fair Usage Limits (Jam-Along / Stem Removal):**
- **Student tier ($9/mo):** 20 Jam-Along sessions per day. Unlimited exercises (no stem removal needed).
- **Institutional plans:** Limits negotiated per contract. Same daily cap structure.
- Limits are per-user (tracked via PB account), not per-device — prevents scripted abuse without hitting real students.
- A student genuinely practicing 20 different songs in a single day is exceptionally rare. Even 5 is ambitious. These limits target bulk processing abuse, not real practice.
- Values are initial and will be calibrated based on real usage patterns after launch. They can be adjusted without code changes (server-side configuration).
- Usage patterns consistent with personal music practice are unrestricted within the daily limits.

**Streaming Service Restriction:**
- Practice Bridge does not integrate with, connect to, or reference any streaming platform API
- The browser extension captures audio via the browser's standard `tabCapture` API — the same API used by screen recording tools, accessibility software, and meeting applications
- Students are responsible for ensuring their use of captured audio complies with the source platform's terms of service and applicable law

### A.13 Training Data Provenance Strategy

**Current Position (Open-Source Models):**
- HTDemucs community weights are trained on MUSDB18/MUSDB18HQ — a dataset of 150 songs recorded specifically for source separation research
- MUSDB18 is derived from DSD100, which was assembled with explicit permission from artists and labels for academic source separation research
- Community-retrained MIT-licensed weights avoid the CC BY-NC restriction on Facebook's official pretrained weights
- BS-RoFormer (fallback) is trained on similar research datasets with open licenses

**Recommended Documentation:**
- Maintain a written record of every model's training data provenance
- Document the license chain: dataset license → model weights license → Bassicology's usage license
- If provenance cannot be verified for a model, do not ship it

**Future Position (If Budget Allows):**
- Commission or license a custom training dataset of instrument-focused recordings
- Partner with independent artists and music educators to contribute licensed practice recordings
- Use Bassicology's original exercise content as supplementary training data
- This mirrors Moises' approach and provides the strongest possible defense

### A.14 Educational Positioning Strategy

Bassicology's strongest differentiation from general-purpose stem separation tools is its educational mission.

**Fair Use Factor 1 — Purpose and Character of Use:**
- Bassicology is a *learning platform*, not a music manipulation tool
- The primary purpose of stem removal is *practice* — playing along to learn instrument lines
- This is analogous to a music student isolating a passage on a record to learn it by ear
- Educational use is favored under fair use analysis (17 U.S.C. § 107)

**Marketing and Branding Requirements:**
- All marketing emphasizes music education, technique development, and practice improvement
- Hero features in marketing: exercises, scoring, tuner, fretboard visualization, teacher mode
- Stem removal is presented as a *practice tool*, not a stem separation product
- Tagline direction: "Practice better" / "Learn bass" — not "Remove bass from any song"
- All demos use royalty-free, public domain, or Bassicology-original content
- No streaming platform is named in marketing, UI, documentation, or help articles

**Onboarding Flow:**
- New students start with Bassicology's original exercises (zero copyright involvement)
- Stem removal / Jam-Along mode is introduced after the student has engaged with exercise content
- Onboarding emphasizes practice and learning goals
- First-time stem removal use shows a brief educational overlay explaining proper usage

### A.15 Industry Relations Strategy (Medium-Term)

**Advisory Board:** Recruit at least one advisor with music publishing, label, or licensing experience.

**Music Educator Partnerships:** Partner with instrument teachers, music schools, and online educators. These partnerships reinforce the educational positioning.

**Artist Partnerships:** Partner with independent artists to create original practice content. Artists who endorse the platform create a narrative of "musicians supporting musicians."

**Industry Monitoring:** Track litigation and enforcement actions in the stem separation / AI music space. Monitor music industry trade publications for sentiment shifts. Adjust proactively.

### A.16 Comparison: Practice Bridge vs. Moises Legal Position

| Defense Layer | Moises (70M+ users) | Practice Bridge (Planned) | Assessment |
|---|---|---|---|
| **Training Data** | Licensed/owned exclusively | Open-source (MUSDB18 provenance) | Moises stronger; Practice Bridge defensible |
| **User ToS** | Strong user responsibility | Planned (Section A.10) | **Must implement before launch** |
| **DMCA Process** | Active takedown + repeat infringer | Planned (Section A.11) | **Must implement before launch** |
| **Acceptable Use Policy** | Anti-bulk, anti-commercial abuse | Planned (Section A.12) | **Must implement before launch** |
| **No Streaming URLs** | Explicit refusal | No streaming API integration | Equivalent |
| **Stem Exposure** | Full stems + WAV export | Instrument removal only, no stems, no export | **Practice Bridge more conservative** |
| **Processing Location** | Cloud (server-side copies) | Local only (no server-side audio) | **Practice Bridge stronger** |
| **Server Audio Knowledge** | Servers process all audio | Servers receive only anonymous metadata | **Practice Bridge stronger** |
| **Song ID on Server** | Not publicly disclosed | Explicitly local-only, never sent to server | **Practice Bridge stronger** |
| **Disk Writes** | Exports WAV files | No audio written to disk | **Practice Bridge more conservative** |
| **Music Industry Investors** | CAA, Steve Aoki, Samsung Next | None yet | Moises stronger |
| **Educational Positioning** | General musician tool | Music education platform | **Practice Bridge stronger** |
| **User Base** | 70M+ (proven at scale) | Pre-launch | Moises has proven the category |
| **Revenue** | $3.99-$16.99/mo SaaS | Education subscription | Similar model |
| **Leaderboards** | Community features with song names (server-side) | Hash-based, song names client-only, server never sees songs | **Practice Bridge more conservative** |
| **Social Sharing** | Users share with song context on platform | Platform-generated shares never include song names | **Practice Bridge more conservative** |

**Summary:** Practice Bridge is technically more conservative than Moises on every dimension. Practice Bridge's gaps are on the contractual/business side (ToS, DMCA, industry relationships) — all addressable before launch. Moises has proven the product category is viable at massive scale without litigation.

### A.17 Leaderboard & Social Sharing Defense Strategy

Jam-Along leaderboards and social sharing introduce a unique legal surface: students may publicly associate Bassicology's platform with specific copyrighted songs. See [practice-bridge-technical.md](practice-bridge-technical.md), Section 11.3 for the technical implementation.

#### A.17.1 Architectural Shields (Server-Side)

The server's complete ignorance of song identity is the primary defense:

1. **No song metadata on server.** The PB API stores only an opaque `songHash` (SHA-256 of the Chromaprint fingerprint + Practice Bridge salt). Song title, artist, ISRC, and fingerprint are never transmitted to or stored on any server (Practice Bridge or Bassicology).

2. **Non-reversible hash.** The `songHash` cannot be reversed to obtain the fingerprint or song identity. The Practice Bridge-specific salt prevents cross-referencing against AcoustID's public database.

3. **No server-side song name rendering.** Neither the PB API nor Bassicology's API ever returns song names in leaderboard responses. They return `[{songHash, userId, score, ...}]`. Song name resolution happens exclusively on the client.

4. **No "Top Songs" or catalog features.** The server never aggregates, ranks, or displays songs by popularity. No "Most Played Songs" chart, no "Trending" list, no recommended songs.

5. **No song-based search.** Students cannot search the server for "Billie Jean leaderboard." Leaderboards are discovered organically: if you play the same song as someone else, you see each other's scores.

#### A.17.2 Social Sharing Shields

**Platform-generated share content (controlled by Bassicology):**
- Share cards and previews show: **"Practice Session Score: 94.2% — Rank #2 of 2,341"**
- No song name, artist, album art, or any copyrighted metadata appears in platform-generated content
- Share URLs resolve to a page that shows the score, timing breakdown, and rank — but not the song name

**Student-added content (student's speech, not platform content):**
- If a student types "I got 94% on Billie Jean!" — that is the student's speech
- Bassicology did not generate, suggest, or auto-populate the song name
- Legally equivalent to a user posting "I just benched 200 lbs at Planet Fitness"

#### A.17.3 UGC (User-Generated Content) Shields

1. **No auto-population of song names.** The platform never auto-fills, suggests, or displays song names in any server-rendered social context.

2. **DMCA coverage for text UGC.** Section A.11 explicitly covers user-generated text posts.

3. **Repeat infringer policy covers UGC.** Three-strike policy applies to text-based DMCA notices too.

4. **Right to remove.** ToS reserves Bassicology's right to remove any UGC that references copyrighted works, at sole discretion.

5. **No endorsement.** ToS states UGC does not represent Bassicology's views.

#### A.17.4 Anti-Inducement Safeguards (Grokster Defense)

| Potential Inducement Risk | Mitigation |
|---|---|
| "Play Billie Jean" server-side challenges | **Never created.** Server cannot create song-specific challenges because it doesn't know song names. |
| "Top Songs This Week" chart | **Never created.** No server-side song popularity aggregation. |
| "Most Practiced Songs" feature | **Never created.** Server only knows songHashes, cannot display song names. |
| Marketing that references copyrighted songs | **Prohibited.** All marketing uses Bassicology-original content or royalty-free examples. |
| Algorithmic song recommendations | **Never created.** No "Users who played X also played Y" features. |
| Song-specific landing pages | **Never created.** No `/leaderboard/billie-jean` URL. Only `/leaderboard/{songHash}`. |
| Notification: "New high score on Billie Jean!" | **Never sent from server.** Server notifications reference sessions, not songs. Client-side may locally display the song name. |

#### A.17.5 The Critical Legal Distinction

```
┌─────────────────────────────────────────────────────────────┐
│                    BASSICOLOGY'S PLATFORM                    │
│                                                              │
│  ✅ Hosts: opaque hashes, numeric scores, timing metrics    │
│  ✅ Generates: "Score: 94.2%, Rank #2 of 2,341"            │
│  ❌ Never hosts: song names, artist names, album art        │
│  ❌ Never generates: "Billie Jean Leaderboard"              │
│  ❌ Never suggests: specific songs to practice              │
│  ❌ Never aggregates: songs by popularity                   │
│                                                              │
│  The platform is a scoreboard for opaque identifiers.        │
│  It is functionally identical to a fitness app that tracks   │
│  "Workout #a1b2c3" without knowing which gym or exercise.   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    STUDENT'S DEVICE / SPEECH                 │
│                                                              │
│  ✅ Student's client resolves hash → "Billie Jean" (local)  │
│  ✅ Student tweets: "94% on Billie Jean @bassicology"       │
│  ✅ Student names their practice session in their own notes  │
│                                                              │
│  This is user speech. Bassicology did not generate it,      │
│  suggest it, or facilitate it beyond providing a scoreboard. │
└─────────────────────────────────────────────────────────────┘
```

**Legal precedent alignment:**
- **DMCA 512(c):** Bassicology has no actual knowledge of which songs students practice because the server literally cannot resolve songHashes. This is structural no-knowledge, not willful ignorance.
- **Betamax (Sony v. Universal, 1984):** The leaderboard has substantial non-infringing uses — Exercise Mode leaderboards involve zero copyrighted content. The same leaderboard infrastructure serves both.
- **Grokster (MGM v. Grokster, 2005):** No inducement. The platform never references specific copyrighted works. All song-specific context originates from the student's device.
- **Section 230 (Communications Decency Act):** If students post song names in UGC, Bassicology is a platform hosting third-party speech, not a publisher of that content.

### A.18 Song Identification Isolation & AcoustID Data Transfer

Song identification via AcoustID/MusicBrainz is performed entirely within Practice Bridge on the student's device. The results (song title, artist, album) are:

- Displayed in the browser UI for the student's convenience during practice
- **Never transmitted to Practice Bridge's or Bassicology's servers** under any circumstance
- **Never stored in any server-side database or log**
- Discarded from Practice Bridge memory when the session ends

This design ensures that neither platform has a server-side record of which copyrighted songs any student processes.

**AcoustID third-party data transfer:**

The AcoustID lookup is the one point where data derived from the student's audio leaves the device. This requires explicit treatment:

- **What's sent:** A compact Chromaprint fingerprint (~4KB binary spectral signature). This is a one-way representation — the audio cannot be reconstructed from it, but the fingerprint can identify which song was played.
- **Where it goes:** AcoustID (acoustid.org), an open-source service operated by Lukáš Lalinský. The lookup API resolves fingerprints to MusicBrainz recording IDs. AcoustID's database is published under open licenses.
- **Data retention:** AcoustID's API processes lookup queries without persistent per-user logging. However, as a third-party service, their retention policies are not under our control.
- **GDPR implications:** The fingerprint is derived from audio content on the student's device. Sending it to a third-party server constitutes a data transfer. Lawful basis: legitimate interest in song identification for educational scoring display. Must be disclosed in the privacy policy. AcoustID servers are hosted in the EU (Czech Republic), which simplifies GDPR data transfer requirements.
- **Copyright angle:** Does sending a fingerprint derived from copyrighted audio to a third party constitute transmitting "information derived from copyrighted content"? The fingerprint is a compact spectral summary (similar to a perceptual hash) — it does not contain or expose any musical content. This is analogous to how Shazam, SoundHound, and every music identification service operates.

**Opt-in design:** AcoustID lookup should be opt-in, not automatic. The student can practice without song identification entirely — scoring, tuner, exercises, and teacher assignments all work without it. Song identification adds: (a) song name display in the UI, (b) Jam-Along leaderboard grouping via songHash. Neither is essential. The onboarding flow should ask: "Allow song identification? Practice Bridge will send an audio fingerprint to AcoustID to identify songs." with a clear opt-in.

**Fallback when AcoustID is unavailable:** If AcoustID's API is down, slow, or the student opts out: song name shows as "Unknown Song." Leaderboard grouping still works via the locally-computed songHash (which does NOT require AcoustID — it's computed from the Chromaprint fingerprint locally). Scoring works normally. The only loss is the human-readable song name in the UI.

### A.19 Privacy Obligations

**GDPR:** Metadata uploaded to servers (scores, timing, BPM, key, user ID) constitutes personal data. Use contract performance (Article 6(1)(b)) as lawful basis. Song identification data is never uploaded. Purely local audio processing triggers no GDPR obligations. Local-Only Mode processes zero personal data on servers.

**Account deletion (GDPR Article 17 — Right to Erasure):**

The deletion flow depends on where the user's account was created:

**Direct users (practicebridge.ai):**
1. Student requests account deletion from practicebridge.ai settings page
2. PB API deletes: profile, practice_results, sessions, leaderboard_entries, practice_streaks, teacher_feedback (received), class_members entries. Anonymizes any data required for aggregate analytics (e.g., class-wide statistics retain counts but lose the student link).

**Tenant users (e.g., Bassicology):**
1. Student requests account deletion from their tenant platform (e.g., bassicology.com settings page)
2. Tenant calls `DELETE /api/v1/accounts/{pbAccountId}` on the PB API
3. PB API performs the same deletion as above
4. PB API returns confirmation. Tenant deletes its own local data (tenant-specific preferences, exercise history, etc.)
5. PB Desktop app: On next connection, the server returns a "account deleted" status. The desktop app clears cached exercises, local SQLite data, and offline results.

**Timeline:** Deletion completes within 30 days (GDPR requirement). Immediate soft-delete removes the account from all active queries. Hard-delete of backups occurs within 90 days.

**Teacher-owned data:** When a student is deleted, teacher assignment results are anonymized (student name/ID removed, scores retained as anonymous data points for class-wide analytics). Teachers cannot access individual data after deletion.

**Data portability (GDPR Article 20):**

`GET /api/v1/accounts/{id}/export` returns a JSON file containing all user data:
- Profile information (display name, instrument, account creation date)
- All practice session results (scores, timing details, dates)
- Streak history (current, longest, total sessions/minutes)
- Leaderboard entries (song hashes, scores, dates)
- Teacher feedback received
- Assignment history

The export does NOT include: audio (never stored), song names (never stored), data owned by other users (teacher assignments, class rosters), or platform-specific data (which must be exported separately by the client platform).

**COPPA:** Music education commonly serves minors. Minimum age 13 enforced via age gate. If targeting schools, establish COPPA-compliant contracts where schools consent for parents.

**US State Privacy Laws:** Implement CCPA-aligned baseline covering all 20+ state laws in effect.

---

*End of Document — Practice Bridge — practicebridge.ai — February 2026 — v6.0*

*[Product Specification](practice-bridge-product.md) | [Technical Specification](practice-bridge-technical.md) | [Live Lesson Mode](practice-bridge-live-lesson.md) | [Overview](practice-bridge-condensed.md)*
