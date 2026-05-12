# PRACTICE BRIDGE — Technical Specification

**Version 6.0 — February 2026**
**CONFIDENTIAL — practicebridge.ai**

*Sections 7-16. For product context, see [practice-bridge-product.md](practice-bridge-product.md).*

---

## 7. Communication Architecture

### 7.1 Localhost WebSocket Server

Practice Bridge Desktop embeds a WebSocket server (built on `tokio-tungstenite`) listening on `ws://localhost:<port>`. The practicebridge.ai browser app (or any tenant's browser tab) connects as a WebSocket client.

```
┌──────────────────────────┐  ws://localhost:9876  ┌──────────────────────┐
│  Browser Tab             │◄────────────────────►│  Practice Bridge     │
│  (practicebridge.ai)     │  sub-1ms round-trip   │  Desktop (Tauri)     │
│                          │  latency              │  System Tray         │
│  Session Player          │                       │                      │
│  Exercise Player         │  (optional —          │  Audio capture       │
│  Tuner, Jam-Along        │   browser works       │  Pitch detection     │
│                          │   without Desktop)    │  Stem removal        │
└────────────┬─────────────┘                       └────────┬─────────────┘
             │ HTTPS                                        │ HTTPS
             ▼                                              ▼ (offline sync)
┌──────────────────────────────────────────────────────────────────────────┐
│  practicebridge.ai (Server + REST API)                                  │
│  Accounts, sessions, scores, analytics, assignments                     │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ REST API (S2S)
                    ┌────────────┴───────────┐
                    ▼                        ▼
          ┌─────────────────┐    ┌─────────────────────┐
          │  Tenant Servers  │    │  (e.g., Bassicology, │
          │  (optional)      │    │   Guitar Academy)    │
          └─────────────────┘    └─────────────────────┘
```

**Single connection constraint:** Only one browser tab can hold the active WebSocket connection at a time. If a second tab attempts to connect, Practice Bridge sends `{type: "error", code: "ALREADY_CONNECTED", message: "Another tab is already connected"}` and refuses the connection. The second tab's page shows: "Practice Bridge is connected to another tab. Switch there or disconnect it?" with a button to force-disconnect (takes over the connection).

**Mid-session tab conflict UX:** If the student opens a second practicebridge.ai tab to browse the exercise library mid-practice, that tab does NOT need the PB connection — it's just browsing content. Only active practice pages (session player, exercise player, Jam-Along, tuner) require the WebSocket. Library, dashboard, profile, and settings pages work without Desktop.

**Connection handoff:** If the student explicitly takes over the connection from another tab (via the force-disconnect button), the original tab receives `{type: "connectionLost", reason: "TAKEN_OVER"}`. The original tab saves any in-progress session data to the browser's local storage and shows: "Practice Bridge connected in another tab. Your progress has been saved." The session can be resumed when the student reconnects.

**Mid-session recovery:** The in-progress session state (accumulated note events, timing data, current position, exercise/assignment ID) is held in two places: (1) Practice Bridge desktop's memory (authoritative) and (2) the browser's running DTW scorer. On a tab takeover, the new tab receives the current session state from PB desktop via a `{type: "sessionRestore", ...}` message containing the accumulated note events and position. The browser rebuilds its DTW scorer from these events. No practice data is lost. If the student doesn't want to continue, they can submit the partial session — partial results are always accepted and scored up to the point reached. "15 minutes of practice" is never lost to an accidental tab open.

**Legal note:** The `sessionRestore` payload contains note events that — for Jam-Along sessions — are derived from the instrument estimate of the student's audio. These are the same structured pitch/timing data acknowledged in [practice-bridge-business.md](practice-bridge-business.md), Section A.1 as a legal gray area. The `sessionRestore` transfer occurs entirely over localhost (local IPC, not a network transmission) and the events remain transient — they are used to rebuild the scorer in memory and are not persisted. The same transience and local-only arguments that apply to real-time note event streaming apply equally to session restoration.

**Idle timeout:** If the student closes the active tab without ending the session, Practice Bridge Desktop holds unsaved session data for 5 minutes. If a new tab connects within that window, the session can be resumed via `sessionRestore`. After 5 minutes, Practice Bridge Desktop auto-saves the session to local SQLite as a complete session (scored up to the point reached) and marks it for sync.

### 7.1a PB-Audio v1 Protocol (Listener-First Practice Bridge Desktop)

Practice Bridge Desktop v1 (Week 20-26) implements a subset of the full WebSocket protocol described in Section 7.2. The protocol is named **PB-Audio v1** and is platform-agnostic — Practice Bridge Desktop has no Bassicology-specific code. It is its own product that works with any browser client connecting to `ws://localhost:9876`.

**Practice Bridge Desktop v1 handshake:**

```json
{
  "type": "handshake",
  "protocolVersion": 1,
  "pbVersion": "0.1.0",
  "minBrowserVersion": "1.0.0",
  "capabilities": ["scoring", "tuner"]
}
```

**Practice Bridge Desktop v1 streams (Practice Bridge Desktop → Browser):**

| Stream | Rate | Data |
|---|---|---|
| Note events | On detection | `{type: "note", pitch: "E2", onset: 1.234, offset: 1.567, velocity: 0.8}` |
| Tuner data | 30 fps | `{type: "tuner", note: "E2", cents: -3.2, freq: 82.1}` |
| Input level | 30 fps | `{type: "level", rms: 0.45, peak: 0.72}` |
| Connection status | On change | `{type: "status", audioDevice: "Scarlett 2i2", sampleRate: 44100}` |

**Practice Bridge Desktop v1 commands (Browser → Practice Bridge Desktop):**

| Command | Data |
|---|---|
| Instrument profile | `{type: "instrumentProfile", instrument: "bass", pitchRange: {...}, ...}` |
| Start/stop tuner | `{cmd: "startTuner"}`, `{cmd: "stopTuner"}` |

**Not available in Practice Bridge Desktop v1 (added in later milestones):**
- Transport commands (`play`, `stop`, `seek`, `tempo`) — requires mixer + backing track playback (Week 26-34)
- Load exercise / preload session — requires audio file caching (Week 26-34)
- Stem removal commands (`openFileDialog`, `stemLevel`) — requires ONNX inference (Week 26-34)
- Playback position streaming — requires mixer (Week 26-34)
- Session restore — requires session state persistence (Week 34+)
- Tab audio stream (browser extension PCM) — requires browser extension support (Week 26-34)

**Protocol expansion:** When the mixer and backing track playback are added (Week 26-34), Practice Bridge Desktop announces new capabilities in the handshake: `["scoring", "tuner", "stemRemoval", "mixer", "transport"]`. The browser checks the capabilities array and enables/disables UI features accordingly. No breaking changes — the protocol is additive. A browser built for the full protocol gracefully degrades when connected to Practice Bridge Desktop v1.

**Platform agnosticism:** The PB-Audio v1 protocol contains no Bassicology-specific message types, identifiers, or logic. The `instrumentProfile` message configures the pipeline for any instrument. This ensures Practice Bridge Desktop can serve the Practice Bridge standalone platform and future tenants without modification.

### 7.2 WebSocket Protocol

**Version handshake:** On connection establishment, Practice Bridge sends a handshake message before any other data:

```json
{
  "type": "handshake",
  "protocolVersion": 1,
  "pbVersion": "1.4.2",
  "minBrowserVersion": "1.3.0",
  "capabilities": ["scoring", "stemRemoval", "tuner", "sessionRestore"]
}
```

The browser validates `protocolVersion` and `minBrowserVersion` against its own version. If incompatible, the browser shows: "Practice Bridge has been updated. Please refresh this page to continue." with a one-click refresh button. The `capabilities` array allows graceful feature negotiation — if the browser expects `stemRemoval` but PB desktop is an older build without it, the UI disables Jam-Along mode rather than crashing. The `protocolVersion` is a simple integer that increments only on breaking changes to the message schema.

**Practice Bridge → Browser (real-time streams):**

| Stream | Rate | Data |
|---|---|---|
| Playback position | 60 fps | `{type: "position", beat: 3.5, measure: 4, time: 12.345}` |
| Note events | On detection | `{type: "note", pitch: "E2", onset: 1.234, offset: 1.567, velocity: 0.8}` |
| Tuner data | 30 fps | `{type: "tuner", note: "E2", cents: -3.2, freq: 82.1}` |
| Input level | 30 fps | `{type: "level", rms: 0.45, peak: 0.72}` |
| Stem removal progress | On change | `{type: "stemRemoval", status: "processing", progress: 0.45}` |
| Analysis results | Once per file | `{type: "analysis", bpm: 120, key: "Em", title: "...", artist: "..."}` (displayed in browser only, never sent to server) |
| Connection status | On change | `{type: "status", audioDevice: "Scarlett 2i2", sampleRate: 44100}` |
| Session preload progress | On change | `{type: "preloadProgress", sessionId: "...", progress: 0.65, filesLoaded: 8, filesTotal: 12}` |
| Session preload complete | Once | `{type: "preloadComplete", sessionId: "...", totalBytes: 15234567}` |

**Browser → Practice Bridge (commands):**

| Command | Data |
|---|---|
| Transport | `{cmd: "play"}`, `{cmd: "stop"}`, `{cmd: "seek", beat: 8}`, `{cmd: "tempo", bpm: 120}` |
| Load exercise | `{cmd: "loadExercise", id: "abc123", audioUrl: "https://cdn.../backing.mp3"}` |
| Stem removal (open file) | `{cmd: "openFileDialog"}` → Practice Bridge opens native OS file picker, reads file from disk |
| Stem removal level | `{cmd: "stemLevel", attenuation: 0.95}` (0 = full instrument, 1 = fully removed) |
| Audio device | `{cmd: "setDevice", id: "device-uuid"}` |
| Instrument profile | `{type: "instrumentProfile", instrument: "bass", pitchRange: {...}, stemTarget: "bass", ...}` |
| Preload session | `{cmd: "preloadSession", sessionId: "...", manifest: {...}}` → PB Desktop downloads all audio assets |
| Tab audio stream | Binary PCM frames from browser extension |

### 7.3 Deep Link Integration

Practice Bridge registers a custom URI scheme (`practicebridge://`) via Tauri's deep-link plugin. The web platform renders "Open in Practice Bridge" buttons that trigger:

```
practicebridge://connect
practicebridge://exercise/abc123
```

This launches Practice Bridge (or focuses it if already running) and establishes the WebSocket connection. The deep link scheme uses `practicebridge://` (not `bassicology://`) because any integrated platform — not just Bassicology — can launch Practice Bridge.

### 7.4 Data Flow Summary

| Direction | Channel | Data | Audio Over Network? |
|---|---|---|---|
| Browser → PB Desktop | WebSocket (localhost) | Transport commands, exercise ID, stem removal level, session preload | 🟢 **NO** — localhost is local IPC |
| Browser → PB Desktop | WebSocket (localhost) | Open file dialog command | 🟢 **NO** — PB opens native file picker, reads from disk directly |
| Browser → PB Desktop | WebSocket (localhost) | Tab audio PCM (browser extension) | 🟢 **NO** — localhost is local IPC |
| PB Desktop → Browser | WebSocket (localhost) | Position, notes, tuner, level, analysis, preload progress | 🟢 **NO** — metadata only |
| Browser → practicebridge.ai | HTTPS | Session results, analytics queries, Session Builder data | 🟢 **NO** — metadata only |
| PB Desktop → practicebridge.ai | HTTPS | Offline sync (scores, sessions) | 🟢 **NO** — metadata only |
| practicebridge.ai → Browser | HTTPS | Session manifests, exercise data, audio asset URLs (CDN) | 🟢 **NO** — content delivery |
| Tenant Server → PB API | HTTPS (S2S) | Scores, accounts, assignments, analytics queries | 🟢 **NO** — metadata only |
| PB API → Tenant Server | HTTPS (webhook) | Notification events, feedback events | 🟢 **NO** — metadata only |

**At no point does any audio transit over the internet. Audio flows only between processes on the same machine via localhost, which is an inter-process memory copy — not a network transmission. Practice Bridge's server does not receive, store, process, or transmit any audio. No API endpoint accepts audio data.**

### 7.5 REST API and Tenant Integration

practicebridge.ai exposes a REST API used by two types of clients:

1. **The Practice Bridge web UI** (practicebridge.ai browser app) — calls the API directly using the user's session token. This is the primary interface for most users.
2. **Tenants** (e.g., Bassicology) — call the same API via server-to-server (S2S) authentication. Tenants add instrument-specific content and UX on top of Practice Bridge's core platform.

This is NOT a real-time channel — it carries metadata at normal HTTP latency (50-200ms).

**Core API Endpoints:**

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/accounts` | POST | Create account (direct signup or tenant auto-creation) |
| `/api/v1/accounts/{id}` | DELETE | Delete account and all associated data (GDPR Article 17) |
| `/api/v1/accounts/{id}/export` | GET | Export all user data as JSON (GDPR Article 20 data portability) |
| `/api/v1/sessions` | POST | Create a practice session (Session Builder) |
| `/api/v1/sessions/{id}` | GET | Fetch session definition (manifest, steps, conditions) |
| `/api/v1/sessions/{id}/steps` | POST | Add/update steps in a session |
| `/api/v1/sessions/{id}/assign` | POST | Assign session to a class with due date |
| `/api/v1/sessions/{id}/results` | POST | Submit practice results for a session (scores per step) |
| `/api/v1/sessions/{id}/results` | GET | Fetch all results for a session (teacher view) |
| `/api/v1/assignments` | POST | Create standalone assignment (non-session) |
| `/api/v1/assignments/{id}/results` | GET | Fetch student results for an assignment |
| `/api/v1/students/{id}/analytics` | GET | Fetch student practice analytics, streaks |
| `/api/v1/leaderboards/{songHash}` | GET | Fetch leaderboard for a song hash |
| `/api/v1/classes` | POST/GET | Class management (roster, members) |
| `/api/v1/feedback` | POST | Submit teacher feedback |
| `/api/v1/auth/refresh` | POST | Exchange refresh token for new access token + rotated refresh token |

*Additional endpoints for Live Lesson Mode are documented in [practice-bridge-live-lesson.md](practice-bridge-live-lesson.md), Section 11: `POST /api/v1/sessions/live` (submit live session), `GET /api/v1/sessions/live/:id/status` (processing status), `PATCH /api/v1/sessions/live/:id/review` (teacher corrections), `POST /api/v1/sessions/live/:id/assign` (assign to students).*

**Authentication:**

For direct users (practicebridge.ai web app): Standard session-based auth via Supabase. The browser's session token authenticates API calls directly.

For tenants (S2S): OAuth2-style authentication using a platform API key (`X-Platform-Key` header) plus the user's short-lived access token. The platform key identifies the tenant (e.g., `bassicology`).

**Token model (tenant S2S):**
- **Access tokens** — short-lived (15 min), used for API calls. Not stored persistently.
- **Refresh tokens** — longer-lived (30 days), stored encrypted at rest in the tenant's database. Rotated on each use (old refresh token invalidated when new one is issued).
- **Scope:** Refresh tokens issued to a tenant are scoped to that tenant's platform key — they cannot access data from other tenants.

**Tenant account auto-creation flow (example: Bassicology):**
1. Student signs up on bassicology.com
2. Bassicology server calls `POST /api/v1/accounts` with `{email, displayName, instrument: "bass", tenantId: "bassicology"}`
3. Practice Bridge API creates the account and returns `{pbAccountId, accessToken, refreshToken}`
4. Bassicology stores `pbAccountId` and the encrypted `refreshToken`
5. The student never sees a separate Practice Bridge signup — it's seamless behind the scenes

Default signup (direct on practicebridge.ai) does not use the S2S flow — the student signs up on practicebridge.ai directly using Supabase auth.

**S2S API failure handling:** The tenant server → PB API path must handle PB API downtime gracefully. The student should never lose practice data because of a server-to-server failure.

| Scenario | Behavior |
|---|---|
| **PB API down when student submits** | Tenant server queues the `POST /api/v1/sessions/{id}/results` payload in a transactional outbox (database table). A background worker retries with exponential backoff (1s, 5s, 30s, 5min, 30min). Student sees "Score saved!" immediately — tenant stores the result locally and forwards to PB API asynchronously. |
| **PB API down during signup** | Account auto-creation is retried in the background. The student can use the tenant's instrument-specific features immediately. PB account is created on the next successful retry. |
| **PB API slow (>3s response)** | Tenant server uses a 5-second timeout. On timeout, the request is queued in the outbox for retry. No blocking of the student's UI. |
| **PB API returns 5xx error** | Same as down — queued for retry. 4xx errors (validation) are not retried; they surface as actionable errors in the tenant's admin logs. |

The transactional outbox pattern ensures at-least-once delivery. The PB API's results endpoints are idempotent (keyed on `{studentId, sessionId, stepId, attemptNumber}`) to handle duplicate submissions from retries.

**Dual-sync deduplication:** The same practice result can arrive via two paths: (1) tenant server → PB API (online submission or queued retry), and (2) PB Desktop → PB API (offline sync). Both paths submit using the same idempotency key. The PB API accepts the first submission and returns `200 OK` with the existing record for any duplicate — regardless of which path arrived first. This is by design: the student's practice data is safe even if both paths fire simultaneously.

---

## 8. Browser Extension (Tab Audio Capture)

### 8.1 Purpose

The browser extension eliminates the biggest UX barrier in Jam-Along mode: requiring users to install and configure a virtual audio driver (BlackHole/VB-Cable). Most users will not complete multi-step system audio routing configuration.

### 8.2 How It Works

```
┌───────────────────────────────────────────┐
│  Browser (Chrome/Firefox)                 │
│  ┌────────────────────┐                   │
│  │ Music Tab          │                   │
│  │ (playing audio)    │─► tabCapture API  │
│  └────────────────────┘     │             │        ┌──────────────┐
│                             ▼             │        │              │
│  ┌────────────────────┐  PCM stream       │        │ Practice     │
│  │ practicebridge.ai  │───────────────────┼──────►│ Bridge       │
│  │ (all UI)           │  ws://localhost    │        │ (Tauri)      │
│  │                    │◄──────────────────┼───────│ audio out    │
│  │                    │  metadata streams  │        │  → 🎧        │
│  └────────────────────┘                   │        └──────────────┘
└───────────────────────────────────────────┘
```

- Uses `chrome.tabCapture` API (Chrome) or equivalent (Firefox) to capture audio from a single user-selected tab
- Routes raw PCM audio to Practice Bridge Desktop via the practicebridge.ai tab's WebSocket connection
- Only captures the tab the user explicitly selects — not system-wide audio
- No driver installation, no system audio configuration
- Works identically on macOS, Windows, and Linux

### 8.3 Privacy Advantages

- Captures one tab only, not all system audio
- User must explicitly grant capture permission per tab
- No audio data leaves the local machine — flows only over localhost
- Extension requires minimal permissions: `tabCapture` and `localhost` WebSocket access

### 8.4 Platform Support

| Browser | API | Status |
|---------|-----|--------|
| Chrome | `chrome.tabCapture` | Stable, well-documented |
| Firefox | `browser.tabCapture` (Manifest V3) | Supported |
| Edge | `chrome.tabCapture` (Chromium-based) | Supported |
| Safari | Not available | Use system audio fallback (BlackHole) |

### 8.5 OS Audio Routing Alternatives

For users without the browser extension (Safari) or who need system-wide audio capture:

| Method | Platform | Setup | Additional Latency | Legal Consideration |
|---|---|---|---|---|
| `tabCapture` with mute (recommended) | Chrome, Firefox, Edge | Extension install only | ~5-15ms | Standard browser API; equivalent to screen recording |
| Virtual audio driver (BlackHole) | macOS | User installs BlackHole (free, open-source) | ~3-10ms | User configures their own audio routing; no Bassicology involvement |
| Virtual audio driver (VB-Cable) | Windows | User installs VB-Cable | ~3-10ms | Same as above |
| ASIO exclusive mode | Windows | User selects in Practice Bridge settings | 0ms | Practice Bridge takes sole control of output device; standard ASIO behavior |
| CoreAudio aggregate device | macOS | User creates in Audio MIDI Setup | ~1-3ms | Standard macOS feature; no driver installation |

All alternatives involve the user routing their own audio on their own machine. Bassicology does not install audio drivers, modify system audio settings, or intercept audio streams.

---

## 9. Audio & Visual Latency Analysis

### 9.1 Why Practice Bridge Must Own the Headphone Mix

A musician needs to hear their instrument within ~10ms of playing a note. If the input round-trips through the browser, latency is unacceptable:

```
ROUND-TRIP THROUGH BROWSER (rejected):
Bass → audio interface (~1ms) → CPAL → Practice Bridge (~2ms) → WebSocket → browser (~1ms)
→ Web Audio API buffer (~20-50ms) → WebSocket → Practice Bridge (~1ms) → headphones (~1ms)
TOTAL: 26-57ms ← TOO SLOW — feels like playing through mud
```

Instead, Practice Bridge mixes audio locally and never round-trips through the browser:

```
PRACTICE BRIDGE DIRECT (implemented):
Bass → audio interface (~1ms) → CPAL → Practice Bridge mixer (~2-3ms) → headphones (~1ms)
TOTAL: 4-6ms ← PERFECT — below perception threshold
```

### 9.2 Latency Budget for Every Signal Path

| Signal Path | Latency | Acceptable? |
|---|---|---|
| Instrument note → headphones (audio monitoring) | **4-6ms** | Excellent — below 10ms perception threshold |
| Backing track → headphones (audio playback) | **4-6ms** | Excellent — Practice Bridge plays directly via CPAL |
| Backing track position → fretboard notes (visual) | **17-19ms** | Excellent — 1ms WebSocket + 16ms frame render |
| Instrument note → fretboard dot (visual feedback) | **22-27ms** | Good — 5-10ms pYIN pitch detection + 1ms WebSocket + 16ms frame |
| Transport command (browser → Practice Bridge) | **1-3ms** | Excellent — single WebSocket message |
| Instrument note → score update (visual) | **25-35ms** | Good — scoring is not latency-critical |
| Bassicology server → PB API (S2S REST) | **50-200ms** | Fine — metadata only (scores, accounts), not real-time audio |
| PB Desktop → practicebridge.ai (offline sync) | **100-500ms** | Fine — batch sync, not latency-sensitive |

### 9.3 Why These Numbers Work Musically

At 120 BPM, one sixteenth note is 125ms. The visual latency of 17-19ms for exercise notes appearing on the fretboard is less than one animation frame — imperceptible. The 22-27ms for the played notes appearing on screen is well within the "feels instant" range (human audio-visual desync threshold is ~45ms).

For reference, Guitar Hero and Rock Band operate at 30-50ms audio-visual latency and are considered responsive.

### 9.4 Browser Tab Throttling

Chrome throttles background tabs: `requestAnimationFrame` drops to 1fps and `setTimeout` drops to 1/second. This only affects the browser UI — Practice Bridge's audio output never glitches because it runs as a separate OS process. The student must keep practicebridge.ai in the foreground for visual feedback, but audio continues uninterrupted even if they switch tabs.

### 9.5 Windows Audio Latency Tiers

macOS CoreAudio delivers consistent 4-6ms latency. Windows audio is more complex — latency depends on the driver model available on the student's hardware.

| Tier | Driver | Latency | Experience | Detection |
|---|---|---|---|---|
| **Tier 1** | ASIO (Focusrite, Universal Audio, etc.) | **4-6ms** | Excellent. Full experience, no caveats. | PB detects ASIO driver at startup |
| **Tier 2** | WASAPI Exclusive Mode | **10-20ms** | Good. Workable for practice and scoring. | PB auto-selects if no ASIO driver found |
| **Tier 3** | WASAPI Shared Mode | **20-40ms** | Functional. Monitoring feels sluggish. Scoring still works. | Fallback if Exclusive mode fails |

**Onboarding behavior:** During first-time setup ([practice-bridge-product.md](practice-bridge-product.md), Section 6.5), Practice Bridge detects the available audio driver and shows the appropriate message:

- **Tier 1:** "Audio latency: excellent (5ms). You're all set."
- **Tier 2:** "Audio latency: good (15ms). Practice and scoring work well."
- **Tier 3:** "Audio latency: 30ms. This works for practice, but for tighter responsiveness, an ASIO-compatible audio interface is recommended." + link to affordable recommendations (e.g., Behringer UMC22 ~$30, Focusrite Scarlett Solo ~$120).

The browser UI also shows a persistent latency indicator (green/yellow/orange) so the student understands their setup. Scoring and all features work at every tier — only the feel of audio monitoring changes.

**Note:** Most students who are serious enough to practice with Practice Bridge already own a USB audio interface (Focusrite, PreSonus, etc.) which ships with ASIO drivers. Tier 3 primarily affects casual first-time users testing with built-in laptop audio.

---

## 10. Stem Removal Engine

### 10.1 User-Facing Feature: Instrument Attenuation

The user-facing feature is **instrument removal** — a single audio transformation that attenuates a target instrument track from an audio source. The student controls a single parameter: attenuation level (0% = full instrument, 100% = fully removed). There are no per-stem faders, no stem mixer, no ability to isolate or export individual parts of the audio.

This is functionally equivalent to a sophisticated equalizer or noise cancellation system: the student provides audio input, the engine applies a real-time transformation, and the modified audio plays to headphones.

### 10.2 Internal Architecture: Segmented Streaming Pipeline

Under the hood, the stem removal engine uses specialized ML models as an implementation detail. The internal pipeline processes audio in 10-second segments with 2-second overlap on each side (14 seconds total per segment).

```
SEGMENT LAYOUT:
───overlap───┬─────────core 10s──────────┬──overlap───
│   2s      │      playable audio     │   2s      │
─────────────┴──────────────────────────┴────────────

CIRCULAR BUFFER (max 3 segments in RAM):
[Seg N-1: playing] → [Seg N: ready] → [Seg N+1: processing]
  ↑ purge when done     ↑ next up       ↑ model inference
```

#### Processing Phases

**Phase 1 — Audio Input & Segmentation (~50ms):** Incoming audio is buffered and sliced into segments. Practice Bridge reads audio from a local file on disk or receives a real-time PCM stream from the browser extension. It never connects to any streaming platform API.

**Phase 2 — Model Inference (~2-6s per segment on GPU):** The segment is processed by a separation model that isolates the target instrument component. The model output is used to compute a "instrument-removed" mix: `output = original - (instrument_estimate * attenuation_level)`. The intermediate instrument estimate is a transient computation artifact.

**Phase 3 — Crossfade Assembly:** Completed segments are assembled into a playback queue. Overlap regions are crossfaded using a raised cosine window to eliminate discontinuities. Playback is continuous once the first segment is ready.

**Phase 4 — Progressive Purge (automatic):** As the playback cursor advances past a segment, that segment's audio data is immediately zeroed and deallocated from RAM. On session close, all remaining data is purged. No processed audio is ever written to disk.

#### Critical Design Constraint: No Isolated Stems

The engine never exposes, stores, or makes accessible any isolated component of the audio (bass, vocals, drums, or other). Intermediate model outputs are computation artifacts that exist only within the processing pipeline — analogous to intermediate pixel values in a GPU shader pipeline. They are:

- Never written to disk
- Never exposed via any API
- Never sent over any connection (not even localhost)
- Immediately discarded after being used to compute the instrument-removed mix
- Not accessible to the user in any form

The only audio that persists (in the rolling RAM buffer) is:
1. The original audio (which the student already possesses)
2. The instrument-removed mix (a real-time transformation of the original)

### 10.3 File Mode: Zero-Wait Playback

For local audio files, the student experiences no waiting:

```
FILE MODE TIMELINE:
t=0s     Practice Bridge reads file from disk → PLAYBACK BEGINS IMMEDIATELY (full mix)
t=0s     Stem removal engine starts processing segment 1 in background
t=2-3s   BPM detected → sent to browser
t=3-4s   Key detected → sent to browser
t=3-6s   First segment instrument-removed mix ready → stem removal AVAILABLE
t=3-4s   AcoustID fingerprint → song metadata sent to browser
t=6-8s   Beat grid locked → scoring engine calibrated
         ...student has been listening and warming up the entire time...
```

### 10.4 Streaming Mode Timeline (Browser Extension / System Audio)

```
STREAMING MODE TIMELINE (Two-Phase — see [practice-bridge-business.md](practice-bridge-business.md), Section A.4.3):
t=0s     Tab muted at OS level. Audio capture starts.
         Phase 1: Practice Bridge passthrough → student hears full mix in headphones (no silence)
t=2-3s   BPM detected → sent to browser
t=3-4s   Key detected → sent to browser
t=3-4s   AcoustID fingerprint → song metadata sent to browser
t=6-8s   Beat grid locked → scoring engine calibrated
t=12s    First segment buffered, model inference dispatched
t=14s    First segment instrument-removed mix ready
         Phase 2: Crossfade from passthrough → instrument-removed mix (~2s transition)
         ...continuous rolling window...
```

### 10.5 Model Selection

The separation model is an internal implementation detail. The recommended model is selected for isolation quality:

| Model | Bass SDR (dB) | License | Notes |
|---|---|---|---|
| **HTDemucs fine-tuned** (community weights) | **11.76** | MIT / Open weights | Best open-source bass SDR. Community-retrained weights avoid CC BY-NC restriction on Facebook's pretrained weights. |
| BS-RoFormer (fallback) | 10.5 | MIT / Open weights | Lighter model, faster inference, lower quality. |

*SDR (Signal-to-Distortion Ratio) measured on MUSDB18HQ test set. Higher is better.*

The model can be upgraded by swapping the ONNX file — no app update required. New models are pushed as background downloads.

### 10.6 Performance Estimates

| Hardware | Per Segment | Time to Stem Removal (File) | Time to Stem Removal (Stream) | RAM Usage |
|---|---|---|---|---|
| Mid-range GPU (RTX 3060) | ~2-4s | ~3-6s | ~14s | ~200-400 MB |
| High-end GPU (RTX 4080+) | ~1-2s | ~2-4s | ~12s | ~200-400 MB |
| Apple Silicon (M2/M3) | ~2-4s (CoreML) | ~3-6s | ~14s | ~200-400 MB |
| CPU only (i7/Ryzen 7) | ~8-15s | ~10-18s | ~25-30s | ~200-400 MB |

*File mode always starts playback immediately. "Time to Stem Removal" is the delay before the attenuation toggle becomes available.*

*RAM usage is lower than full 4-stem separation (~200-400 MB vs ~400-600 MB) because only the instrument-removed mix is retained, not 4 separate stem buffers.*

### 10.7 Scoring Against the Instrument Reference

For Jam-Along scoring, Practice Bridge compares the student's input against what the original instrument line was. The process for each segment is:

1. The separation model produces an instrument estimate as a transient intermediate buffer
2. **Within the same processing function call**, the pYIN-based analysis pipeline extracts note events (pitch, onset, offset, velocity) from the instrument estimate — the same analysis used on the student's live input
3. **Immediately after note extraction completes** — before the function returns — the instrument estimate audio buffer is explicitly zeroed (`memset(0)`) and deallocated
4. Only the extracted **note events** (structured metadata: `{pitch: "E2", onset: 1.234, offset: 1.567, velocity: 0.8}`) persist beyond this step

The instrument estimate audio exists for the duration of one function call (~5-50ms depending on segment length). It is never stored in any buffer outside the processing function's stack, never written to disk, never exposed via any API, and never accessible to any other component of the system.

The scoring comparison is therefore between two streams of note event metadata — never between two audio signals. The DTW comparison happens in the browser, operating on note events sent from Practice Bridge. Note events are abstract musical descriptions (pitch name, timing, velocity) that cannot be used to reconstruct any audio signal.

**Legal nuance — note events as transcription:** A sequence of note events that accurately captures every pitch and timing of a bass line is arguably a structured transcription of that musical content. Melodic transcriptions can carry copyright implications. The defense against this argument is multi-layered: (1) note events are **imprecise approximations** derived from a lossy ML model, not a verified score — they contain false detections, missed notes, and timing errors; (2) they exist only **transiently in memory** — never persisted, exported, displayed as notation, or made accessible outside the DTW scoring function; (3) the **purpose is educational measurement**, not reproduction — analogous to a teacher mentally noting "they missed the C# on beat 3," which is also a mental transcription but not infringement; (4) note events **cannot reconstruct audio** — they lack timbre, dynamics shape, harmonic context, and articulation. This argument is reasonable but not airtight. See [practice-bridge-business.md](practice-bridge-business.md), Appendix A for the full legal treatment of this nuance.

### 10.7b Separation Confidence & Scoring Quality

Jam-Along scoring quality depends entirely on how cleanly the stem separation isolates the target instrument. A busy mix, heavy effects, or bleed between instruments produces a noisy reference with false note detections. A student could play perfectly and score 60% because the reference extraction is poor.

**Confidence scoring:** During note event extraction (Section 10.7 step 2), Practice Bridge computes a per-segment confidence score based on:
- SNR (signal-to-noise ratio) of the separated instrument estimate
- Onset clarity (sharp vs. ambiguous note starts)
- Pitch stability (steady pitch vs. wobbly/uncertain detection)

**Three tiers of Jam-Along scoring:**

| Confidence | Threshold | Behavior |
|---|---|---|
| **High** | > 0.7 | Normal comparative scoring. "Your score: 87%." |
| **Medium** | 0.4 – 0.7 | Scoring with quality warning. "Score: 82% (reference quality: moderate — some notes may not be detected accurately)." |
| **Low** | < 0.4 | Comparative scoring disabled. Show timing-only feedback: BPM tracking, rhythm consistency, practice duration. Message: "This song's instrument line is hard to isolate. Timing feedback is shown instead of note accuracy. For scored practice, try Exercise Mode." |

**Implementation:** The confidence score is sent to the browser alongside each batch of note events: `{type: "noteEvents", events: [...], confidence: 0.85}`. The browser decides how to present scoring based on confidence. Practice Bridge never hides data — it always sends note events — but the browser determines whether to use them for comparative scoring.

**Key principle:** The student should never feel punished by bad separation. Exercise Mode (Bassicology-owned content with clean references) is always the most reliable scored practice. Jam-Along scoring is best-effort by nature, and the UI must communicate this honestly.

### 10.8 Multi-Instrument Stem Removal

For multi-instrument support, the same stem removal pipeline is used with a configurable target stem. The web platform sends the target via the `instrumentProfile` message (see Section 7.2).

**Supported stem targets:**

| Instrument | Stem to Remove | Model | Notes |
|---|---|---|---|
| Bass | Bass stem | HTDemucs (4-stem) | Current default. Best SDR for bass. |
| Guitar | Guitar stem | HTDemucs (6-stem) | 6-stem variant separates guitar. Slightly lower SDR than 4-stem bass. |
| Vocals / Voice | Vocal stem | HTDemucs (4-stem) | Vocal separation has highest SDR of all stems (~8-9 dB). |
| Drums | Drum stem | HTDemucs (4-stem) | Drum separation. Student plays along to everything minus drums. |
| Piano/Keyboard | "Other" stem (approximation) | HTDemucs (4-stem) | Piano falls into the "other" category in 4-stem models. Less precise. MIDI input mode recommended for piano (bypasses stem removal entirely). |

**Piano/Keyboard special case:** Piano students can use **MIDI input mode** instead of audio input. The student connects a MIDI keyboard — Practice Bridge receives MIDI note events directly (no pitch detection needed). Stem removal still applies to the backing track (remove piano), but the student's input is precise digital MIDI rather than inferred audio pitch.

**Architecture constraint:** The same legal safeguards apply regardless of target stem. No isolated stems are exposed, stored, or exported. The output is always `original - (target_stem * attenuation_level)`. The intermediate stem estimate is zeroed and deallocated immediately after use (Section 10.7 applies to all instruments).

---

## 10b. Click Track Removal Pipeline (Teacher Recording AEC)

### 10b.1 The Problem

Live Lesson Mode ([practice-bridge-live-lesson.md](practice-bridge-live-lesson.md), Section 5) captures teacher recordings against a click track. The teacher plays any acoustic instrument (bass, bongos, flute, DX7 through an amp — anything) while the device plays a click through its speaker. The microphone captures everything: instrument + click bleed.

The student needs:
- **Teacher performance only** (clean recording, no click) — the primary reference track
- **Click track** (regenerated from metadata) — independent volume control, changeable sound
- **Their own recording** — layered on top for comparison

**The click must never be baked into the teacher's recording.** It is always regenerated from stored metadata (`{ tempo, timeSignature, clickSound, countInBars }`). This means students can change click sound, adjust click volume, or practice at a different tempo (time-stretch teacher, regenerate click at new BPM) — all independently.

### 10b.2 Why This Is Easier Than General Echo Cancellation

Standard AEC (phone calls, video conferencing) cancels an **unknown, complex signal** (the other person's voice). Our problem is fundamentally simpler:

| Factor | Phone Call AEC | Our Problem |
|--------|---------------|-------------|
| Signal to cancel | Unknown voice (complex, unpredictable) | Known click (we generated it) |
| Reference signal | Must be estimated | Exact — we have the source samples |
| Timing | Unknown | Exact — locked to BPM grid |
| Waveform | Complex speech envelope | Short transient (5-20ms per click) |
| Repetition | Varies constantly | Same sound every beat — averaging improves cancellation |

The teacher's instrument is irrelevant to the cancellation algorithm. The adaptive filter only targets what correlates with the reference signal (the click). It does not matter if the teacher is playing bass (40-400Hz), flute (250Hz-2kHz), bongos (200Hz-5kHz), or singing (80Hz-8kHz). The filter models the room's transformation of the click signal specifically, not the instrument.

### 10b.3 Architecture: Three-Tier Click Removal

```
┌─ Tier 1: On-Device AEC (Real-Time) ──────────────────────────────┐
│                                                                    │
│  Device plays click → speaker → room → mic captures (instrument   │
│  + click bleed). Platform AEC uses the exact click signal as       │
│  reference to subtract the bleed in real-time.                     │
│                                                                    │
│  Result: 85-95% click removal. Teacher hears no difference.        │
│  Recording saved with most click energy already removed.           │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ Tier 2: Server-Side Cleanup (Post-Upload) ───────────────────────┐
│                                                                    │
│  Longer adaptive filter (4096 taps — impossible in real-time on    │
│  mobile). Cross-correlation alignment. Spectral subtraction at     │
│  known click time positions. Catches room reverb tail that Tier 1  │
│  missed.                                                           │
│                                                                    │
│  Result: 95-99% click removal. Surgical, deterministic DSP.        │
│  Processing time: <2 seconds for 60 seconds of audio.              │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ Tier 3: ML Enhancement (Optional/Future) ────────────────────────┐
│                                                                    │
│  HTDemucs source separation for edge cases (extreme room reverb,   │
│  percussionist playing sounds that correlate with the click).      │
│  Same model already deployed for stem removal (Section 10).        │
│  Server-side GPU inference. Only invoked if Tier 2 quality check   │
│  falls below threshold.                                            │
│                                                                    │
│  Also enables future features: separate teacher's voice            │
│  explanation from their playing within the same recording.         │
└────────────────────────────────────────────────────────────────────┘
```

### 10b.4 Tier 1: On-Device Platform AEC

Both iOS and Android ship battle-tested acoustic echo cancellers that handle billions of phone calls daily. The key insight: we use the platform's native AEC with **our click track as the reference signal** — the same mechanism that cancels your speaker output during a phone call.

**iOS — AVAudioEngine Voice Processing IO:**

Apple's Voice Processing IO audio unit includes hardware-accelerated AEC backed by the Neural Engine (Apple Silicon). It is the same pipeline used by FaceTime and Phone.app. When the audio session is configured for play-and-record mode, the system automatically models the acoustic path between speaker and microphone and subtracts the speaker output from the mic input.

```
Audio Session: .playAndRecord + .defaultToSpeaker
Mode: .voiceChat (activates hardware AEC pipeline)

Click Generator → AVAudioPlayerNode → Speaker (teacher hears click)
                                         ↓ acoustic path (room)
Microphone → Voice Processing IO → AEC removes click → Clean buffer → File
                ↑
                └── Hardware AEC uses speaker output as reference automatically
```

The AEC is tuned for voice, but it is canceling a **click track** — a simpler, shorter, more predictable signal than voice. The click's short transient (5-20ms) and known timing make it easier to cancel than speech, even with a voice-tuned model.

**Android — AcousticEchoCanceler + WebRTC AEC3 Fallback:**

Android exposes `AcousticEchoCanceler` as a system audio effect, enabled per `AudioRecord` session. Quality varies by device manufacturer (Samsung, Pixel, and flagship devices are reliable; budget OEMs less so).

For consistent quality across all Android devices, Practice Bridge bundles **WebRTC AEC3** as a standalone native C++ library (~200KB compiled for ARM). This is Google's production echo canceller — the same algorithm powering billions of Google Meet and Duo calls. It accepts a custom reference signal (our click track), which gives better results than the generic system AEC.

```
Primary path: AcousticEchoCanceler (system, zero-config)
Fallback path: WebRTC AEC3 (bundled, ~200KB, custom reference signal)
Selection: automatic based on device capability detection at first launch
```

**Count-in = AEC Training Time:**

The 4-beat (or 1-2 bar) count-in before recording starts is not just for the teacher. The adaptive filter in the AEC uses this period to converge on the room's impulse response (speaker → air → reflections → mic). By the time the recording begins, the filter is already tuned to the specific room, device orientation, and speaker/mic characteristics. Convergence time: ~0.5 seconds with NLMS at typical step sizes.

### 10b.5 Tier 2: Server-Side Cleanup

The on-device AEC operates under real-time constraints (processing must complete within each audio buffer callback — typically 5-10ms). This limits the adaptive filter to short lengths (256-512 taps on mobile). Room reverb tails longer than ~12ms may not be fully captured.

The server has no real-time constraint and runs the following pipeline:

**Step 1 — Regenerate Reference Signal:**
The exact click signal is regenerated from the stored click pattern metadata (`{ tempo, timeSignature, clickSound, countInBars }`). This is a bit-perfect reconstruction of what the device's speaker played.

**Step 2 — Adaptive Filter (SpeexDSP):**
Run `speex_echo_cancellation()` on the raw recording with the regenerated reference. Filter length: 4096 taps (~93ms at 44.1kHz) — captures the full room impulse response including late reflections that the mobile AEC missed. SpeexDSP is the industry standard used by Zoom, Discord, and dozens of VoIP applications.

**Step 3 — Cross-Correlation Alignment:**
Compute cross-correlation between the reference signal and the recording to determine the exact propagation delay (speaker → air → mic). Align the reference before subtraction. Delay is typically 0.5-3ms depending on device form factor.

**Step 4 — Spectral Subtraction at Known Time Positions:**
FFT the recording in overlapping windows. At each known beat position (derived from tempo metadata), identify and subtract residual click energy. Apply a spectral floor to prevent "musical noise" artifacts. This step is surgical because we know both the exact waveform and the exact timing of every click.

**Step 5 — Quality Comparison:**
Compare the device-cleaned recording against the server-cleaned version. Select the better result based on SNR measurement, or blend both. If quality falls below threshold, flag for Tier 3 processing.

**Stack:** Python microservice (scipy/numpy for DSP, SpeexDSP via ctypes for the adaptive filter). Processing time: <2 seconds for a 60-second recording. Runs asynchronously — the teacher never waits.

### 10b.6 Tier 3: ML Source Separation (Edge Cases)

For recordings where Tier 1 + Tier 2 produce insufficient quality (extreme room reverb, teacher playing percussion that correlates with click transients), the pipeline falls back to HTDemucs source separation — the same model and infrastructure already deployed for Jam-Along stem removal (Section 10).

This is not expected to be needed for typical recordings. It exists as a safety net and future-proofs the pipeline for features like separating the teacher's voice explanation from their instrument playing within a single recording.

### 10b.7 What Is Stored

```
Teacher Recording (per session step):
├── clean_audio_url        — Final cleaned recording (Tier 1+2 or Tier 3 output)
├── raw_audio_url          — Original mic capture with click bleed (backup)
├── click_pattern           — { tempo: 120, timeSignature: [4, 4],
│                              clickSound: 'rimshot', countInBars: 1 }
├── aec_quality_score      — 0.0-1.0 confidence that click was fully removed
└── processing_tier        — which tier produced the final output (1, 2, or 3)
```

**Critical design constraints:**
- The click track is **never stored as audio**. Always regenerated from `click_pattern` metadata. Students can change click sound, adjust volume, or practice at a different tempo independently.
- The raw recording is **always kept** as backup. If AEC algorithms improve, recordings can be reprocessed without the teacher re-recording.
- The teacher **never sees any of this**. They tap Record, play, tap Stop. Upload and processing happen silently in the background.

### 10b.8 Mobile Technology Stack for AEC

| Component | iOS | Android | Notes |
|-----------|-----|---------|-------|
| Audio Session | AVAudioSession (.playAndRecord) | AudioRecord + AudioTrack | Simultaneous playback + recording |
| Platform AEC | Voice Processing IO (Neural Engine) | AcousticEchoCanceler | System-level, hardware-accelerated |
| Fallback AEC | Not needed (Apple's AEC is consistent) | WebRTC AEC3 (bundled C++ lib, ~200KB) | Handles inconsistent Android OEM implementations |
| Click Generator | AVAudioPlayerNode | AudioTrack | Plays click through speaker |
| Recording | AVAudioFile / ExtAudioFile | MediaRecorder / AudioRecord | Writes cleaned audio to local storage |
| Reference Signal | Exact buffer sent to speaker output | Exact buffer sent to speaker output | Used by AEC and stored as metadata for server-side cleanup |

### 10b.9 Impact on Live Lesson Mode

This pipeline integrates directly with Live Lesson Mode ([practice-bridge-live-lesson.md](practice-bridge-live-lesson.md), Section 5.4). The "Take" audio window — where the teacher performs against the click — passes through the AEC pipeline before being filed as the session step's reference recording. The flow becomes:

```
Teacher taps Record → 4-beat countdown (AEC converges) → Teacher plays
→ AEC removes click in real-time → Recording saved locally
→ Background upload: raw + cleaned audio + click metadata
→ Server-side Tier 2 cleanup (async, <2 seconds)
→ Final clean recording ready for student playback
```

The teacher's workflow does not change. The AEC is invisible.

---

## 11. Scoring Engine

### 11.1 Split Architecture: Practice Bridge Detects, Browser Scores

**Practice Bridge Desktop (real-time audio analysis — direct Rust DSP):**
- Pitch detection (pYIN algorithm via `pyin-rs`, optimized for bass frequencies 41Hz-400Hz by default)
- Onset detection (note start/stop timing)
- Dynamics analysis (velocity/volume per note)
- Streams detected note events to the browser as JSON over WebSocket

**Browser (scoring logic in TypeScript):**
- Receives note events from Practice Bridge Desktop
- Compares against exercise reference pattern (MIDI/note data from platform)
- Selects scoring mode per session step: **Metered** or **Expressive** (see [practice-bridge-product.md](practice-bridge-product.md), Section 4.5)
- Metered mode: DTW-based timing + pitch accuracy. Expressive mode: note accuracy + dynamics + completeness, no timing scoring.
- Tolerance parameters are configurable per exercise difficulty level
- Displays live scoring feedback in the exercise UI

**Why scoring lives in the browser:**
- Scoring algorithm can be iterated, A/B tested, and updated instantly without shipping Practice Bridge Desktop updates
- The browser selects scoring mode per session step based on the session manifest — Desktop streams the same note events regardless of mode
- All scoring visualization (note-by-note feedback, accuracy heatmaps, progress charts) is just React components consuming a WebSocket stream
- Practice Bridge Desktop only does what the browser cannot: real-time audio capture and pitch detection at audio-callback latency

### 11.2 Scoring Modes and Contexts

| Context | Reference Source | Scoring Mode | Method |
|---|---|---|---|
| Session step (metered) | Teacher-uploaded MIDI reference | **Metered** | DTW timing + pitch accuracy against reference |
| Session step (expressive) | Teacher-uploaded MIDI + optional recording | **Expressive** | Note accuracy + dynamics + completeness (no timing) |
| Platform exercise | Platform MIDI/note reference | **Metered** (default) | Browser compares note events vs. reference pattern |
| Jam-Along | Note events extracted from instrument estimate | **Metered** (default) | Browser compares student note events vs. reference note events |
| Free Practice | None | None | Browser displays tuner + technique analysis only (no score) |

The teacher selects the scoring mode per session step in the Session Builder. For standalone exercises and Jam-Along, the platform defaults to Metered scoring.

### 11.2b Expressive Scoring Mode

Expressive scoring is designed for musical passages where timing flexibility is expected — rubato, phrasing, interpretation, sight-reading. It evaluates three dimensions:

**Note accuracy (40% of score):** Did the student play the right notes? Pitch detection compares each detected note against the reference. Same tolerance thresholds as Metered mode per instrument (see Section 11.4). Missing notes reduce the score.

**Dynamics (30% of score):** Does the student's volume contour match the reference? If a reference recording is provided, the browser compares the velocity envelope of the student's performance against the reference. If no reference recording is provided, dynamics scoring evaluates consistency and intentionality (sudden unintentional volume spikes reduce the score, but deliberate crescendo/decrescendo is rewarded).

**Completeness (30% of score):** Did the student play all the notes in the passage? Measured as the percentage of reference notes that have a matching detected note (regardless of timing). A student who plays 18 of 20 notes scores 90% completeness.

**What Expressive scoring does NOT measure:** Timing. A student who plays the right notes with good dynamics but takes rubato liberties scores high. This is deliberate — the teacher selects Expressive mode precisely because they want to evaluate musicality, not metronomic precision.

**When to use Expressive mode:** Teachers select it for steps involving interpretation, phrasing, sight-reading, slow practice where timing will naturally vary, or any passage where "play it musically" matters more than "play it in time." Self-assessment conditions can complement Expressive scoring: "Score above 80% AND does this feel musical?"

### 11.3 Leaderboard Architecture (Hash-Based, Privacy-Preserving)

Leaderboards exist for both Exercise Mode (platform-owned or teacher-uploaded content) and Jam-Along Mode (user-provided audio). The key design constraint: **Jam-Along leaderboards must never reveal song identity on the server.**

**Architecture:**

```
┌──────────────────┐                      ┌──────────────────┐
│  Practice Bridge  │  AcoustID fp        │  Practice Bridge │
│  (local)          │─────────────────────│  SHA-256 hash    │
│                   │  songHash =         │  of fingerprint  │
│                   │   SHA-256(          │                  │
│                   │   chromaprint_fp +  │  NON-REVERSIBLE  │
│                   │   "pb-platform-salt"│                  │
│                   │  )                  │                  │
└────────┬─────────┘                      └──────────────────┘
       │
       │  WebSocket to Browser
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│   Browser (practicebridge.ai)                                │
│                                                              │
│   Displays locally:  "Billie Jean — Your Rank: #47 / 2,341" │
│   Sends to server:   { songHash: "a1b2c3...", score: 87.3 } │
│                       ↑ no song name, no artist, no audio    │
└──────────────────────────────────────────────────────────────┘
       │
       │  HTTPS REST API
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│   PB API (practicebridge.ai)                                 │
│                                                              │
│   LeaderboardEntry {                                         │
│     songHash:       "a1b2c3..."    // opaque, non-reversible │
│     userId:         "user_xyz"                               │
│     score:          87.3                                     │
│     timingAccuracy: 92.1           // % on-beat              │
│     noteAccuracy:   85.0           // % correct notes        │
│     tempo:          117            // BPM (non-identifying)  │
│     keySignature:   "F#m"          // (non-identifying)      │
│     timestamp:      "2026-02-19T..."                         │
│     displayLabel:   null           // NEVER populated server │
│   }                                                          │
│                                                              │
│   PB API groups scores by songHash → anonymous leaderboard   │
│   PB API CANNOT resolve songHash to song name (one-way hash) │
└─────────────────────────────────────────────────────────────┘
```

**How song names appear in the UI without the server knowing them:**

1. Practice Bridge computes AcoustID fingerprint → resolves to song title/artist locally
2. Practice Bridge also computes `songHash = SHA-256(chromaprint_fingerprint + salt)` — a one-way hash
3. Practice Bridge sends both the song name (via WebSocket, local only) and songHash to the browser
4. Browser displays the song name in the UI (local rendering only)
5. Browser sends `songHash` + score metrics to the server via HTTPS (no song name)
6. Server groups all entries with the same `songHash` into a leaderboard
7. When the browser fetches leaderboard data, it receives `[{songHash, userId, score, ...}]`
8. The browser matches `songHash` against its local cache of known songs to display names
9. If the browser doesn't have the song name cached, the entry appears as "Unknown Song #a1b2c3"

**Salting:** The hash includes a Practice Bridge-specific salt so the songHash cannot be cross-referenced against AcoustID's public database. The salt is owned and managed by practicebridge.ai.

**What the server sees vs. what the student sees:**

| Perspective | Leaderboard Display |
|---|---|
| **Server database** | `songHash: "a1b2c3..."` — Rank #1: user_abc (94.2), Rank #2: user_xyz (91.7)... |
| **Student's browser** | "Billie Jean" — Rank #1: @bassmaster99 (94.2), Rank #2: You (91.7)... |
| **Social share card** (platform-generated) | "Practice Session Score: 91.7% — Rank #2" (no song name) |
| **Student's manual share** (user types it) | "Got 91.7% on Billie Jean! #bassicology" (user's speech, not platform content) |

**Leaderboard types:**

| Type | Source | Song Name on Server? | Legal Risk |
|---|---|---|---|
| Exercise leaderboard | Platform-owned or teacher-uploaded exercises | Yes (platform or teacher owns the content) | 🟢 **ZERO** |
| Jam-Along leaderboard | User-provided audio, hash-based | **Never** — only opaque songHash | 🟢 **VERY LOW** |

**Cold-start strategy:** Leaderboards only feel meaningful with critical mass. Early-days handling:

- **Exercise leaderboards** are the primary engagement driver at launch. Students practice the same platform or teacher-uploaded exercises within a class, so these reach critical mass quickly.
- **Jam-Along leaderboards** with fewer than 5 entries show pioneering framing: "You're the first to practice this song! Set the bar for others." Not "Rank #1 of 1."
- **Personal bests** replace leaderboard comparison when per-song data is thin. "Your best: 87%. Previous: 82%. +5% improvement." The student competes with themselves.
- **Aggregate stats** provide value even with thin per-song data: total songs practiced, average score trend, weekly practice time.

**AcoustID opt-out and leaderboard display:** AcoustID lookup is opt-in (see [practice-bridge-business.md](practice-bridge-business.md), Section A.18). Students who opt out still get fully functional leaderboards — the `songHash` is computed locally from the Chromaprint fingerprint and does NOT require AcoustID. The only difference is the display label:

| AcoustID Setting | Leaderboard Display | Notes |
|---|---|---|
| Opted in | "Billie Jean — Rank #2 / 47" | Song name resolved via AcoustID, cached locally |
| Opted out | "Song #a1b2 — Rank #2 / 47" | Short hash prefix used as identifier |

The setting is **per-account, not per-session** — toggled in Settings under Privacy. When a student enables AcoustID, song identification begins for new practice sessions going forward. **Fingerprints computed during the opt-out period are NOT retroactively sent to AcoustID** — the student explicitly chose not to share those, and retroactive batch resolution would violate that consent boundary. Those historical entries remain as "Song #a1b2" permanently (unless the student practices the same song again with AcoustID enabled, at which point the new session's fingerprint resolves the name and the UI can match the songHash to update the display label locally). When a student disables AcoustID, their locally cached song names are cleared and entries revert to hash-based display. Other students on the same leaderboard who have AcoustID enabled will still see the song name — the display is per-client, not per-leaderboard.

**UX note:** The opt-out experience is explicitly designed to feel like a privacy choice, not a degraded experience. The leaderboard is identical in function — same ranking, same scores, same personal bests. Only the label differs.

### 11.4 Multi-Instrument Scoring Parameters

The scoring engine is instrument-agnostic at its core (DTW on note events), but each instrument needs different tolerance parameters. These are sent from the web platform as part of the `instrumentProfile` (see Section 7.2).

| Instrument | Pitch Tolerance | Timing Tolerance | Special Metrics | Input Method | Default Scoring Mode |
|---|---|---|---|---|---|
| **Bass** | ±50 cents | ±80ms | String detection, slap vs. fingerstyle, ghost notes | Audio (CPAL) | Metered |
| **Guitar** | ±30 cents | ±60ms | Chord detection (multiple simultaneous pitches), bend detection | Audio (CPAL) | Metered |
| **Vocals** | ±100 cents (wider for vibrato) | ±120ms (phrasing is freer) | Vibrato rate/depth, breath points, portamento | Audio (CPAL) | Expressive |
| **Drums** | N/A (unpitched) | ±30ms (tightest — drums are rhythm) | Hit velocity, rudiment detection, groove feel (swing %) | Audio (CPAL) | Metered |
| **Piano/Keyboard** | ±0 cents (exact MIDI) | ±50ms | Chord voicing, pedal usage, dynamics (velocity curves) | MIDI (direct) | Metered |
| **Violin/Strings** | ±40 cents | ±70ms | Intonation drift, vibrato, bow pressure (dynamics) | Audio (CPAL) | Expressive |
| **Wind (Sax, Trumpet)** | ±40 cents | ±70ms | Breath control (dynamics envelope), articulation | Audio (CPAL) | Metered |

*Default Scoring Mode is the platform default for standalone exercises. Teachers can override the scoring mode per session step in the Session Builder. Vocals and Strings default to Expressive because phrasing flexibility is fundamental to those instruments.*

**Technique-specific feedback per instrument:**

Practice Bridge streams raw note events. The browser applies instrument-specific analysis:

- **Bass/Guitar:** "You dragged 45ms on the bridge section" / "Your E was 30 cents sharp"
- **Vocals:** "Your vibrato was 5.2Hz — try slowing to 4Hz" / "You were flat on the high A"
- **Drums:** "Your hi-hat was 15ms ahead of the kick — tighten up" / "Swing ratio: 58% (target: 67%)"
- **Piano:** "Left hand was 40ms behind right hand in bar 12" / "Pedal lifted too early in bar 8"
- **Strings:** "Intonation drifted sharp through the passage" / "Vibrato was inconsistent on the sustained D"

This analysis is all browser-side TypeScript — Practice Bridge only detects pitch, onset, velocity, and dynamics.

### 11.5 Teacher Dashboard Metrics

For teacher mode, scoring data flows to the teacher's dashboard on practicebridge.ai. The teacher sees per-session, per-student results.

**Metered scoring dashboard (timing-focused):**

```
┌─────────────────────────────────────────────────────────────┐
│  SESSION: "Autumn Leaves Bridge" — Student: Alex M.          │
│                                                              │
│  Steps completed: 5/5 (1 remediation branch taken)           │
│  Total practice time: 22 min                                 │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  Step 3: Hands Together (Metered, 60% tempo)                 │
│  Attempts: 8 (branched after 6, returned, passed on 8th)     │
│  Best Score: 84.2%                                           │
│                                                              │
│  Timing Analysis:                                            │
│  ■■■■■■■■□□ 82% on-beat                                     │
│  Bars 5-6: dragged avg 35ms (descending line)                │
│  Bars 1-4: solid, within 15ms                                │
│                                                              │
│  Note Accuracy:                                              │
│  ■■■■■■■■■□ 91%                                              │
│  Missed: bar 6 beat 3, bar 8 beat 1                          │
│                                                              │
│  Dynamics:                                                   │
│  ■■■■■■■□□□ 73%                                              │
│                                                              │
│  Progress: Attempt 1 (58%) → ... → Attempt 8 (84%) ↑        │
│  Teacher Notes: [Add feedback for student...]                │
└─────────────────────────────────────────────────────────────┘
```

**Expressive scoring dashboard (musicality-focused):**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 5: Full tempo with expression (Expressive, 100%)       │
│  Self-assessment: "Does this feel musical?" → "Yes"          │
│  Expressive Score: 79.4%                                     │
│                                                              │
│  Note Accuracy (40%):  ■■■■■■■■■□ 88%                       │
│  Dynamics (30%):       ■■■■■■■□□□ 72%                        │
│    Chorus dynamics flat — verse and chorus at similar volume  │
│  Completeness (30%):   ■■■■■■■■□□ 80% (16/20 notes)         │
│    Missed notes in bars 5-6 (descending line)                │
│                                                              │
│  (No timing analysis — Expressive mode)                      │
└─────────────────────────────────────────────────────────────┘
```

**What the server stores per attempt:**

```
SessionStepResult {
  sessionId:       "session_42"
  stepId:          "step_3"
  studentId:       "student_xyz"
  attemptNumber:   8
  scoringMode:     "metered"            // or "expressive"
  overallScore:    84.2
  timingAccuracy:  82.0                 // null if expressive
  noteAccuracy:    91.0
  dynamicsScore:   73.0
  completeness:    null                 // null if metered
  timingDetails:   [...]                // null if expressive
  missedNotes:     [{bar: 6, beat: 3}, {bar: 8, beat: 1}]
  selfAssessment:  null                 // or "yes"/"no" for self-assessment steps
  timestamp:       "2026-02-19T..."
  instrument:      "piano"
  practiced_at:    "2026-02-19T..."     // device clock (for offline sync)
}
```

**No audio on server.** The teacher sees numbers, charts, and text feedback — never audio.

---

## 12. Complete Feature Set

| # | Feature | Where | Description | Legal Risk |
|---|---|---|---|---|
| 1 | Chromatic Tuner | PB Desktop analyzes, Browser renders | Pitch detection on instrument input. Pure measurement. | 🟢 **ZERO** |
| 2 | Exercise Scoring (Metered) | PB Desktop detects notes, Browser scores | DTW timing + pitch accuracy against platform or teacher-uploaded exercises. | 🟢 **ZERO** |
| 3 | Expressive Scoring | PB Desktop detects notes, Browser scores | Note accuracy + dynamics + completeness. No timing scoring. For rubato/interpretation. | 🟢 **ZERO** |
| 4 | Session Builder | Browser (practicebridge.ai) | Teachers build programmable practice sessions with conditions, branching, stacked variations. | 🟢 **ZERO** |
| 5 | Session Preload | Browser + PB Desktop | Browser downloads entire session package at start. No mid-session downloads. | 🟢 **ZERO** |
| 6 | Stem Removal | PB Desktop processes, Browser controls | AI instrument attenuation from audio. In-memory only, progressive purge. No isolated stems exposed. | 🟡 **LOW-MODERATE** |
| 7 | Song Metadata Display | PB Desktop detects, Browser renders (local-only — never sent to server) | Title, key, BPM, genre. Uncopyrightable facts. Displayed locally, never stored on server. | 🟢 **ZERO** |
| 8 | Technique Assessment | PB Desktop analyzes, Browser renders | Analyzes student's own playing technique (dynamics, articulation). | 🟢 **ZERO** |
| 9 | Coaching Notes | Browser only | Contextual instructions surfaced per session step. Teacher-authored or platform-generated. | 🟢 **ZERO** |
| 10 | Leaderboards | Browser + Server | Exercise leaderboards (platform/teacher content) + Jam-Along leaderboards (hash-based, song name never on server — see Section 11.3). | 🟢 **VERY LOW** |
| 11 | Practice Analytics | Browser + Server | Time spent, accuracy trends, streaks, weak spots. Teacher dashboard with class-wide analytics. | 🟢 **ZERO** |
| 12 | Multi-Take Recording | PB Desktop records, Browser manages | Records student's own performance. Student's content. | 🟢 **ZERO** |
| 13 | Teacher Dashboard | Browser (practicebridge.ai) | Session Builder, assignment tracking, per-student and class-wide analytics, feedback. | 🟢 **ZERO** |
| 14 | Metadata Upload | Browser → Server | Score, BPM, key sent to server. No song title, no audio, no song ID. | 🟢 **VERY LOW** |
| 15 | Browser Extension | Extension → PB Desktop | Tab audio capture via `tabCapture` API. Audio stays local. | 🟢 **VERY LOW** |
| 16 | Local-Only Mode | PB Desktop + Browser | Offline practice with no data leaving the device. | 🟢 **ZERO** |
| 17 | CLI / Headless Mode | PB Desktop only | Batch analysis and scripted workflows. | 🟢 **ZERO** |
| 18 | Self-Assessment Mode | Browser only | Student evaluates their own playing. First-class condition type usable with or without Desktop/Mobile. | 🟢 **ZERO** |
| 19 | AI Session Builder | Browser + n8n + LLM API | Teacher describes session in plain language, AI agent builds structure. n8n orchestration. | 🟢 **ZERO** |
| 20 | Mobile App (Audio) | Phone → Browser via WiFi | Phone mic captures instrument, streams onset/pitch data to browser. Session audio plays through phone headphones. | 🟢 **ZERO** |
| 21 | Mobile App (Vision) | Phone → Browser via WiFi | Phone camera → MediaPipe → coarse hand position data. Raw video stays on device. | 🟢 **ZERO** |
| 22 | Instrument Profiles | Browser → Desktop/Mobile | Per-instrument configuration: pitch range, detection mode, scoring approach, known artifacts. | 🟢 **ZERO** |

*Note: Stem Removal (Feature 6) risk is reduced from MODERATE to LOW-MODERATE compared to full stem separation because no isolated stems are ever created, stored, or exposed. The feature operates as a real-time audio transformation, not a decomposition.*

---

## 13. Practice Bridge UI: System Tray Application

### 13.1 Design Principle

Practice Bridge has **no main window**. It is a system tray (macOS menubar / Windows notification area) application with a small popover panel (~300x200px). Think Docker Desktop whale icon or the Bluetooth menubar item — infrastructure, not the product.

### 13.2 System Tray Popover

```
┌──────────────────────────────┐
│  🟢 Connected to practicebridge.ai │
│                              │
│  Audio Device:               │
│  ┌──────────────────────▼──┐ │
│  │ Focusrite Scarlett 2i2  │ │
│  └─────────────────────────┘ │
│                              │
│  Input Level:                │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░  -12 dB  │
│                              │
│  ⚙ Settings                  │
└──────────────────────────────┘
```

**Elements:**
- **Connection status** — green dot when connected to a browser tab via WebSocket (practicebridge.ai or a tenant's page)
- **Audio device selector** — dropdown to choose input/output audio interface
- **Input level meter** — VU meter so the student knows their signal is coming through
- **Settings gear** — opens a small settings panel: buffer size, ASIO device selection (Windows), sample rate, auto-launch on login

**Practice Bridge Desktop v1 (Week 20-26):** The system tray popover is simpler than shown above. v1 includes only: connection status (green dot when connected to browser), input level meter, and settings gear (minimal: auto-launch on login). The audio device selector, buffer size configuration, and ASIO settings are added when the mixer ships (Week 26-34). Practice Bridge Desktop v1 uses the system default audio input device.

### 13.3 What Is NOT in Practice Bridge Desktop

- No exercise UI
- No transport controls (play/stop/tempo)
- No fretboard visualization
- No tuner display
- No stem/removal faders
- No scoring display
- No file browser UI (the native OS file picker is triggered by the browser, but runs as a system dialog owned by Practice Bridge)
- No waveform display

All of these live on practicebridge.ai (or on the tenant's domain for tenant-specific features).

---

## 14. Local-Only Mode & CLI

### 14.1 Local-Only Mode

Some students — particularly in jurisdictions with stricter copyright enforcement (UK, Australia) or privacy-conscious users — may not want any data leaving their device.

"Local-Only" means no data goes to any **server** (practicebridge.ai or tenant). Practice Bridge Desktop ↔ browser localhost communication still works — it's local IPC, not network traffic.

| Capability | Local-Only | Connected |
|---|---|---|
| Exercise playback | ✅ (cached exercises) | ✅ |
| Stem removal | ✅ | ✅ |
| Tuner | ✅ | ✅ |
| Scoring | ✅ (stored in local SQLite) | ✅ (synced to platform) |
| Practice analytics | ✅ (local SQLite) | ✅ (synced to platform) |
| AcoustID fingerprinting | ❌ (disabled) | ✅ |
| Leaderboards | ❌ | ✅ |
| Teacher mode | ❌ | ✅ |
| Groove cards | ✅ (local only) | ✅ (synced) |

Students toggle between modes in the browser UI. When switching from Local-Only to Connected, the platform offers to sync accumulated local data.

### 14.2 CLI / Headless Mode

Power users, teachers, and developers can script Practice Bridge for batch processing without launching the GUI or browser.

```bash
# Analyze a file (BPM, key, song identification — metadata only)
practice-bridge analyze ~/Music/song.wav --output-json

# Batch analyze a directory (metadata only — no audio is written)
practice-bridge analyze ~/Music/*.wav --output-csv results.csv

# Launch tuner on a specific audio device
practice-bridge tune --device "Focusrite Scarlett 2i2"

# Score a performance against a reference (outputs score metadata, not audio)
practice-bridge score --input my-take.wav --reference exercise-123.mid --output-json
```

**⚠️ Design Constraint: No Audio Output to Disk.** The CLI intentionally does not include a "remove-instrument-and-save" command. Writing processed audio to disk would create a fixed reproduction in a tangible medium, undermining the transient in-memory processing architecture that is central to the legal framework (Appendix A, Pillar 3). Stem removal is only available in real-time playback mode, where processed audio exists only in a rolling RAM buffer and is progressively purged.

The Tauri binary exposes a CLI entry point (`clap` argument parser) that skips the WebView entirely. All audio processing modules are shared between tray app and CLI modes — no code duplication.

---

## 15. Database Schema

### 15.1 Practice Bridge Server Database (practicebridge.ai — Supabase/PostgreSQL)

The Practice Bridge API server owns all practice-related data. `tenant_id` identifies which client platform originated the data (e.g., `'bassicology'`). Multi-platform support from day one. Never stores audio or song names.

```sql
-- Core user tables
profiles (
  id              UUID PRIMARY KEY,      -- Supabase auth user ID
  tenant_id       TEXT DEFAULT 'practicebridge',  -- 'practicebridge', 'bassicology', etc.
  display_name    TEXT,
  instrument      TEXT DEFAULT 'bass',
  role            TEXT DEFAULT 'student',      -- 'student' | 'teacher' | 'admin'
  notification_channels JSONB DEFAULT '["in_app"]',  -- ["in_app", "email", "push", "sms"]
  acoustid_opt_in BOOLEAN DEFAULT FALSE,             -- AcoustID fingerprint lookup consent
  created_at      TIMESTAMPTZ
)

-- Teacher/class infrastructure
classes (
  id              UUID PRIMARY KEY,
  tenant_id       TEXT DEFAULT 'practicebridge',
  teacher_id      UUID REFERENCES profiles(id),
  name            TEXT,                        -- "Monday Jazz Ensemble"
  instrument      TEXT,                        -- default instrument for class
  created_at      TIMESTAMPTZ
)

class_members (
  class_id        UUID REFERENCES classes(id),
  student_id      UUID REFERENCES profiles(id),
  joined_at       TIMESTAMPTZ,
  PRIMARY KEY (class_id, student_id)
)

-- Assignments
assignments (
  id              UUID PRIMARY KEY,
  tenant_id       TEXT DEFAULT 'practicebridge',
  class_id        UUID REFERENCES classes(id),
  teacher_id      UUID REFERENCES profiles(id),
  title           TEXT,                        -- "Practice Billie Jean — focus on bridge"
  instructions    TEXT,                        -- teacher's written instructions
  target_timing   REAL,                        -- target timing accuracy %
  target_notes    REAL,                        -- target note accuracy %
  due_date        DATE,
  created_at      TIMESTAMPTZ
)

assignment_students (
  assignment_id   UUID REFERENCES assignments(id),
  student_id      UUID REFERENCES profiles(id),
  PRIMARY KEY (assignment_id, student_id)
)

-- Practice results (the core data — no audio, no song names)
practice_results (
  id              UUID PRIMARY KEY,
  tenant_id       TEXT DEFAULT 'practicebridge',
  student_id      UUID REFERENCES profiles(id),
  session_step_id UUID REFERENCES session_steps(id), -- NULL for free practice / Jam-Along
  assignment_id   UUID REFERENCES assignments(id),    -- NULL for free practice
  exercise_id     UUID,                                -- NULL for Jam-Along
  song_hash       TEXT,                                -- opaque SHA-256, NULL for exercises
  scoring_mode    TEXT DEFAULT 'metered',               -- 'metered' | 'expressive'
  attempt_number  INT,
  overall_score   REAL,
  timing_accuracy REAL,                                -- NULL if expressive mode
  note_accuracy   REAL,
  dynamics_score  REAL,
  completeness    REAL,                                -- NULL if metered mode
  self_assessment TEXT,                                -- NULL | 'yes' | 'no' (for self-assessment steps)
  timing_details  JSONB,                               -- per-bar timing offsets (NULL if expressive)
  missed_notes    JSONB,                               -- [{bar, beat}]
  bpm             INT,
  key_signature   TEXT,
  instrument      TEXT DEFAULT 'bass',
  duration_sec    INT,
  practiced_at    TIMESTAMPTZ,                         -- device clock timestamp (for offline sync due-date resolution)
  created_at      TIMESTAMPTZ                          -- server receipt timestamp
)

-- Leaderboards (hash-based, privacy-preserving)
leaderboard_entries (
  id              UUID PRIMARY KEY,
  tenant_id       TEXT DEFAULT 'practicebridge',
  song_hash       TEXT NOT NULL,               -- opaque, non-reversible
  student_id      UUID REFERENCES profiles(id),
  score           REAL,
  timing_accuracy REAL,
  note_accuracy   REAL,
  bpm             INT,
  key_signature   TEXT,
  created_at      TIMESTAMPTZ,
  UNIQUE (song_hash, student_id)               -- one entry per student per song
)

-- Teacher feedback
teacher_feedback (
  id              UUID PRIMARY KEY,
  assignment_id   UUID REFERENCES assignments(id),
  student_id      UUID REFERENCES profiles(id),
  teacher_id      UUID REFERENCES profiles(id),
  feedback_text   TEXT,
  created_at      TIMESTAMPTZ
)

-- Practice streaks and analytics
practice_streaks (
  student_id      UUID REFERENCES profiles(id) PRIMARY KEY,
  current_streak  INT DEFAULT 0,
  longest_streak  INT DEFAULT 0,
  total_sessions  INT DEFAULT 0,
  total_minutes   INT DEFAULT 0,
  last_practice   DATE
)

-- Practice sessions (Session Builder)
sessions (
  id              UUID PRIMARY KEY,
  tenant_id       TEXT DEFAULT 'practicebridge',
  teacher_id      UUID REFERENCES profiles(id),
  title           TEXT,                        -- "Autumn Leaves Bridge — Week 3"
  description     TEXT,
  instrument      TEXT,                        -- default instrument for session
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
)

session_steps (
  id              UUID PRIMARY KEY,
  session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE,
  step_order      INT NOT NULL,
  title           TEXT,                        -- "Right Hand melody"
  instructions    TEXT,                        -- contextual instruction text
  scoring_mode    TEXT DEFAULT 'metered',      -- 'metered' | 'expressive'
  tempo_pct       INT DEFAULT 100,             -- tempo percentage (60, 80, 100, etc.)
  midi_url        TEXT,                        -- CDN URL for MIDI reference
  reference_audio_url TEXT,                    -- CDN URL for reference recording (optional)
  backing_track_url   TEXT,                    -- CDN URL for backing track (optional)
  audio_source        TEXT DEFAULT 'none',     -- 'teacher_recording' | 'backing_track' | 'none' (see practice-bridge-live-lesson.md, Section 9.1)
  UNIQUE (session_id, step_order)
)

session_conditions (
  id              UUID PRIMARY KEY,
  step_id         UUID REFERENCES session_steps(id) ON DELETE CASCADE,
  condition_type  TEXT NOT NULL,               -- 'score_threshold' | 'repetition' | 'time_limit' | 'self_assessment' | 'combined'
  threshold       REAL,                        -- e.g., 85.0 for 85% score
  value           JSONB,                       -- e.g., {"consecutive": 3} or {"minutes": 5} or {"options": ["I nailed it", "Needs work"]}
  combinator      TEXT DEFAULT 'and'           -- 'and' | 'or' (for combined conditions)
)

session_branches (
  id              UUID PRIMARY KEY,
  step_id         UUID REFERENCES session_steps(id) ON DELETE CASCADE,
  condition_type  TEXT NOT NULL,               -- 'advance' | 'branch'
  trigger_after   INT,                         -- branch after N failed attempts (NULL for advance)
  target_step_id  UUID REFERENCES session_steps(id), -- step to jump to
  UNIQUE (step_id, condition_type)
)

session_assignments (
  id              UUID PRIMARY KEY,
  session_id      UUID REFERENCES sessions(id),
  class_id        UUID REFERENCES classes(id),
  teacher_id      UUID REFERENCES profiles(id),
  due_date        DATE,
  notes           TEXT,                        -- teacher's assignment notes
  created_at      TIMESTAMPTZ
)

-- Platform integrations (which client platforms can call the API)
platform_integrations (
  id              UUID PRIMARY KEY,
  platform_key    TEXT UNIQUE NOT NULL,      -- 'bassicology', etc.
  display_name    TEXT,                      -- 'Bassicology'
  api_key_hash    TEXT NOT NULL,             -- hashed API key for S2S auth
  webhook_url     TEXT,                      -- callback URL for async notifications
  created_at      TIMESTAMPTZ
)

-- AI session builder audit trail
ai_session_drafts (
  id              UUID PRIMARY KEY,
  teacher_id      UUID REFERENCES profiles(id),
  prompt_text     TEXT NOT NULL,              -- teacher's natural language input
  generated_json  JSONB NOT NULL,            -- AI-generated session structure
  llm_model       TEXT,                      -- which model generated (claude-4, gpt-4, etc.)
  approved        BOOLEAN DEFAULT FALSE,      -- teacher approved and converted to real session
  session_id      UUID REFERENCES sessions(id), -- linked session if approved
  created_at      TIMESTAMPTZ
)
```

### 15.1b Tenant Database Example (Bassicology)

Tenants own their domain-specific content. Practice data lives on the Practice Bridge server — tenants query it via the S2S API. Bassicology's database is shown as an example of what a tenant stores independently: instrument-specific exercises, visualization data, and user preferences that are outside Practice Bridge's scope. Other tenants (guitar, piano, voice) would have analogous tables for their instrument-specific content.

### 15.2 Practice Bridge-Side (Local SQLite)

Practice Bridge stores cached data and offline practice sessions:

```sql
-- Cached exercise backing tracks
cached_exercises (
  exercise_id     TEXT PRIMARY KEY,
  audio_path      TEXT,                        -- local file path
  reference_data  TEXT,                        -- JSON: note events for scoring
  cached_at       INTEGER                      -- Unix timestamp
)

-- Cached session packages (for offline-capable sessions)
cached_sessions (
  session_id      TEXT PRIMARY KEY,
  manifest_json   TEXT,                        -- full session manifest (steps, conditions, branching)
  audio_dir       TEXT,                        -- local directory with MIDI/audio files
  cached_at       INTEGER                      -- Unix timestamp
)

-- Offline practice results (synced when online)
offline_results (
  id              TEXT PRIMARY KEY,
  result_json     TEXT,                        -- full practice_results row as JSON
  synced          INTEGER DEFAULT 0,           -- 0 = pending sync to practicebridge.ai, 1 = synced
  practiced_at    INTEGER,                     -- device clock timestamp when session was completed
  created_at      INTEGER
)

-- Local practice analytics
local_analytics (
  date            TEXT,                         -- YYYY-MM-DD
  total_minutes   INTEGER,
  exercises_done  INTEGER,
  jam_alongs_done INTEGER,
  avg_score       REAL
)
```

### 15.3 What Is NOT in Any Database

- Audio files (original or processed)
- Song names, artist names, album names
- AcoustID fingerprints
- Chromaprint data
- Any data that could identify a specific copyrighted song

---

## 16. Software Stack

### 16.1 Practice Bridge Technology

| Component | Technology | License | Cost | Notes |
|---|---|---|---|---|
| Application Framework | **Tauri 2.x** | MIT | Free | v2.10+ — system tray support, deep-link plugin, binary IPC |
| Audio I/O | **CPAL 0.17+** | Apache 2.0 | Free | CoreAudio (macOS), WASAPI/ASIO (Windows), ALSA/JACK (Linux) |
| ML Inference | **ort 2.0** (ONNX Runtime) | MIT | Free | Execution providers: CoreML, CUDA, DirectML — single codebase, any GPU |
| Real-Time Analysis | **pYIN** (`pyin-rs`, direct Rust DSP) + **tract** (Sonos, for ML models if needed) | MIT/Apache 2.0 | Free | pYIN pitch detection, onset detection, BPM — runs in audio callback at µs latency. tract reserved for future ML model inference (e.g., SwiftF0). |
| WebSocket Server | **tokio-tungstenite** | MIT | Free | Localhost server for browser communication |
| Deep Links | **tauri-plugin-deep-link** | MIT | Free | Custom `practicebridge://` URI scheme |
| CLI Parser | **clap** | MIT | Free | Headless mode argument parsing |
| Local Database | **SQLite** (via `rusqlite`) | Public Domain | Free | Local-Only Mode score/analytics storage |
| Audio File Cache | Local filesystem | N/A | Free | Cached exercise backing tracks from CDN |
| Model Weights | ZFTurbo community weights | MIT / Open | Free | Separation model, ~100-500 MB |
| Audio Fingerprinting | Chromaprint / AcoustID | LGPL / Free API | Free | Song identification |
| Song Metadata | MusicBrainz API | CC0 | Free | Title, artist, album |
| AEC (Desktop) | **CPAL** (existing) + platform audio APIs | Apache 2.0 | Free | macOS: CoreAudio Voice Processing IO. Windows: WASAPI AEC. Click track removal for teacher recordings (Section 10b). |

**Phased delivery (v6.0):** Practice Bridge Desktop v1 (Week 20-26) uses only a subset of this stack:

| Component | Practice Bridge Desktop v1 | Added Later |
|-----------|--------------------------|-------------|
| Tauri 2.x | Yes | — |
| CPAL (input only) | Yes | Output + mixer at Week 26-34 |
| pyin-rs | Yes | — |
| tokio-tungstenite | Yes | — |
| tauri-plugin-deep-link | Yes | — |
| ort (ONNX) | No | Week 26-34 (stem removal) |
| tract | No | Future (ML models) |
| clap (CLI) | No | Week 34+ |
| SQLite | No | Week 34+ |
| Chromaprint/AcoustID | No | Week 26-34 |

The architecture accommodates this phased delivery because each component is a separate Rust crate/module that plugs into the audio pipeline independently.

**Platform support:** macOS and Windows at launch. **Linux is not supported at launch.** Tauri 2.x and CPAL both support Linux (ALSA/JACK/PipeWire), so the architecture doesn't preclude it. Linux support is a post-launch decision based on demand.

### 16.1b Practice Bridge Mobile Technology

| Component | Technology | License | Cost | Notes |
|---|---|---|---|---|
| Application Framework | **Flutter** (Dart) | BSD | Free | Cross-platform iOS + Android. Compiled-to-native approach chosen for better audio/camera latency and consistent cross-platform behavior — critical for a hardware-interface-heavy companion app. |
| Audio Capture | Platform-native mic APIs | N/A | Free | AudioRecord (Android), AVAudioEngine (iOS) |
| Audio Playback | Platform-native audio output | N/A | Free | Session audio to headphones, click track to speaker |
| AEC (iOS) | **AVAudioEngine Voice Processing IO** | N/A | Free | Hardware-accelerated AEC via Apple Neural Engine. Automatically cancels speaker output from mic input. See Section 10b.4. |
| AEC (Android) | **AcousticEchoCanceler** (system) + **WebRTC AEC3** (bundled fallback, ~200KB) | Apache 2.0 | Free | System AEC for flagship devices. Bundled WebRTC AEC3 C++ library for consistent quality on budget Android OEMs. See Section 10b.4. |
| Pitch Detection | **pYIN** (via FFI to Rust `pyin-rs`) | MIT | Free | pYIN pitch detection, onset detection on-device. Same Rust implementation as Desktop, exposed via Flutter platform channels. |
| Computer Vision | **MediaPipe Hands** | Apache 2.0 | Free | On-device hand landmark detection |
| Communication | **WebSocket client** (WiFi to browser) | N/A | Free | Note events + position data |
| Local Processing | On-device only | N/A | Free | No raw audio or video leaves device |

**Platform support:** iOS and Android at launch. The app is lightweight — no ML models beyond MediaPipe's hand detection. Audio processing (pYIN pitch detection) uses the same Rust implementation as Desktop (`pyin-rs`), exposed via Flutter platform channels and FFI. Click track removal (Section 10b) uses native platform AEC on both platforms — no additional ML models required on-device.

### 16.2 Browser Extension Technology

| Component | Technology | License | Cost |
|---|---|---|---|
| Extension Framework | Chrome Manifest V3 / Firefox WebExtensions | N/A | Free |
| Audio Capture | `chrome.tabCapture` API | N/A | Free |
| Communication | WebSocket client to `ws://localhost` | N/A | Free |

### 16.3 Inference Architecture: Two-Tier Model

```
┌──────────────────────────────────────────────────────────┐
│  Audio Callback Thread (real-time, <1ms budget)          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Direct Rust DSP (pyin-rs, no C deps, no GPU)      │  │
│  │  • pYIN pitch detection (instrument input)         │  │
│  │  • Onset detection (instrument input)              │  │
│  │  • BPM tracking (file/stream input)                │  │
│  │  → streams note events + tuner data to browser     │  │
│  │  (tract reserved for future ML models e.g. SwiftF0)│  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Background Thread (non-real-time, 2-6s budget)          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ort / ONNX Runtime (GPU-accelerated)              │  │
│  │  • Separation model inference                      │  │
│  │  • Produces instrument-removed mix (discards stem) │  │
│  │  Execution Provider Tiering:                       │  │
│  │    Tier 1: CoreML (macOS) / CUDA (NVIDIA)          │  │
│  │            / DirectML (AMD/Intel)                  │  │
│  │    Tier 2: CPU optimized threadpool                │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Audio Output Thread (real-time)                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │  CPAL Mixer                                        │  │
│  │  • Input A: instrument (live, from audio interface) │  │
│  │  • Input B: backing track OR instrument-removed mix │  │
│  │  • Output: headphones (4-6ms total latency)        │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Practice Bridge Desktop v1 (Week 20-26)** implements only the Audio Callback Thread (top tier). The Background Thread (ONNX inference for stem removal) and Audio Output Thread (CPAL mixer for headphone output) are added at Week 26-34. Practice Bridge Desktop v1 captures audio input, runs pYIN pitch detection and onset detection in the audio callback, and streams note events + tuner data to the browser. No mixer, no ONNX, no audio output.

### 16.4 Web Platform Infrastructure

**practicebridge.ai (Full Platform):**

| Component | Service | Purpose |
|---|---|---|
| Database | Supabase | Student/teacher accounts, sessions, scores, assignments, leaderboards, streaks, analytics |
| API Server | Railway | REST API server, S2S tenant authentication, webhook processing |
| Frontend Hosting | Vercel | practicebridge.ai — Session Builder, session player, teacher dashboard, student dashboard, class management |
| CDN | Vercel/Supabase Storage | Session audio assets (MIDI, backing tracks, reference recordings) |
| AI Orchestration | n8n (self-hosted or cloud) | AI Session Builder workflows — receives teacher prompt, orchestrates LLM call, returns structured session JSON. Also handles Live Lesson Mode processing pipeline (audio → transcription → domain evaluation → session steps). See [practice-bridge-live-lesson.md](practice-bridge-live-lesson.md). |
| LLM API | Claude / GPT-4 (via API) | Natural language → session structure translation. Also powers Domain Evaluator for Live Lesson Mode ([practice-bridge-live-lesson.md](practice-bridge-live-lesson.md), Section 6). |
| Speech Transcription | Whisper.cpp / whisper-rs (local) | Live Lesson Mode speech-to-text for teacher voice instructions. Runs locally on Desktop. See [practice-bridge-live-lesson.md](practice-bridge-live-lesson.md), Section 5.5. |
| Audio Cleanup (AEC Tier 2) | **SpeexDSP** (C, via Python ctypes) + **scipy/numpy** | Server-side click track removal: adaptive filter (4096 taps), cross-correlation alignment, spectral subtraction. Processes teacher recordings post-upload. <2 seconds per 60-second recording. See Section 10b.5. |
| Domain | practicebridge.ai | Practice Bridge platform |

**Tenant infrastructure (e.g., Bassicology — separate, tenant-owned):**

Tenants host their own domain-specific UI and content. Bassicology (bassicology.com) hosts bass exercises, 3D fretboard visualization, and YouTube sync. Tenant infrastructure costs are borne by the tenant, not by Practice Bridge. Tenants call the Practice Bridge REST API for all practice data operations.

---


---

*[Product Specification](practice-bridge-product.md) | Continue to [Business & Strategy](practice-bridge-business.md) | [Live Lesson Mode](practice-bridge-live-lesson.md) | [Overview](practice-bridge-condensed.md)*
