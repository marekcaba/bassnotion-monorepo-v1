# PRACTICE BRIDGE — Live Lesson Mode

**Version 6.0 — February 2026**
**CONFIDENTIAL — practicebridge.ai**

*This document extends the core specification (v6.0). For product context, see [practice-bridge-product.md](practice-bridge-product.md). For technical details, see [practice-bridge-technical.md](practice-bridge-technical.md). For business and legal context, see [practice-bridge-business.md](practice-bridge-business.md).*

---

## 1. Executive Summary

This document describes a significant product evolution agreed during strategic planning in February 2026. The core spec (v6.0) describes the full platform. Live Lesson Mode is an additive capability — a new input method that generates the same session structure the platform already supports. Nothing in the existing architecture changes. Everything in this document extends it.

The original product vision — Desktop app in the tray, listening, scoring student practice — is intact. What this addendum adds is the other end of the loop: capturing the lesson as it happens so the practice session builds itself automatically.

---

## 2. The Core Insight

Music teaching has used the same workflow for centuries:

1. Teacher and student meet for a lesson.
2. Teacher writes in a notepad what the student needs to practice this week.
3. Student practices during the week, loosely guided by those notes.
4. Teacher has no visibility into what actually happened. Cycle repeats.

The core Practice Bridge specification solved steps 3 and 4. The student practices with the Practice Bridge Desktop app listening and scoring. The teacher sees exactly what happened. The feedback loop closes.

Live Lesson Mode solves step 2. Instead of the teacher writing notes, the platform captures the lesson as it unfolds and generates the structured practice session automatically. The teacher's workflow does not change. The platform wraps around what they already do.

**The output of Live Lesson Mode is identical to a session built in the Session Builder.** Same data model. Same student player. Same scoring. Same dashboard. Live Lesson Mode is purely an alternative input method.

---

## 3. Product Positioning

Before this addendum, Practice Bridge was:

> *"The platform that makes practice sessions as structured and measurable as the teaching itself."*

After this addendum, Practice Bridge is:

> *"The platform that turns every lesson into a practice plan automatically."*

No competitor does this. The closest analog is ambient AI clinical documentation in medicine (Nabla, Abridge) — tools that listen to doctor-patient conversations and generate clinical notes automatically. The doctor does not change how they practice medicine. The documentation builds itself around them. Same insight, applied to music education for the first time.

---

## 4. The Complete Product Loop

The core specification delivered the middle and right side of this loop. This document delivers the left side.

```
LESSON                          PRACTICE                       NEXT LESSON
───────────────────────────    ──────────────────────────    ──────────────────────────
Teacher demonstrates.           Desktop listens.              Teacher sees exactly
Platform captures.              Scores in real time.          what happened.
Session builds automatically.   Data syncs.                   Informs next lesson.

NEW — This document              Exists in core spec           Exists in core spec
```

---

## 5. Live Lesson Mode — Full Specification

### 5.1 Overview

Live Lesson Mode is a distinct UI mode activated by the teacher at the start of a lesson. It is not embedded in the Session Builder. It is a separate entry point optimised for one-handed, partial-attention use while teaching. Its entire purpose is to capture the lesson with minimum friction and generate a structured practice session as a byproduct.

### 5.2 The UI — Three Elements Only

The Live Lesson screen has exactly three elements. Nothing else. Complexity belongs in the post-lesson review, not during the lesson.

| Element | Description |
|---------|-------------|
| **Tempo Wheel** | Large scrollable wheel. Teacher sets the target practice tempo. Click track plays immediately as they scroll — no separate play button. This is the demonstration tempo, the exact BPM the student will practice all week. |
| **Record Button** | Large, central, unmissable. Tap once: 4-beat countdown fires. Recording begins. Tap again: recording stops and files automatically. No save dialog. No naming required. The step is queued for background processing immediately. |
| **Captured Steps** | Running list below the record button. Each captured step appears as a card: thumbnail waveform, duration, auto-detected domain tag (pending or confirmed). Teacher can see what has been captured at a glance. No editing during the lesson. |

### 5.3 The Capture Flow — Step by Step

This is the moment-by-moment experience during a lesson:

1. Teacher is mid-lesson. Wants to demonstrate a passage. Opens Practice Bridge (already running — system tray on Desktop, browser tab for teacher dashboard).
2. Teacher taps Live Lesson mode. One tap. Full-screen lesson UI appears.
3. Teacher scrolls the tempo wheel to the target BPM. Click track starts in headphones immediately. Student hears it. Teacher hears it. They can play a trial run together.
4. Teacher taps Record. 4-beat countdown. Platform begins capturing audio from all available inputs (Desktop mic or audio interface, whichever is active).
5. Teacher plays the passage exactly as they want the student to practice it. Teacher may speak before, during, or after the take — all captured.
6. Teacher taps Record again to stop. Step files itself. n8n pipeline picks it up asynchronously. Teacher continues the lesson without waiting.
7. This repeats for each passage, technique point, or concept covered in the lesson. Each capture takes approximately 10-15 seconds of teacher attention.
8. End of lesson: teacher taps Finalize. Review screen opens. All steps are already processed and tagged. Teacher reviews in 60-90 seconds, makes any corrections, taps Assign. Done.

**The teacher never types anything during the lesson.** The session builds entirely from what they play and what they say.

### 5.4 Audio Capture Architecture

Three distinct audio windows are captured for every step:

| Window | Content | Output |
|--------|---------|--------|
| **Pre-take** | Teacher speaking before playing. *"I want you to focus on the bow arm here — keep it parallel to the bridge."* | Instruction text for the session step. Whisper transcription. Teacher's exact words. |
| **Take** | Teacher performing the passage. Captured against the click track (tempo ground truth is the wheel setting, not detected). Click track removed via AEC pipeline — see below. | Reference recording (clean, no click). Filed as the backing track for this session step. Student plays against this. |
| **Post-take** | Teacher commenting after playing. *"Notice how I stayed back on beat three — that's the point of tension."* | Teacher's Note appended to the step. Displayed to student after they complete the step. |

**The platform captures only bounded windows around each record tap. There is NO continuous ambient recording. Privacy is structurally enforced, not policy-stated.**

**Click track removal (Take window):** The teacher hears the click track through the device speaker while recording. The platform removes the click from the recording automatically using a three-tier AEC pipeline: (1) native platform echo cancellation in real-time on-device, (2) server-side adaptive filter + spectral subtraction post-upload, (3) ML source separation for edge cases. The click is never stored as audio — it is always regenerated from tempo metadata, giving students independent control over click sound, volume, and tempo. The teacher is unaware this processing occurs. Full technical specification: [practice-bridge-technical.md](practice-bridge-technical.md), Section 10b.

### 5.5 Voice Transcription — Whisper

Pre-take and post-take audio is transcribed using OpenAI Whisper. This runs locally on the teacher's machine via the Practice Bridge Desktop app (Whisper.cpp or equivalent Rust binding). No audio leaves the device for transcription.

- **Default mode:** Local inference. Whisper small or medium model. Latency: 10-20 seconds for a 30-second segment. Processing completes before end-of-lesson review.
- **Fallback mode (underpowered hardware):** Opt-in Whisper API. Short bounded audio segment only. Deleted after transcription. Teacher consents explicitly in settings.
- Whisper performs well on music education vocabulary: legato, pizzicato, rubato, arco, sul tasto, etc. Domain-specific terms transcribe accurately.
- Transcription errors are correctable in the end-of-lesson review screen. Teacher sees the transcribed text and can edit before assigning.

### 5.6 Tempo Ground Truth

The tempo wheel setting IS the ground truth BPM. The platform does not attempt to detect tempo from the teacher's recording. The teacher sets the target tempo before recording. The click track plays at that exact BPM. The beat grid is mathematically derived from the wheel setting.

This is a deliberate architectural decision. Teacher recordings may include expressive timing — slight push/pull, rubato, phrasing variation. The scoring engine evaluates the student against the beat grid (the intended tempo), not against the teacher's exact micro-timing. This is pedagogically correct: the student should learn to play in time, not to copy the teacher's expressive deviations.

### 5.7 Teacher Recording as Reference Track

The teacher's performance recording is the backing track for the session step. This replaces the need for the teacher to source or upload third-party audio. Key implications:

- **No copyright involvement.** The teacher owns their own recording.
- **Pedagogically superior** to generic backing tracks. Student is matching their specific teacher, not a studio musician.
- **High switching cost.** Once a teacher has 30-50 steps with their own recordings attached, their teaching history is inside Practice Bridge. They cannot leave.
- **Stored as teacher-owned content** on the server. Delivered to students as session audio at session start (preloaded per [practice-bridge-product.md](practice-bridge-product.md), Section 4.6). Not raw audio in the traditional copyright sense — it is pedagogical content created by and owned by the teacher.

---

## 6. Domain Evaluation — Session Quality Score

After the n8n pipeline processes each step, a second AI node evaluates the session for domain coverage. This is a two-node chain:

- **Node 1 (Session Builder):** Generates structured session steps from teacher captures. Already specified in the core specification ([practice-bridge-product.md](practice-bridge-product.md), Section 4.11).
- **Node 2 (Domain Evaluator):** Takes the structured steps as input (not raw teacher text). Analyzes instruction text, transcribed voice, and scoring mode per step. Outputs a domain coverage profile for the session.

The domain taxonomy is instrument-configurable via the `instrumentProfile` system ([practice-bridge-technical.md](practice-bridge-technical.md), Section 7.2). For Bassicology tenants this maps to the 17-domain framework. For general Practice Bridge users a default 8-domain taxonomy covers: Technique, Tone, Timing/Rhythm, Ear Training, Expression/Dynamics, Sight Reading, Theory, and Repertoire.

The Session Quality Score surfaces in the end-of-lesson review screen as a simple domain coverage bar — not a grade, not a number. Descriptive only. Example: *"This session focuses heavily on Technique. Ear Training has not appeared in this student's sessions for 3 weeks."* The teacher decides what to do with that. The platform does not prescribe.

**The domain evaluator runs on structured session data, not vague natural language. Signal quality is high. Confidence scores below a threshold surface as "Unclassified" rather than a wrong tag.**

---

## 7. End-of-Lesson Review Screen

This is the only moment in Live Lesson Mode that requires deliberate teacher attention. It is designed to take 60-90 seconds maximum.

| Screen Element | Detail |
|----------------|--------|
| **Step list** | All captured steps in order. Each shows: waveform thumbnail, duration, transcribed instruction text, teacher note, auto-detected domain tag. Teacher can reorder via drag, delete a step, or edit the transcribed text. |
| **Domain coverage** | Visual bar showing domain balance across the session. Informational only. No score, no judgment. |
| **Add step manually** | Teacher can add a text-only step (e.g., ear training reminder, theory note) without a recording. This is the only manual input available in this flow. |
| **Assign button** | One tap. Session assigned to this student immediately. Student sees it in their dashboard. Teacher returns to lesson or closes app. |

---

## 8. Privacy Architecture

Live Lesson Mode introduces new audio capture that requires explicit privacy treatment beyond the core framework ([practice-bridge-business.md](practice-bridge-business.md), Appendix A).

### 8.1 Consent Flow

When the teacher activates Live Lesson Mode for the first time, a one-time consent screen appears. It states clearly:

- Live Lesson Mode captures audio in bounded windows around each Record tap.
- There is no continuous ambient recording at any time.
- Audio is processed locally on this device. It is not streamed to any server during capture.
- Teacher recordings are stored as your teaching content and delivered to your assigned students only.
- Voice transcription runs locally by default. If your device cannot support local transcription, you may opt in to API transcription — a short audio segment will be sent to OpenAI's Whisper API and deleted after transcription.
- Students and parents must be informed that lessons may include audio capture. Practice Bridge provides a template disclosure for studio use.

**Lessons involving minors require particular care.** Practice Bridge provides a COPPA-aligned parental disclosure template. Teachers are responsible for obtaining appropriate consent from students and parents before using Live Lesson Mode.

### 8.2 Data Classification — New Data Types

| Data Type | Storage | Notes |
|-----------|---------|-------|
| Teacher performance recording | Server (teacher content) | Teacher owns this. Delivered to assigned students as session audio. Never public. |
| Transcribed instruction text | Server (session step) | Text only. Audio discarded after transcription. Stored as session metadata. |
| Raw pre/post-take audio | Never stored | Processed locally and discarded. Only the transcription survives. |
| Tempo wheel setting | Server (session step) | Stored as numeric BPM. Beat grid derived mathematically. |
| Domain tags | Server (session step) | AI-generated. Correctable by teacher in review. |

---

## 9. Impact on Build Order

Live Lesson Mode does not block any existing milestone. It ships as part of the Week 14-20 milestone (AI + Power Features) and requires one data model decision made during Weeks 1-4 (Foundation).

### 9.1 Weeks 1-4 — Data Model Decision (No Extra Build Time)

The session step data model ([practice-bridge-technical.md](practice-bridge-technical.md), Section 15) must be designed with Live Lesson Mode in mind from day one. Specifically, each session step must support an `audio_source` field that distinguishes between:

- `teacher_recording` — audio uploaded or captured by teacher
- `backing_track` — teacher-sourced or platform-generated backing
- `none` — text/instruction only step

This field costs nothing to add in Weeks 1-4 and prevents a painful schema migration later. Design for it now.

### 9.2 Weeks 14-20 — Live Lesson Mode Priority

The Week 14-20 milestone ([practice-bridge-business.md](practice-bridge-business.md), Section 19.3) is structured so Live Lesson Mode is the primary deliverable, with the AI Session Builder and advanced features as secondary. Both produce identical session structures. Live Lesson Mode is prioritised because:

- It demonstrates value in the first lesson a teacher uses it — before they have time to be skeptical.
- It creates immediate, irreversible switching cost (teacher recordings stored in platform).
- It is the primary word-of-mouth engine. Teachers who experience it tell other teachers.
- The manual Session Builder serves async/advance planning use cases — valuable, but lower adoption urgency.

| Sub-milestone | Deliverable | Estimated Effort |
|---------------|-------------|-----------------|
| **Week 14-16** | Live Lesson Mode UI — tempo wheel, record button, step list, end-of-lesson review screen | 3-4 weeks |
| **Week 16-18** | Audio capture pipeline — bounded window recording, Practice Bridge Desktop integration, local Whisper transcription, n8n processing queue | 3-4 weeks |
| **Week 18-19** | Domain Evaluator (Node 2) — AI domain classification on structured session steps, Session Quality Score display | 2-3 weeks |
| **Week 18-20** | AI Session Builder — AI text-to-session (Node 1), advanced session features, teacher dashboard enhancements | 4-5 weeks |

Sub-milestones 14-19 and 18-20 can be developed in parallel by separate tracks if resources allow. They share the same session data model (Weeks 1-4) but have no hard dependencies on each other.

---

## 10. New Technical Dependencies

The following additions to the v6.0 tech stack ([practice-bridge-technical.md](practice-bridge-technical.md), Section 16) are required for Live Lesson Mode:

| Component | Technology | Notes |
|-----------|-----------|-------|
| Local speech transcription | Whisper.cpp or whisper-rs | Runs in Desktop app. Small or medium model. No audio leaves device in default mode. |
| Audio segmentation | CPAL (existing) + timestamp markers | Pre/take/post windows defined by record tap timestamps. No new library required. |
| Click track removal (on-device) | Platform AEC (iOS: Voice Processing IO, Android: AcousticEchoCanceler + WebRTC AEC3 fallback) | Real-time click removal during recording. No additional dependencies on iOS. ~200KB bundled WebRTC AEC3 C++ lib on Android for OEM consistency. See [practice-bridge-technical.md](practice-bridge-technical.md), Section 10b. |
| Click track removal (server) | SpeexDSP + scipy/numpy | Server-side adaptive filter cleanup post-upload. 4096-tap filter, spectral subtraction. <2s processing per 60s recording. See [practice-bridge-technical.md](practice-bridge-technical.md), Section 10b.5. |
| Async processing queue | n8n (existing) | New workflow: audio segment in → AEC cleanup → transcription → domain eval → session step out. Same n8n instance as AI Session Builder. |
| Domain Evaluator | Claude/GPT-4 via n8n (existing) | Second node in the AI chain. Input: structured session steps. Output: domain tags + coverage profile. |
| Teacher recording storage | Supabase Storage (existing) | Teacher recordings stored as session audio assets. Same CDN delivery as other session audio. |

---

## 11. New API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/sessions/live` | Submit a completed Live Lesson session for processing. Accepts step array with audio references, tempo, transcription text. Returns `session_id`. |
| GET | `/api/v1/sessions/live/:id/status` | Poll processing status of a live session. Returns per-step processing state (transcribing / evaluating / complete). |
| PATCH | `/api/v1/sessions/live/:id/review` | Teacher submits corrections from end-of-lesson review. Overwrites AI-generated instruction text, domain tags, step order. |
| POST | `/api/v1/sessions/live/:id/assign` | Assign reviewed Live Lesson session to student(s). Identical behaviour to existing `/api/v1/sessions/:id/assign`. |

---

## 12. What Does Not Change

For absolute clarity — the following v6.0 components are unaffected by this document:

- Desktop app audio engine (CPAL, pitch detection, onset detection, DTW scoring)
- Student session player and preload system
- Scoring engine — Metered and Expressive modes
- Teacher dashboard and results viewer
- Student dashboard, streaks, leaderboards
- Tenant API and Bassicology integration
- REST API endpoints (new endpoints required only for Live Lesson session submission)
- Privacy architecture — no audio to servers, no song names, GDPR compliance
- Mobile companion app specification
- Stem removal / Jam-Along
- Browser extension

---

## 13. Summary for the Development Team

Three things to take away from this document:

1. **Weeks 1-4:** Add `audio_source` field to `session_steps` schema. No other changes. Costs nothing now, prevents pain later.
2. **Weeks 14-20:** Prioritise Live Lesson Mode (sub-milestones 14-19) alongside the AI Session Builder (18-20). Both ship in the same milestone. Both matter. Live Lesson Mode is the strategic priority.
3. **Always:** Live Lesson Mode produces the same session structure as the manual builder. Same player. Same scoring. Same data. Different input method only. Build them to share everything downstream.

---

*[Product Specification](practice-bridge-product.md) | [Technical Specification](practice-bridge-technical.md) | [Business & Strategy](practice-bridge-business.md) | [Overview](practice-bridge-condensed.md)*
