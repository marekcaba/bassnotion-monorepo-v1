# PRACTICE BRIDGE — Product Specification

**Version 6.0 — February 2026**
**CONFIDENTIAL — practicebridge.ai**

*practicebridge.ai — personalized guided practice sessions, designed by your teacher or by you, delivered every time you sit down to play.*

---

## 1. Executive Summary

The product is not a practice tracker. It is not a music education platform. It is not a curriculum. It is the infrastructure layer between a teacher's pedagogy — or a student's own goals — and the actual practice sessions that happen five times a week. The platform does not teach. The teacher teaches. The student practices. practicebridge.ai makes sure every practice session is as guided, structured, and measurable as the teaching itself.

A violin teacher builds a practice session: "Autumn Leaves bridge — right hand only at 60% tempo until 3 consecutive attempts above 85%, then left hand, then together, ramp to full tempo." She types this in plain language — an AI agent translates her intent into a structured, branching session automatically. She reviews it, adjusts one threshold, assigns it to her studio. That evening, a student opens practicebridge.ai, clicks Start Session. The browser downloads all audio and reference material. The student puts on headphones, positions their phone on a stand pointing at their instrument, and practices. Practice Bridge — either a desktop app for students with audio interfaces, or a mobile app using the phone's microphone and camera — listens: detects every note, measures pitch accuracy, timing, dynamics, streams it all to the browser for real-time scoring. When the student finishes, the teacher sees exactly what happened: "Right hand section passed in 4 attempts. Left hand: still dragging in bar 12. Together at full tempo: 82% accuracy." The teacher adds feedback. The cycle repeats.

Without the desktop or mobile app, the student still practices — the browser plays the session audio, the student plays in the room through their instrument and amp. No scoring, but the session structure still works: conditions based on time or self-assessment ("I nailed it" / "Needs work") instead of scores. The content is fully accessible. The companion apps are the upgrade, not the gate.

**Bassicology-first development strategy (v6.0):** Bassicology — the bass-specific education product — is the first product built on Practice Bridge capabilities. It ships at Week 12-14 in browser-only mode (self-assessment, time-based conditions, no Practice Bridge Desktop required). Practice Bridge Desktop ships as a listener-first tray icon at Week 20-26, adding live scoring. Practice Bridge is extracted as a standalone multi-instrument platform at Week 34-42. This spec describes the full vision; see [practice-bridge-business.md](practice-bridge-business.md), Section 19 for the Bassicology-first build order.

**Practice Bridge** (practicebridge.ai) is the product. Four clean parts:

1. **practicebridge.ai** — a complete SaaS platform. Teacher side: AI-powered session builder, class management, student roster, results dashboard, feedback. Student side: practice dashboard, session player, progress history, scores, streaks, leaderboards. Owns all data — accounts, sessions, scores, assignments, progress. Any instrument. Any teacher. This is what generates revenue.

2. **Practice Bridge Desktop** (optional) — the power user audio engine (Tauri/Rust, system tray). For students with a real audio interface (Focusrite, PreSonus, Roland, etc.) who want professional-quality audio and low-latency monitoring (4-6ms). Listens to whatever is happening inside the computer — DAW output, MIDI, audio interface input, any digital audio source on the machine. Captures instrument input, detects notes via real-time pitch detection, streams data to the browser via localhost WebSocket. Also handles Jam-Along stem removal (AI-powered attenuation of any instrument from the student's own audio files). UI is only an audio source dropdown — nothing else.

3. **Practice Bridge Mobile** (optional) — the companion app for acoustic instruments and beginners. Two jobs simultaneously: audio out (streams session audio to phone headphones) and audio in (phone microphone captures the instrument in the room, streams onset/pitch data to the browser). Also runs computer vision: phone camera watches the fretting hand, extracts coarse hand position via MediaPipe locally on device, sends lightweight position data to the browser. Raw video never leaves the device. Phone + headphones = complete practice setup for every acoustic instrument player, every beginner, every student without an audio interface.

4. **The browser** — the session experience. What every student uses, always. Downloads the session audio package at start (all backing tracks, reference audio, MIDI data — preloaded, not streamed mid-session). Runs the session script: conditions, branching, progression, instructions. Displays scoring data when Desktop or Mobile is connected. Works without either — no browser microphone, no compromised fallback. Clean and honest.

Practice Bridge also includes an AI-powered **stem removal engine** that attenuates any target instrument from audio, enabling play-along practice with real music (Jam-Along mode). All audio processing occurs locally on the student's device. No audio ever reaches any server — only anonymous performance metrics (scores, timing, BPM, key). Song identification is local-only and never transmitted.

**The Programmable Session Builder** is Practice Bridge's core differentiator. Teachers build practice sessions with conditions ("play until 3 consecutive attempts above 85%"), branching logic (if struggling → split into hands-only sections), stacked variations (same passage at increasing tempos), and contextual instructions that surface at exactly the right moment. Teachers can build sessions manually in the UI, describe them in plain language — an AI agent (n8n orchestration layer calling Claude/GPT-4) translates the teacher's intent into session structure automatically — or use **Live Lesson Mode** to capture lessons as they happen and generate sessions automatically from their demonstration and instruction. First session takes 2 minutes of typing (AI builder) or zero typing (Live Lesson Mode), not 45 minutes of learning a UI. This is the teacher's pedagogy, bottled and automated. See Section 4 for the Session Builder specification and [practice-bridge-live-lesson.md](practice-bridge-live-lesson.md) for Live Lesson Mode.

**The .ai in practicebridge.ai is literal.** Year 1: the AI builds what the teacher describes. Year 2: it knows the student's history and builds sessions calibrated to that specific student's weaknesses. Year 3: it draws on aggregate data from thousands of teachers to suggest what the research says works best. The AI session builder is the foundation of the platform's intelligence layer.

**Market context:** Tonara (the closest competitor for music practice tracking) shut down in late 2023, displacing an estimated 15,000-25,000 active teachers who are currently using inferior substitutes. SmartMusic/MakeMusic Cloud ($3/student/month) is the category leader but locked to their content library — teachers cannot upload their own material. The gap: nobody has a platform where the teacher is the content creator, the session is programmable, the platform actually listens to the student play with professional audio quality, and an AI agent eliminates the learning curve.

**Tenant architecture:** Third-party music education platforms (e.g., Bassicology for bass guitar, or any future instrument-specific platform) can integrate via a tenant API, inheriting Practice Bridge's scoring, analytics, and teacher features while providing their own instrument-specific content and UI. Bassicology (bassicology.com) is the first such platform — a bass-specific education product with 3D fretboard visualization and bass pedagogy. In the v6.0 build order, Bassicology ships first as the product (Week 12-14). The tenant API for other platforms is built when Practice Bridge is extracted as a standalone platform at Week 34-42.

The legal and business defense strategy is modeled after Moises AI (70M+ users, $50.2M raised, no litigation) and combines local-only processing, no stem isolation, educational positioning, contractual defenses, and DMCA compliance. See [practice-bridge-business.md](practice-bridge-business.md), Appendix A for the complete legal framework.

---

## 2. The Product: Daily Student Experience

This is the core loop — what happens every day for a student using Bassicology with Practice Bridge.

### 2.1 The Programmable Practice Session

The teacher builds a practice session on practicebridge.ai using the Session Builder (see Section 4 for the full specification). This is not a playlist of exercises — it's a programmable practice script with conditions, branching, and tempo control:

```
┌─────────────────────────────────────────────────────────────┐
│  SESSION: "Autumn Leaves — Bridge Section"                    │
│  Teacher: Ms. Vasquez  |  Instrument: Violin                  │
│  Due: Sunday 11:59 PM                                         │
│                                                               │
│  Step 1: Right hand only @ 60% tempo                          │
│          Metered scoring | Until 3 consecutive above 85%      │
│                                                               │
│  Step 2: Left hand only @ 60% tempo                           │
│          Metered scoring | Until 3 consecutive above 85%      │
│                                                               │
│  Step 3: Both hands together @ 60% tempo                      │
│          Metered scoring | Play 3 times                       │
│                                                               │
│  Step 4: Both hands together @ 80% tempo                      │
│          Expressive scoring | Until self-assessment "Ready"    │
│                                                               │
│  Step 5: Both hands together @ 100% tempo                     │
│          Metered scoring | 3 consecutive above 85%            │
│          Branch: If avg < 70% → return to Step 3              │
│                                                               │
│  Teacher note (surfaces before Step 4):                       │
│  "At this tempo, focus on phrasing — let the melody breathe.  │
│   Don't worry about getting every note perfect."              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 The Practice Session (Core Loop)

**Step 1 — Student opens practicebridge.ai.** They see today's assigned sessions. The page detects Practice Bridge Desktop via WebSocket (`ws://localhost:9876`) — if installed. Green indicator: "Practice Bridge connected — live scoring enabled." No Desktop? No problem: "Play along mode — session audio will play in your browser."

**Step 2 — Session preload.** Student clicks Start Session. The browser downloads the entire session audio package — all backing tracks, reference recordings, MIDI data — before the first step begins. Progress indicator: "Preparing your session... 4 of 6 tracks ready." Everything is local from this point. No mid-session downloads.

**Step 3 — Practice begins.** The session script runs. Step 1: "Right hand only @ 60% tempo." The browser plays the backing track at 60% tempo. If Practice Bridge Desktop is connected, it mixes the backing track with the student's live instrument in headphones (4-6ms latency) and streams note events to the browser for real-time scoring. If no Desktop, the browser plays the backing track and the student plays in the room through their amp — self-assessment buttons replace scoring.

**Step 4 — Conditions and progression.** The student plays the passage. The browser evaluates the condition: "3 consecutive attempts above 85%." Attempt 1: 72%. Attempt 2: 81%. Attempt 3: 88%. Attempt 4: 91%. Attempt 5: 87%. Condition met (attempts 3, 4, 5 all above 85%). The session advances to Step 2.

**Step 5 — Contextual instruction.** Before Step 4, the teacher's note surfaces: "At this tempo, focus on phrasing — let the melody breathe." The student reads it and continues. The right instruction at the right moment.

**Step 6 — Session complete.** The browser shows a session summary: Steps completed, attempts per step, scores, total time. Problem areas highlighted. Student clicks Submit. Anonymous metrics go to practicebridge.ai — no audio, no song name.

**Step 7 — Teacher reviews.** Teacher opens their dashboard on practicebridge.ai. Sees all students' session results. Adds feedback. Student receives notification via their preferred channel. The cycle repeats.

### 2.3 What the Teacher Sees

```
┌─────────────────────────────────────────────────────────────┐
│  SESSION: "Autumn Leaves — Bridge Section"                    │
│  Due: Feb 26  |  12 students                                  │
│  ─────────────────────────────────────────────────────────── │
│                                                               │
│  ✅ Alex M. (violin)    Completed — 4/5 steps, 22 min        │
│     Step 5 (full tempo): 82% avg, branched back once          │
│  ✅ Jordan K. (violin)  Completed — 5/5 steps, 18 min        │
│     Clean pass, no branching                                  │
│  ✅ Sam R. (violin)     Completed — 3/5 steps, 35 min        │
│     Stuck on Step 3 (hands together) — 7 attempts             │
│  ⏳ Maria L. (violin)   In progress — Step 2                  │
│  ⏳ Chris P. (viola)    Not started                           │
│  ...                                                          │
│                                                               │
│  Class pattern: Step 3 (hands together) is the bottleneck     │
│  Common issue: left hand timing in bars 12-14 (6/8 students)  │
│  [Send class feedback] [Export report]                        │
└─────────────────────────────────────────────────────────────┘
```

The real value: "Step 3 is the class-wide bottleneck — I should add a preparatory step for left hand coordination before Thursday."

### 2.4 Self-Learners (No Teacher)

Students without a teacher use practicebridge.ai independently:

- The platform provides a growing library of community sessions and exercises (Practice Bridge-original content — zero copyright involvement)
- Self-learners build their own sessions using the Session Builder, setting personal goals
- Jam-Along is available for song practice with the student's own music
- Scoring, analytics, streaks, and leaderboards replace teacher feedback
- The student is both practitioner and reviewer of their own progress

### 2.5 Without Practice Bridge Desktop or Mobile

**This is the Bassicology v1.0 launch experience.** At launch (Week 12-14), all students use browser-only mode. Practice Bridge Desktop and Practice Bridge Mobile are not yet available. Browser-only mode is not a fallback — it is the primary experience that ships first and generates revenue. Practice Bridge Desktop adds live scoring at Week 20-26. Practice Bridge Mobile adds phone-based input at Week 26-34.

Not every student has an audio interface — but most have a phone. Three tiers:

**With Desktop** (power users with audio interfaces): Full scoring, lowest latency, stem removal, professional audio quality.

**With Mobile** (acoustic instruments, beginners): Full scoring with phone mic (wider tolerances), hand position tracking via camera, session audio through phone headphones. Phone + headphones = complete practice setup.

**With neither** (browser only): The browser plays all session audio through speakers or headphones. The student plays their instrument in the room — no browser microphone, no compromise audio capture. Session conditions based on self-assessment ("I nailed it" / "Needs work") or time limits replace score-based conditions. The session structure, instructions, branching, and teacher feedback all work identically — only live scoring is absent.

Self-assessment is a first-class condition type, not a degraded fallback — teachers can deliberately use it for subjective exercises (e.g., "Does this feel comfortable at tempo?") even for students WITH Desktop or Mobile connected.

---

## 3. Product Definition

### 3.1 Architecture Principle

**Four parts, one product, clear ownership boundaries.**

**Build order (v6.0):** The four components ship incrementally. Bassicology v1.0 (Week 12-14) includes only the browser and server. Practice Bridge Desktop v1 (Week 20-26) adds the audio input path. Practice Bridge Mobile follows at Week 26-34. The architecture is designed for this incremental delivery.

Practice Bridge is a complete platform delivered through four cooperating components:

**practicebridge.ai (Browser)** is the primary interface. Students and teachers log in here. The laptop screen is always the primary display. It hosts the AI Session Builder, session player, teacher dashboard, student dashboard, class management, analytics, leaderboards, and all settings. It plays session audio (backing tracks, reference recordings) through the browser's audio output. When Practice Bridge Desktop or Mobile is connected, the browser receives real-time note events, pitch data, and scoring results. When neither is connected, the browser runs sessions using self-assessment and time-based conditions instead. Browser microphone input is not supported — this is a deliberate product decision (see Section 3.6).

**Practice Bridge Desktop** (optional — power users) is the professional audio engine. For students with a real audio interface (Focusrite, PreSonus, Roland, etc.) who want professional-quality audio and low-latency monitoring (4-6ms). Listens to whatever is happening inside the computer — DAW output, MIDI, audio interface input, any digital audio source on the machine. Captures instrument input, runs pYIN pitch detection and note onset analysis, performs AI stem removal on local files, and streams all analysis results to the browser over localhost WebSocket. It syncs scores and offline data to practicebridge.ai. The student installs it once; it runs in the system tray. UI is only an audio source dropdown — nothing else.

**Practice Bridge Mobile** (optional — acoustic instruments, beginners) is the companion app. Two jobs simultaneously: audio out (streams session audio from the platform to phone headphones — student hears backing tracks, metronome, reference audio through headphones) and audio in (phone microphone captures the instrument in the room, streams onset/pitch data back to the browser via WiFi). Also runs computer vision: phone camera watches the fretting hand or instrument, extracts coarse hand position via MediaPipe locally on device, sends lightweight position data (~20 bytes every 100ms) to the browser. Raw video never leaves the device. This covers every acoustic instrument player, every beginner, every student without an audio interface. Phone + headphones = complete practice setup.

**practicebridge.ai (Server)** owns all persistent data: student accounts, practice results, session definitions, teacher assignments, class rosters, analytics, streaks, and leaderboards. It serves the browser application and exposes a REST API. Tenants (e.g., Bassicology) integrate via the same REST API with S2S authentication.

```
                           TEACHER / STUDENT BROWSER
                          ┌──────────────────────────┐
                          │  practicebridge.ai        │
                          │  Session UI, scoring,     │
                          │  AI session builder,      │
                          │  dashboards               │
                          │  ALL INTELLIGENCE HERE    │
                          └─────┬────────┬────────┬───┘
                  ws://localhost │        │ WiFi   │ HTTPS
                       :9876    │        │        │
              ┌─────────────────┘        │        └──────────────────┐
              ▼                          ▼                           ▼
┌──────────────────────┐  ┌───────────────────────┐  ┌──────────────────────────┐
│  Practice Bridge     │  │  Practice Bridge      │  │  practicebridge.ai       │
│  Desktop (Tauri)     │  │  Mobile App           │  │  (Server + REST API)     │
│  System Tray         │  │                       │  │                          │
│                      │  │  Audio OUT: session    │  │  Accounts, sessions,     │
│  Listens to internal │  │    audio → headphones  │  │  scores, analytics,      │
│  audio / DAW /       │  │  Audio IN: phone mic   │  │  assignments, rosters    │
│  interface           │  │    → onset/pitch data  │  │                          │
│  Streams note events │  │  Vision IN: camera →   │  └────────────┬─────────────┘
│  Handles Jam-Along   │  │    MediaPipe → hand    │               │
│  stem removal        │  │    position only       │     REST API (S2S)
│                      │  │  Latency calibrated    │  ┌────────────┴───────────┐
│  POWER USERS         │  │  at session start      │  ▼                        ▼
│  (audio interface)   │  │                        │  ┌─────────────┐  ┌──────────────┐
└──────────────────────┘  │  ACOUSTIC / BEGINNERS  │  │ Bassicology │  │ Future       │
                          │  (phone + headphones)  │  │ (tenant)    │  │ Tenants      │
                          └───────────────────────┘  └─────────────┘  └──────────────┘

INPUTS BY STUDENT SETUP:
Digital instrument + interface  → Desktop App → browser
Acoustic instrument (no iface) → Mobile App → browser
Electronic drums               → MIDI via Desktop App → browser
Acoustic drums                 → Mobile App at distance → timing only
Piano                          → USB MIDI via Desktop + Mobile camera above keys
```

*Build order: Browser + Server ship at Week 12-14 (Bassicology v1.0). Practice Bridge Desktop at Week 20-26. Practice Bridge Mobile at Week 26-34. Tenant extraction at Week 34-42.*

In the v6.0 build order, Bassicology IS the product at launch — not a tenant. When Practice Bridge is extracted as a standalone platform (Week 34-42), Bassicology becomes the first tenant. Future tenants add instrument-specific content and UX on top of Practice Bridge. Tenants call the Practice Bridge REST API for all practice data operations — they do not duplicate the session engine, scoring, or analytics.

**Session input methods converge to identical data structures.** Sessions can originate from three sources: (1) manual building in the Session Builder, (2) AI-generated from natural language, or (3) automatically generated by Live Lesson Mode during a lesson. From the student's perspective, the session player experience is identical regardless of how the session was created. See [practice-bridge-live-lesson.md](practice-bridge-live-lesson.md) for Live Lesson Mode.

### 3.2 What Practice Bridge Desktop Does (Power User Audio Engine)

- Listen to whatever is happening inside the computer — DAW output, MIDI, audio interface input, any digital audio source
- Capture instrument input from any audio interface via CPAL (4-6ms latency) — or receive MIDI directly for keyboard
- Play exercise backing tracks and stem-processed audio to headphones (sample-accurate, no browser round-trip)
- Mix instrument input + backing audio → headphones in real time
- Run AI stem removal on local audio files (GPU-accelerated via ONNX Runtime) — configurable target: bass, guitar, vocals, drums
- Detect pitch (pYIN algorithm), note onsets, and dynamics in the instrument input (real-time, direct Rust implementation) — frequency range set by `instrumentProfile`
- Detect BPM, key, and beat grid from audio files
- Identify songs via AcoustID fingerprinting
- Stream all analysis results to the browser as structured data over WebSocket

#### 3.2a Practice Bridge Desktop: Listener-First Architecture (v6.0)

Practice Bridge Desktop v1 (Week 20-26) is a subset of the full capability described above. It ships as a listener-first tray icon — a simple application that captures audio, analyzes it, and streams results to the browser. Practice Bridge Desktop is its own product — it works with Bassicology first, but is not a Bassicology feature. The same binary will serve the Practice Bridge standalone platform and all future tenants.

**What Practice Bridge Desktop v1 includes:**
- Tray icon application (Tauri 2.x, macOS + Windows)
- Audio input capture from default device via CPAL
- pYIN pitch detection (`pyin-rs`) for instrument frequencies (range set by `instrumentProfile`)
- Onset detection and dynamics analysis
- Tuner data streaming
- Note event streaming to browser via localhost WebSocket (PB-Audio v1 protocol — see [practice-bridge-technical.md](practice-bridge-technical.md), Section 7.1a)
- Deep link handler (`practicebridge://`)
- `instrumentProfile` message support — defaults to bass, but instrument-agnostic

**What Practice Bridge Desktop v1 does NOT include (added in later milestones):**
- Audio mixer (instrument + backing track → headphones) — Week 26-34
- Backing track playback via CPAL — Week 26-34
- AI stem removal (ONNX inference) — Week 26-34
- BPM/key detection from audio files — Week 26-34
- AcoustID fingerprinting — Week 26-34
- Browser extension tab capture support — Week 26-34
- Multi-take recording — Week 34+
- Offline SQLite storage — Week 34+
- CLI / headless mode — Week 34+

**PB-Audio v1 protocol:** Practice Bridge Desktop v1 announces capabilities `["scoring", "tuner"]` in the WebSocket handshake. As modules are added in later milestones, capabilities expand: `["scoring", "tuner", "stemRemoval", "mixer", "transport"]`. The browser checks the capabilities array and enables/disables UI features accordingly. No breaking changes — the protocol is additive. See [practice-bridge-technical.md](practice-bridge-technical.md), Section 7.1a.

**Why listener-first:** Bassicology v1.0 launches at Week 12-14 in browser-only mode, generating revenue before Practice Bridge Desktop exists. Practice Bridge Desktop v1 adds live scoring as an upgrade at Week 20-26. The full audio engine (mixer, stem removal, backing tracks) ships at Week 26-34. Revenue comes first, architecture is validated incrementally, and Practice Bridge Desktop features are informed by real user feedback from Bassicology.

### 3.2b What Practice Bridge Mobile Does (Companion App)

**Audio out:** Streams session audio (backing tracks, metronome, reference recordings) from the platform to the phone. Student plugs headphones into phone and hears everything through them. The phone replaces Practice Bridge Desktop's headphone mix for students without audio interfaces.

**Audio in:** Phone microphone captures the instrument in the room. The app runs pYIN pitch detection and onset analysis locally on device (via FFI to the shared Rust audio engine), then streams structured note event data (not raw audio) to the browser via WiFi. Audio quality is lower than Desktop (phone mic vs. professional audio interface), but sufficient for scoring — the same pitch detection algorithms apply, with wider tolerance thresholds to account for room acoustics and mic quality.

**Vision in:** Phone camera watches the fretting hand or instrument. Runs MediaPipe Hands locally on device — no raw video ever leaves the phone. Extracts coarse hand position only — not individual fingers, not specific frets, not technique analysis. Just: where is the hand mass on the instrument.

Why coarse position is sufficient: audio knows the pitch, video knows the position zone. Together they resolve the ambiguity that audio alone cannot — which string, which octave, which register the note was played in.

```
Audio: E note detected
Video: hand anchored around 5th fret area
Combined: 5th fret A string — unambiguous
```

This enables the fretboard visualization to show where the student is actually playing — not just what pitch came out. Position shifts are tracked. Register compliance is verifiable.

**Technical implementation:**
- MediaPipe Hands runs locally on phone — no raw video transmitted or stored
- Two-point calibration at session start (nut position + neck join) establishes fretboard coordinate system
- Hand bounding box center mapped to fretboard zone throughout session
- Position data transmitted as lightweight structured data (~20 bytes per update, 10 updates/second)
- Audio and video pipelines are completely isolated — no latency interaction between them
- Latency calibrated at session start with a sync pulse, compensated throughout

**Privacy:** Video processed locally on device. Only structured position data (fret zone numbers) is stored. Raw video is never transmitted, never stored. Explicit consent required during onboarding. Clear data handling statement in terms of service.

**Phase rollout:**
- Phase 1 (launch): Coarse hand position for bass and guitar. Two-point calibration. Works in good lighting.
- Phase 2 (post-launch): Reliability improvements, piano key detection (camera above keyboard), confidence scoring for position data.
- Phase 3 (Year 2+): Technique-specific detection, multi-angle support, additional instruments.

**The phone is positioned and forgotten.** Once placed on a stand pointing at the instrument, the student does not touch it again until the session ends. The laptop screen is always the primary display — all session instructions, scoring, visualization, and navigation live in the browser.

### 3.3 What the Browser Does (Full Platform UI)

**Session Builder** (teacher-facing):
- Build structured practice sessions with steps, conditions, branching, and stacked variations
- Set scoring mode per step (Metered or Expressive)
- Upload reference recordings and backing tracks per step
- Set tempo percentages, contextual instructions, and pass conditions
- Preview sessions before assigning to classes

**Session Player** (student-facing):
- Download entire session package at start (manifest + all audio) — no mid-session downloads
- Display current step instructions, pass condition, attempt counter, and score per attempt
- Play backing tracks and reference recordings through browser audio output
- Advance through session steps based on condition evaluation (automatic with Desktop, self-assessment without)
- Show session progress and branching path taken

**Teacher Dashboard**:
- Class management (rosters, invitations)
- Assignment creation and tracking
- Per-student and class-wide analytics (steps completed, branching patterns, bottleneck detection)
- Feedback tools (per-attempt comments, general notes)

**Student Dashboard**:
- Weekly practice plan and upcoming assignments
- Practice history, scores, streaks, and analytics
- Leaderboards (scored sessions and Jam-Along)

**Instrument Tools** (when Desktop or Mobile is connected):
- Exercise player and transport controls (play, stop, seek, tempo, loop)
- Instrument-specific visualization (consumes playback position and note event streams — e.g., fretboard for bass/guitar, staff for piano)
- Tuner display (consumes pitch/cents data stream)
- With Desktop: stem removal level control, "Open File" button for stem removal (triggers native file picker — browser never touches the audio file)
- With Mobile: fretboard position overlay (consumes hand position data from camera)

**Three tiers of input:**
- **Desktop connected** (power user): Full scoring, tuner, stem removal, lowest latency. Professional audio quality.
- **Mobile connected** (acoustic/beginner): Full scoring (wider tolerances), tuner, hand position tracking, no stem removal. Phone mic audio quality.
- **Neither connected** (browser only): No live scoring, no tuner, no stem removal. Self-assessment buttons replace score-based conditions. Session structure, instructions, and branching work identically. Student plays in the room through their amp — no browser microphone (see Section 3.6).

### 3.4 What the Server Stores

**practicebridge.ai owns all practice data:**
- Student and teacher accounts (profiles, preferences, notification channels)
- Practice sessions (structure, steps, conditions, branching, audio asset URLs)
- Practice results (scores per attempt per step, scoring mode, session progress)
- Note event accuracy data (timing offsets, pitch deviations, dynamics)
- Assignments (session → class mappings, due dates)
- Class rosters and teacher–student relationships
- Analytics (streaks, practice time, progress trends)
- Opaque `songHash` for Jam-Along leaderboards (SHA-256 of fingerprint + salt — non-reversible, cannot identify the song — see [practice-bridge-technical.md](practice-bridge-technical.md), Section 11.3)

**Tenants own their domain-specific data:**
- Instrument-specific content and exercises (e.g., Bassicology owns bass exercises, YouTube sync configs)
- Tenant-specific UX preferences and pedagogy metadata
- Tenants submit practice data to practicebridge.ai via the S2S REST API (see [practice-bridge-technical.md](practice-bridge-technical.md), Section 7.5)

*Latency note: S2S API calls are 50-200ms. This is fine — these carry metadata (scores, assignments), not real-time audio. All real-time audio data flows over the localhost WebSocket at sub-1ms latency.*

*Song identification (AcoustID/MusicBrainz) results are used locally for display only and are never transmitted to Practice Bridge's servers or any tenant's servers. No server has knowledge of which copyrighted songs a user processes. See [practice-bridge-technical.md](practice-bridge-technical.md), Section 10.3 and [practice-bridge-business.md](practice-bridge-business.md), Appendix A.*

### 3.5 What NEVER Leaves the Machine

- Audio files (original or processed)
- Processed audio buffers
- Raw audio input from the instrument (Desktop or Mobile — only structured note events are transmitted)
- Raw video from the phone camera (only structured position data is transmitted)
- Audio fingerprint waveforms (only the compact hash goes to AcoustID's third-party API for lookup)
- Song identification results (title, artist — displayed locally, never sent to any server)
- Any representation of copyrighted audio content

### 3.6 No Browser Microphone Input

Browser microphone input is not supported. There is no instrument capture through the browser's Web Audio API. Without Practice Bridge Desktop or Mobile connected, there is no instrument input at all. Students play in the room, the browser plays the session audio, the full session content is accessible and runs as designed — but scoring requires a connected input source (Desktop or Mobile app).

This is a deliberate product decision:
- **Audio quality:** Browser mic quality is insufficient for professional pitch detection and scoring. Background noise, room reflections, and codec compression degrade the signal below usable thresholds.
- **Latency:** Browser audio input adds 50-200ms of latency on top of already-variable Web Audio API timing. This makes real-time monitoring (hearing yourself through headphones) unusable — the split-ear experience is poor UX.
- **Consistency:** Desktop and Mobile apps control their own audio pipeline end-to-end. The browser cannot. Inconsistent behavior across browsers, operating systems, and permission models creates support burden with no quality payoff.
- **Product clarity:** Two clean input paths (Desktop for power users, Mobile for everyone else) are easier to explain, support, and optimize than a third compromised path.

---

## 4. Programmable Practice Session Builder

The Session Builder is the core feature that differentiates Practice Bridge from every other music practice tool. Teachers build structured, branching practice sessions — not static assignment sheets. The session engine runs the teacher's logic automatically, advancing students through material at the pace their performance dictates.

Teachers create sessions through three input methods: (1) manually in the Session Builder UI, (2) by describing them in natural language for the AI builder (Section 4.11), or (3) by capturing lessons directly using Live Lesson Mode ([practice-bridge-live-lesson.md](practice-bridge-live-lesson.md)). All three produce identical session structures — same steps, same conditions, same scoring, same student experience.

### 4.1 Session Structure

A **session** is an ordered sequence of **steps**. Each step has:

- **Audio assets**: MIDI reference, reference recording (optional), backing track (optional)
- **Instructions**: Contextual text surfaced to the student at the right moment — not a wall of text upfront
- **Scoring mode**: Metered (DTW timing-based) or Expressive (note accuracy + dynamics + completeness, no timing scoring) — set per step
- **Tempo percentage**: 60%, 80%, 100%, or any value — playback speed relative to the original
- **Pass conditions**: One or more conditions that must be met before the student advances

Teachers build sessions in the Session Builder UI on practicebridge.ai, upload audio per step, set conditions and branching, preview the session, and assign it to a class.

### 4.2 Conditions

Conditions are the rules that govern when a student advances from one step to the next. Every condition has a **type** and a **threshold/value**.

| Condition Type | Example | Requires Desktop? |
|----------------|---------|-------------------|
| Score threshold | "3 consecutive attempts above 85%" | Yes |
| Repetition count | "Play this 5 times" | No |
| Time limit | "Practice for 5 minutes" | No |
| Self-assessment | "Does this feel comfortable at tempo?" | No |
| Combined | "Score above 80% OR play 8 times" | Partial |

**Self-assessment is a first-class condition type.** It is not a fallback for students without Desktop — teachers can deliberately use it even for students with Desktop connected. Subjective exercises ("Does this feel musical?" "Can you play this from memory?") are best evaluated by the student, not a scoring algorithm.

When a step has multiple conditions, they combine with AND or OR logic as the teacher specifies. Combined conditions allow graceful degradation: a student with Desktop might pass on score; a student without Desktop passes on repetition count.

### 4.3 Branching

Sessions are not always linear. Teachers can define **branches**: if the student meets a condition, advance forward; if not, divert to a remediation path.

```
Step 1: Right Hand Only (pass: 3× above 80%)
  ├── PASS → Step 3: Hands Together
  └── FAIL (after 8 attempts) → Step 2: Right Hand Simplified
                                   └── PASS → Step 3: Hands Together
```

Branching rules are defined per step:
- **Advance condition**: Met → go to target step (default: next step)
- **Branch condition**: Not met after N attempts → divert to alternate step
- **No dead ends**: Every branch path must eventually lead to a step that can complete the session

The student sees their current step, instructions, and progress. They do not see the branching logic — the session simply guides them to the right material. The teacher sees the full branching tree and can track which paths each student took.

### 4.4 Stacked Variations

A common pattern is practicing the same material at increasing difficulty. Stacked variations are a shorthand for this:

1. Autumn Leaves bridge at 60% tempo → pass condition: 2× above 75%
2. Same material at 80% tempo → pass condition: 2× above 80%
3. Same material at 100% tempo → pass condition: 3× above 85%

The teacher uploads the material once and creates variations by adjusting tempo percentage, pass threshold, or scoring mode per stack level. The Session Builder UI supports "Add variation" as a one-click operation that duplicates a step with adjustable parameters.

### 4.5 Scoring Modes Per Step

Each step specifies its scoring mode independently:

**Metered Scoring** (default): DTW-based timing analysis. The student's note events are compared against the MIDI reference with timing windows. Good for technical exercises, scales, etudes — anything with a definitive "correct" rhythm.

**Expressive Scoring**: Note accuracy (right notes), dynamics (volume contour matches reference), and completeness (all notes present). No timing scoring. Good for rubato passages, expressive interpretation, sight-reading where timing flexibility is expected. Optional reference recording enables comparative dynamics analysis.

The teacher selects the scoring mode when building the step. The browser communicates the mode to Practice Bridge Desktop, which adjusts its analysis pipeline accordingly. See [practice-bridge-technical.md](practice-bridge-technical.md), Section 11 for scoring engine details.

### 4.6 Session Preload

When a student starts a session, the browser downloads the entire session package before the first step begins:

- Session manifest (step definitions, conditions, branching rules, instructions)
- All MIDI reference files for every step
- All reference recordings (if any)
- All backing tracks (if any)

A progress indicator shows download status. No audio is downloaded mid-session — the student's practice flow is never interrupted by loading. The preload model also enables offline-capable session playback in future versions (session data cached locally after first download).

The manifest format is an implementation detail left for development. The conceptual contract: the browser receives everything it needs to run the session autonomously, evaluating conditions and advancing steps without further server requests during practice.

### 4.7 What the Student Sees

During a session, the student's view is intentionally simple:

- **Current step title and instructions** — one step at a time, not the full session tree
- **Pass condition** — displayed in plain language ("Play 3 times above 85%" or "Practice for 5 minutes")
- **Attempt counter** — "Attempt 3 of ∞" (no attempt limit unless the teacher sets one)
- **Score per attempt** — shown immediately after each attempt (with Desktop) or self-assessment prompt (without Desktop)
- **Session progress** — "Step 2 of 5" with a progress bar
- **"Next" button** — enabled when the pass condition is met; the student can also choose to keep practicing

The teacher's branching logic, condition combinators, and remediation paths run invisibly. If the student gets diverted to a remediation branch, they simply see a new step appear — they don't see "you failed, here's an easier version."

### 4.8 Teacher's View of Session Results

After a student completes (or partially completes) a session, the teacher sees:

- Which steps the student completed, skipped, or got stuck on
- The branching path taken (visualized on the session tree)
- Scores per attempt per step (with Desktop) or self-assessment responses (without Desktop)
- Time spent per step
- Class-wide aggregation: "68% of students branched to remediation at Step 3" — identifying material that needs reteaching

### 4.9 Retention and Pedagogical Value

A teacher who builds a deep session library has encoded their pedagogy into a structured, reusable format. This is genuine value:

- Sessions can be reused across semesters and classes
- Branching logic captures the teacher's diagnostic thinking ("if the student struggles here, they probably need X")
- The session library becomes a transferable asset — a new teacher at the same school can inherit it
- Students benefit from structured progression that adapts to their level, not a one-size-fits-all assignment sheet

This is not vendor lock-in — it is the teacher investing in their craft through a tool that rewards that investment.

### 4.10 Example Session: Autumn Leaves Bridge

A piano teacher builds a session for the 8-bar bridge of Autumn Leaves:

| Step | Title | Scoring | Tempo | Pass Condition |
|------|-------|---------|-------|----------------|
| 1 | Right Hand melody | Metered | 60% | 2× above 75% |
| 2 | Left Hand voicings | Metered | 60% | 2× above 75% |
| 3 | Hands Together | Metered | 60% | 3× above 80% |
| 4 | Hands Together at tempo | Metered | 80% | 3× above 80% |
| 5 | Full tempo with expression | Expressive | 100% | Self-assessment: "Does this feel musical?" |

Branching: If a student fails Step 3 after 6 attempts, branch back to Step 1 at 50% tempo. Teacher note on Step 5: "Focus on the descending line in bars 5-6. Let it breathe."

The entire session downloads in one preload. A student with Desktop gets scored on Steps 1-4 automatically and uses self-assessment on Step 5 (teacher's deliberate choice). A student with Mobile gets scored with wider tolerances. A student without either uses self-assessment throughout but follows the same structure, instructions, and branching logic.

### 4.11 AI Session Builder

The Session Builder UI is powerful — but it has a learning curve. The AI Session Builder eliminates it. Teachers type in plain language what they want. An AI agent interprets the intent and assembles the session structure automatically. The teacher reviews, adjusts, and approves.

**Example interaction:**

```
Teacher types:
"I want Elis to practice the C major scale. Start with right hand
only at 60% tempo. She needs 3 correct passes before moving to left
hand. Then hands together. Watch her fingering on the pinky. Total
session about 15 minutes."

Agent builds:
[STEP 1] Right Hand Only — 60% tempo — 3 consecutive above 80%
  Instruction: "Keep finger 4 and 5 curved"
  On pass → Step 2

[STEP 2] Left Hand — 60% tempo — 3 consecutive above 80%
  On pass → Step 3

[STEP 3] Hands Together — 60% tempo — 2 consecutive above 75%
  Instruction: "Left hand sets the tempo — don't rush"
  On pass → Step 4

[STEP 4] Full Tempo — 1 attempt above 80%

Estimated session time: 14-18 minutes
→ Teacher reviews, adjusts anything, approves
```

**Why this eliminates the learning curve:** First session takes 2 minutes of typing, not 45 minutes of learning a UI. Teachers who can describe what they teach can build sessions immediately. The AI translates their pedagogy into platform structure.

**What the AI agent can do beyond simple translation:**
- Pedagogy suggestions based on the piece or exercise described
- Time distribution across sections based on difficulty
- Instrument-aware parameter selection (automatically selects correct scoring mode, input type, tolerance thresholds)
- Multi-week series generation ("build me a 4-week progression on this piece")
- Session library search ("a session similar to this already exists — use as starting point?")

**Architecture:** Teacher input → webhook → n8n workflow → LLM (Claude/GPT-4) interprets intent → structured JSON → Session Builder API creates steps → preview returns to teacher. All orchestrated through n8n. The Session Builder API is the clean interface between the AI layer and the platform — the AI produces the same data structure that the manual builder produces. Live Lesson Mode ([practice-bridge-live-lesson.md](practice-bridge-live-lesson.md)) extends this same n8n pipeline with audio capture and Whisper transcription nodes, producing identical session structures.

**Long-term significance:** The AI session builder is the foundation of the platform's intelligence layer. Year 1: it builds what the teacher describes. Year 2: it knows the student's practice history and builds sessions calibrated to that specific student's weaknesses. Year 3: it draws on aggregate data from thousands of teachers to suggest what the research says works best for a given skill level, instrument, and piece. The `.ai` in practicebridge.ai is literal — not branding.

---

## 5. Instrument Profiles

practicebridge.ai is instrument-agnostic by design. The `instrumentProfile` message (see [practice-bridge-technical.md](practice-bridge-technical.md), Section 7.2) configures Practice Bridge Desktop and Mobile for any instrument at the protocol level. This section defines the pedagogical and technical profiles that govern how each instrument family is detected, scored, and visualized.

### 5.1 Profile Parameters

Each instrument profile defines:

| Parameter | Description | Examples |
|-----------|-------------|----------|
| **Input type** | MIDI, audio, or both | Piano: MIDI. Violin: audio. Guitar: both. |
| **Pitch range** | Minimum and maximum Hz | Bass: 41-400 Hz. Flute: 262-2093 Hz. |
| **Detection mode** | Monophonic, polyphonic, or onset-only | Trumpet: monophonic. Guitar chords: polyphonic. Drums: onset-only. |
| **Tuning system** | Equal temperament, microtonal, or other | Western: equal temperament. Sitar: microtonal reference required. |
| **Known artifacts** | Instrument-specific audio behaviors | Guitar: bends, vibrato. Voice: vibrato, breath. Cello: position shifts. |
| **Scoring approach** | How accuracy is measured | Note accuracy, chord accuracy, onset timing, continuous pitch. |
| **Special handling** | Instrument-specific edge cases | Guitar: capo offset. Piano: sustain pedal. Brass: overtone register. |

### 5.2 Instrument Coverage by Input Type

**Fully solved — monophonic pitch detection (audio via Desktop or Mobile):**
Trumpet, saxophone, flute, oboe, clarinet, bassoon, voice, violin, viola, cello, double bass, recorder, ukulele, banjo, mandolin. These instruments produce one note at a time. pYIN pitch detection (probabilistic YIN — a direct Rust implementation using `pyin-rs`) handles them reliably, with a Hidden Markov Model layer that dramatically reduces octave errors compared to standard YIN.

**Solved with MIDI (via Desktop):**
Piano, electronic drums, electronic keyboards, accordion, guitar (for chord work via MIDI pickup), harp (electronic). MIDI provides perfect note data — no pitch detection needed. The scoring engine receives note-on/note-off events directly.

**Solved with onset-only detection (timing, no pitch):**
Acoustic drums. Electronic kit via MIDI is the recommended and primary drum setup — not a workaround, genuinely the superior solution. For acoustic kit players, drum triggers (Roland RT series, etc.) convert hits to MIDI cleanly. For acoustic kit without triggers: Practice Bridge Mobile at 3-4 meters distance provides timing-only scoring (onset detection, no pitch). **Internal laptop microphone is explicitly not supported for drums** — SPL is too high at close range, signal clips and saturates before any useful detection.

Practice Bridge actively recommends electronic kit or triggers in onboarding for drum students. The platform is honest about what each setup can and cannot score.

**Modified scoring approach:**
- Guitar: chord detection for chord exercises (polyphonic matching), monophonic detection for melody/solo work. Input type switches per exercise.
- Sitar / Indian classical instruments: microtonal tuning reference required. Standard equal temperament scoring does not apply. Custom pitch tolerance maps needed.

### 5.3 Default Input Recommendations by Setup

```
INPUTS BY STUDENT SETUP:
Digital instrument + interface  → Desktop App → browser        (best quality)
Acoustic instrument (no iface) → Mobile App → browser          (phone mic)
Electronic drums               → MIDI via Desktop App → browser (perfect data)
Acoustic drums (triggers)      → MIDI via Desktop App → browser (clean MIDI)
Acoustic drums (no triggers)   → Mobile App at distance → browser (timing only)
Piano (acoustic)               → USB MIDI via Desktop + Mobile camera above keys
Voice                          → Mobile App (or Desktop with mic) → browser
```

---

## 6. User Flows

### 6.0 Design Principles

These principles govern all UX decisions across practicebridge.ai, Desktop, and Mobile:

**The laptop screen is always the primary display.** The student never needs to look at the phone. The phone is a peripheral — audio in, audio out, vision in — but never the UI. All session instructions, scoring, fretboard visualization, and navigation live on the laptop browser.

**Sit down, press Start, play.** The student should be able to begin practicing within 60 seconds of sitting down. No configuration required during a session. All setup (audio source, instrument profile, phone pairing) happens once during onboarding and is remembered.

**The phone is positioned and forgotten.** Once placed on a stand pointing at the instrument, the student does not touch it again until the session ends. The phone is not a second screen — it's a sensor.

**Graceful degradation over silent failure.** When audio confidence drops, the platform says so honestly and falls back to a lower-scoring mode. It never gives wrong data silently. A system that lies to students about their playing destroys trust instantly and permanently.

**The teacher's intelligence runs invisibly.** The student sees the experience — current instruction, pass condition, score, next step. They do not see the script. The teacher's branching logic and conditions are completely transparent from the student's perspective. If the student gets diverted to a remediation branch, they simply see a new step appear — not "you failed."

### 6.1 Flow A: Practice Session (Primary)

The student practices a structured session built by their teacher (or the platform for self-learners) through practicebridge.ai. This is the core product — everything else supports this flow.

**Step 1:** Student logs into practicebridge.ai and opens their assigned session: "Autumn Leaves Bridge — Week 3." The browser downloads the entire session package (manifest + all audio assets) and shows a progress bar. No further downloads occur during practice.

**Step 2:** Session begins. Step 1: "Right Hand melody at 60% tempo." The browser plays the backing track through speakers/headphones. If Practice Bridge Desktop is connected, it captures the student's instrument input, streams note events to the browser, and the browser scores each attempt in real time. If Desktop is not connected, the student plays along and uses self-assessment ("I nailed it" / "Needs work") to advance.

**Step 3:** The student meets the pass condition (2 consecutive attempts above 75%). The session auto-advances to Step 2: "Left Hand voicings at 60% tempo." Same flow.

**Step 4:** Step 3: "Hands Together." The student struggles — after 6 attempts without meeting the 80% threshold, the session branches to a remediation step: "Right Hand simplified at 50% tempo." The student doesn't see "you failed" — they just see a new step appear with simpler material.

**Step 5:** After completing the remediation branch, the student returns to Hands Together and passes. The session continues through tempo ramp steps (80%, then 100%) and ends with a self-assessment step: "Does this feel musical?"

**Step 6:** Session complete. The browser shows a summary: steps completed (5 of 5, including 1 remediation branch), scores per step, total practice time (22 min). All results sync to practicebridge.ai. The student's streak counter increments.

*The session runs the teacher's branching logic automatically. Practice Bridge Desktop (if connected) provides live scoring. Without Desktop, conditions use self-assessment and time limits. The session structure is identical either way — see Section 4 for the full Session Builder specification.*

### 6.2 Flow B: Teacher Assignment Mode

A teacher builds a practice session and assigns it to students. This is the core teacher-student flow — the digital equivalent of "go home and practice this" with structured progression, automatic scoring, and results the teacher can review.

**Teacher builds and assigns a session:**

*This flow describes manual or AI-assisted session building. Teachers can alternatively use Live Lesson Mode to capture sessions during lessons — see [practice-bridge-live-lesson.md](practice-bridge-live-lesson.md) for that workflow.*

**Step 1:** Teacher logs into practicebridge.ai. Opens the Session Builder. Creates a new session: "Billie Jean — Bridge Section."

**Step 2:** Teacher builds the session steps, uploads MIDI references and backing tracks, sets conditions and branching logic (see Section 4 for Session Builder details). For a Jam-Along-based assignment, the teacher can also create steps with song guidance: "Use your own copy of Billie Jean. Focus on bars 12-14."

**Step 3:** Teacher assigns the session to a class: "Monday Jazz Ensemble — Due Feb 26." Sets due date and optional notes.

**Step 4:** Students receive notification via their preferred channel(s): "New assignment from Mr. Garcia: Billie Jean — Bridge Section. Due Feb 26."

**Student practices:**

**Step 5:** Student opens practicebridge.ai. The assignment page shows the session. Student clicks "Start Session." The browser downloads the full session package (manifest + audio). Practice begins.

**Step 6:** The session runs through its steps. With Practice Bridge Desktop connected: live scoring, automatic condition evaluation, branching as the teacher designed. Without Desktop: self-assessment and time-based conditions govern progression.

**Step 7:** For Jam-Along steps, the student opens their own audio file via Practice Bridge Desktop. Desktop processes stem removal, BPM/key detection, and scores the student's playing against the extracted reference. Song identification stays local — never sent to the server.

**Step 8:** Student completes the session. The browser sends results to practicebridge.ai: scores per step, attempts per step, branching path taken, total practice time. No audio, no song name. The assignment status changes to "Completed — Attempt #1."

**Step 9:** Student can retry the session before the due date. Each full attempt is tracked. Progress charts show improvement.

**Teacher reviews:**

**Step 10:** Teacher opens their dashboard on practicebridge.ai. Sees all students' session results ([practice-bridge-technical.md](practice-bridge-technical.md), Section 11.5 for dashboard detail): which steps each student completed, where they branched, scores per step.

**Step 11:** Teacher adds feedback: "Good improvement on timing, Alex. Dynamics still need work on the chorus — try playing the verse quieter to make the chorus pop. See you Thursday."

**Step 12:** Student receives the feedback notification via their preferred channel(s). The cycle repeats.

**Notification delivery:** Students configure their notification preferences during onboarding (and can change them anytime in Settings). Available channels:

| Channel | Delivery | Notes |
|---|---|---|
| **In-app** (default, always on) | Badge + toast next time student opens practicebridge.ai | Zero-config, guaranteed visibility on next visit |
| **Email** | Sends to account email | Opt-in. Includes feedback summary. No song names in email body (privacy). |
| **Push notification** | Browser push (desktop/mobile) | Opt-in. Requires browser permission grant. Shows "New feedback from [Teacher Name]." |
| **SMS** (Track B) | Sends to verified phone number | Opt-in. Carrier charges may apply. Short message: "New feedback on your assignment. Open practicebridge.ai to view." |

Students can enable multiple channels simultaneously. The in-app notification is always active and cannot be disabled — it's the guaranteed fallback. Assignment due-date reminders use the same channel preferences.

practicebridge.ai handles notification delivery directly for its own users. For tenant users (e.g., Bassicology students), the tenant platform can subscribe to notification events via the S2S webhook (`webhook_url` in `platform_integrations`) and deliver via its own infrastructure.

**What flows where:**

```
Teacher's browser          practicebridge.ai (Server)         Student's device
──────────────────         ────────────────────────           ────────────────
Builds session in     ──►  Stores session (steps,        ──►  Shows assigned session
Session Builder            conditions, audio URLs,
                           branching rules)

Assigns to class      ──►  Creates assignment             ──►  Student receives notification
(due date, notes)          (session → class, due date)

                                                               Student starts session.
                                                               Browser downloads package.
                                                               PB Desktop (if connected):
                                                               scoring + stem removal
                                                               (ALL LOCAL)

                           Receives: scores per step,     ◄──  Browser submits results
                           attempts, branching path,            (NO audio, NO song name)
                           practice time

Teacher dashboard ◄──      Returns: per-student and
sees: session results,     class-wide analytics
branching paths,
feedback form
```

**Legal position:** This is the strongest possible scenario. A teacher prescribing curriculum and reviewing student practice results is the foundational act of music education. Practice Bridge digitizes the feedback loop — nothing more. The teacher builds structured sessions with their own pedagogical logic. The student supplies their own audio for Jam-Along steps. The platform transmits only performance metrics. No copyrighted content touches the server at any point.

### 6.3 Flow C: Platform Exercise Mode

The student practices exercises from the Practice Bridge exercise library or teacher-uploaded content.

**Step 1:** Student opens practicebridge.ai and navigates to an exercise (from the platform library, a teacher's uploaded content, or a tenant's content like Bassicology bass exercises). The page detects Practice Bridge Desktop via WebSocket (`ws://localhost:9876`).

**Step 2:** If Practice Bridge Desktop is not running, the page shows "Launch Practice Bridge" which triggers the `practicebridge://connect` deep link. Desktop launches and connects automatically.

**Step 3:** The browser sends `{cmd: "loadExercise", id: "abc123", audioUrl: "..."}`. Practice Bridge Desktop downloads the backing track audio to its local cache and confirms ready.

**Step 4:** Student clicks Play. The browser sends `{cmd: "play"}`. Practice Bridge Desktop starts playing the backing track mixed with the student's live instrument input to headphones. Desktop streams playback position to the browser at 60fps. The browser renders the instrument visualization and exercise notes in sync.

**Step 5:** As the student plays, Practice Bridge Desktop detects notes via `tract` and streams note events to the browser. The browser compares note events against the exercise reference pattern and computes a score in real time, displaying live feedback.

**Step 6:** On completion, the browser sends the final score and accuracy metrics to practicebridge.ai via HTTPS REST API. The score appears on the student's profile, leaderboard, and practice history.

*No stem removal is involved. No copyrighted content is involved. The student is practicing platform-owned or teacher-uploaded educational content.*

### 6.4 Flow D: Jam-Along Mode (Stem Removal)

The student wants to play along to a song with their instrument removed.

**Step 1:** Student navigates to the Jam-Along page on practicebridge.ai. Two options for providing audio:

- **Option A: Local File (recommended)** — student clicks "Open File" in the browser. The browser sends `{cmd: "openFileDialog"}` to Practice Bridge, which opens a native OS file picker via Tauri's dialog API. The student selects a file. **Practice Bridge reads the file directly from disk — no audio data passes through the browser.**
- **Option B: Browser Extension (tab capture)** — student clicks "Capture Tab Audio" in the browser extension. The extension captures tab audio via `chrome.tabCapture` API and streams raw PCM to Practice Bridge over the localhost WebSocket.

**Step 2 (File mode):** Practice Bridge begins playing the original full mix to headphones immediately (zero wait). In the background, the stem removal engine processes the audio. Simultaneously, lightweight analysis runs: BPM detection (~2-3s), key detection (~3-4s), beat grid locking (~6-8s), AcoustID fingerprinting. Analysis results stream to the browser as they become available.

**Step 2 (Tab capture mode):** The browser tab is muted at the OS level — Practice Bridge becomes the sole audio output. Phase 1: Practice Bridge immediately routes the captured PCM to headphones as a passthrough — the student hears the full mix + their live instrument with no silence gap. Analysis runs in real time. After ~14 seconds, Phase 2: Practice Bridge crossfades from passthrough to the instrument-removed mix (see Section A.4.3 for legal analysis).

**Step 3:** When stem removal is ready, the browser receives `{type: "stemRemoval", status: "ready"}`. The browser shows an attenuation toggle/slider. The student activates it. Practice Bridge crossfades from the full mix to the stem-removed audio in headphones.

**Step 4:** The student plays along. They hear everything-minus-their-instrument + their own live input in headphones. Practice Bridge continues streaming note events to the browser for optional scoring.

**Step 5:** On completion, the browser sends performance metadata (score, BPM, key, accuracy) to the server. Song identification remains local and is never sent to the server. No audio is ever uploaded. On session close, all audio buffers in Practice Bridge's RAM are zeroed and deallocated.

### 6.5 Flow E: First-Time Setup & Onboarding

A new student signs up for Practice Bridge. Two paths: with Desktop (full experience) or without (browser-only).

**Path 1: With Practice Bridge Desktop**

**Step 1:** Student signs up on practicebridge.ai. The onboarding flow starts with instrument selection and "What's your level?" assessment — pure web, no Desktop needed. Tenant users (e.g., from Bassicology) are auto-provisioned via the S2S API.

**Step 2:** Student reaches the first interactive exercise. The page detects no Desktop connection and displays: "To get live scoring and low-latency audio, install Practice Bridge Desktop." Download button offers macOS (.dmg) or Windows (.exe) based on detected OS.

**Step 3:** Student downloads and installs Practice Bridge Desktop. On macOS: drag to Applications. On Windows: standard installer. Desktop auto-launches and appears in the system tray. No main window opens.

**Step 4:** The browser page auto-detects Desktop via WebSocket. The connection indicator turns green. "Practice Bridge connected. Plug in your instrument."

**Step 5:** Desktop detects the audio interface and streams input level to the browser. The browser shows a level meter: "We can hear your instrument! Play a note." The student plays — the browser shows the tuner confirming pitch.

**Step 6:** "Choose your output device." Desktop lists available audio outputs. The student selects headphones. Desktop plays a quick test tone. "Can you hear this? ✓"

**Step 7:** Setup complete. The student lands on their first exercise or assigned session. The experience from here is Flow A or Flow C.

**Path 2: Without Practice Bridge Desktop**

**Step 1:** Same signup and assessment on practicebridge.ai.

**Step 2:** Student reaches the first exercise. The page offers Desktop installation but also shows: "Or continue without Desktop — you can practice with self-assessment." The student chooses to continue.

**Step 3:** The student practices sessions using browser audio playback and self-assessment buttons. Live scoring, tuner, and stem removal are not available, but session structure, instructions, branching (using self-assessment and time-based conditions), and teacher feedback all work.

**Step 4:** At any point, the student can install Desktop to upgrade their experience. No re-registration needed — Desktop connects to the same account automatically.

*The entire onboarding happens in the browser. Desktop install is optional and never blocks practice. Students without Desktop still get structured sessions, teacher assignments, and analytics — just without live scoring.*

### 6.6 Flow F: Chromatic Tuner (Always-On)

**Step 1:** Student clicks the tuner icon in the top bar. The browser sends `{cmd: "startTuner"}` to Practice Bridge Desktop.

**Step 2:** Practice Bridge Desktop streams tuner data at 30fps: `{type: "tuner", note: "E2", cents: -3.2, freq: 82.1}`. The browser renders a tuner display.

**Step 3:** Student tunes each string. E2 ✓, A2 ✓, D3 ✓, G3 ✓. Optional: alternate tuning suggestions based on the current exercise.

**Step 4:** The tuner remains active in a compact strip while navigating. No audio leaves the machine. No tuner data is sent to the server.

### 6.7 Flow G: Multi-Take Practice Session

The student practices the same passage multiple times and compares attempts.

**Step 1:** Student is on an exercise or Jam-Along page. They click "Record Takes." The browser sends `{cmd: "startRecording"}`.

**Step 2:** Practice Bridge records the student's input to a local RAM buffer (not disk). Each take is tagged with a timestamp.

**Step 3:** Student plays Take 1. The browser receives note events and computes a score. "Next Take." Practice Bridge saves Take 1's note events and starts recording Take 2.

**Step 4:** After 3-5 takes, the student clicks "Compare." The browser displays a side-by-side comparison: timing accuracy, pitch deviation, velocity consistency, overall score progression.

**Step 5:** "Play Back Take 3" — Practice Bridge plays back the recorded audio from RAM through headphones. The browser overlays the playback position on the fretboard.

**Step 6:** On session close, the best score goes to the server. Audio recordings are purged from Practice Bridge RAM. Only note event metadata is retained locally in SQLite.

*Take recordings are the student's own performance — zero copyright involvement.*

### 6.8 Flow H: Song Discovery & Guided Practice

The student loads a song and the platform provides structured practice guidance.

**Step 1:** Student opens a local audio file in Jam-Along. Practice Bridge runs analysis: BPM (120), key (Em), AcoustID identifies it as "Come Together" by The Beatles.

**Step 2:** The browser displays song metadata (locally — never sent to server). Below the player: "This song is in E minor at 120 BPM. The bass line uses the E minor pentatonic scale."

**Step 3:** "Want to practice the scale first?" The student clicks and enters a platform E minor pentatonic exercise (Flow C). This is platform-owned or teacher-uploaded content, keyed to the detected key.

**Step 4:** After warming up, the student returns to Jam-Along. The browser shows the instrument visualization with E minor pentatonic positions highlighted. The student activates stem removal and plays along.

**Step 5:** After the song, analytics: "You played 87% of notes in E minor pentatonic. You tend to rush the root notes by 15ms."

*Song identification stays local. Practice suggestions are derived from BPM/key (uncopyrightable facts). Exercises are platform-owned educational content.*

### 6.9 Flow I: Offline / Local-Only Practice

The student practices without internet.

**Step 1:** Student has previously used practicebridge.ai while online. Practice Bridge Desktop has cached exercise backing tracks and session audio. The browser has cached the app shell via service worker.

**Step 2:** Student opens practicebridge.ai offline. The service worker serves the cached app. The browser connects to Practice Bridge Desktop on localhost — this works without internet.

**Step 3:** The browser shows cached exercises. Student selects one. Scoring works against cached reference patterns. Tuner works. Fretboard works. Everything runs locally.

**Step 4:** Scores are saved to Practice Bridge's local SQLite database.

**Step 5:** When the student reconnects, Practice Bridge syncs accumulated scores directly to practicebridge.ai (the PB desktop → PB API sync channel). The browser prompts: "Synced 4 practice sessions." Local SQLite data is marked as synced.

**Offline sync and assignment due dates:** Each offline result includes a `practiced_at` timestamp recorded by PB Desktop at the time of practice (from the device clock). When syncing, the PB API uses `practiced_at` — not the sync timestamp — to determine whether the submission falls within the assignment's due date. If the student practiced before the deadline but synced after, the submission is accepted as on-time. The teacher's dashboard shows both timestamps: "Practiced: Sun 11:45 PM | Synced: Mon 9:12 AM" so the teacher has full visibility. If the device clock is clearly skewed (e.g., `practiced_at` is in the future or more than 48 hours before the sync), the PB API flags the submission with a `clock_skew_warning`. The teacher's dashboard shows these flagged submissions with a yellow indicator and three resolution options:

- **Accept as on-time** — teacher trusts the student (e.g., known timezone or travel issue). Clears the flag.
- **Accept as late** — submission counted but marked as late. Affects only the late indicator, not the score.
- **Request resubmission** — teacher asks the student to practice again. The original attempt stays in the record as "disputed."

If the teacher takes no action within 7 days, the submission auto-accepts as on-time (benefit of the doubt). The clock skew flag is informational — it never auto-rejects a submission. Most clock skew is innocent (timezone misconfiguration, dead CMOS battery, travel).

*Jam-Along also works offline with local audio files.*

### 6.10 Flow J: Practice Bridge Auto-Update

**Step 1:** On launch, Practice Bridge checks for updates via Tauri's built-in updater. If available, it downloads in the background.

**Step 2:** The student is mid-practice. Practice Bridge does NOT interrupt. The update waits.

**Step 3:** When the session ends (or Practice Bridge has been idle 10+ minutes), Practice Bridge applies the update and restarts. The browser shows "Practice Bridge is updating..." for 2-3 seconds, then reconnects. On reconnection, the version handshake ([practice-bridge-technical.md](practice-bridge-technical.md), Section 7.2) detects if the browser's cached JavaScript is incompatible with the updated PB desktop, and prompts a page refresh if needed.

**Step 4:** For model updates (new ONNX file), Practice Bridge hot-swaps on the next Jam-Along session. No restart needed.

*Updates never interrupt practice.*

### 6.11 Flow K: Practice Bridge Desktop Not Installed (Browser-Only Mode)

**This is the Bassicology v1.0 default mode.** At launch (Week 12-14), all students use Browser-Only Mode. It is the primary experience, not a fallback. The session structure, instructions, branching, and teacher feedback work identically to the Practice Bridge Desktop-connected experience — only live scoring is absent (replaced by self-assessment and time-based conditions). Practice Bridge Desktop adds live scoring when it ships at Week 20-26.

Practice Bridge does not use the browser's microphone. Without Practice Bridge Desktop, the browser cannot hear the student's instrument — but practice still works.

**Step 1:** Student opens practicebridge.ai. WebSocket connection to Practice Bridge Desktop fails (not installed or not running).

**Step 2:** The browser enters "Browser-Only Mode." Sessions, exercises, and assignments all work. The browser plays audio (backing tracks, reference recordings) through the student's speakers or headphones. The student plays their instrument in the room through their amp.

**Step 3:** Conditions based on scoring are replaced with self-assessment ("I nailed it" / "Needs work") and time-based conditions ("Practice for 5 minutes"). The session structure, instructions, and branching work identically — only live scoring is absent.

**Step 4:** A persistent but non-intrusive banner suggests: "Install Practice Bridge Desktop for live scoring, a chromatic tuner, and low-latency audio." CTA links to download.

**Step 5:** Jam-Along mode (stem removal) is not available without Desktop. "Jam-Along requires Practice Bridge Desktop for local audio processing. [Install Desktop]"

*The browser is a full practice platform, not a demo. Self-assessment is a first-class condition type (see Section 4.2). Desktop adds live scoring and stem removal — it's the upgrade, not the gate.*

### 6.12 Flow L: Institutional / Classroom Mode

For music schools and conservatories with multiple teachers and hundreds of students:

**Step 1:** School administrator creates an institutional account on practicebridge.ai. Adds teachers. Each teacher gets a Session Builder and dashboard.

**Step 2:** Teachers create classes: "Monday Jazz Ensemble," "Beginner Guitar — Fall 2026," "Advanced Bass Techniques."

**Step 3:** Students are invited via class code or email. Students sign up on practicebridge.ai and optionally install Practice Bridge Desktop (free). They join their classes.

**Step 4:** Teachers build sessions in the Session Builder and assign them to entire classes or individual students. Students practice using the same flows above.

**Step 5:** Teacher's dashboard shows the class-wide view (Section 2.3). Reports can be exported for institutional records. All data is performance metrics — no audio leaves the student's machine.

---


*Continue to [Technical Specification](practice-bridge-technical.md) | [Business & Strategy](practice-bridge-business.md) | [Live Lesson Mode](practice-bridge-live-lesson.md) | [Overview](practice-bridge-condensed.md)*
