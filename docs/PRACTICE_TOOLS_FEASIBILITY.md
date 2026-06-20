# Practice Tools — Feasibility Exploration

**Status:** Exploration / not committed. No code written.
**Date:** 2026-06-19
**Question that started it:** "User pastes a YouTube link and our platform gives them tools
to practice the thing the YouTuber shows — loop a section, metronome, etc. How far-fetched?"
Then broadened to: "Assemble proven market tools, polish them, bundle them behind the base
membership — what can we build?" Landed on: **"Moises but bass-first" — upload a song, pull
the bass out, mute it, practice the backing track.**

---

## The one concept that governs everything: the audio-access wall

Every idea here lives on one side of a single hard line:

> **A website embedding the YouTube IFrame player can CONTROL the video
> (seek / play / pause / getCurrentTime) but has NO access to its audio samples (PCM).**
> Pulling YouTube audio out (yt-dlp, etc.) violates YouTube ToS.

- **No-audio side** = legally clean, cheap, mostly reuse. (Looping, Set-A/B, tap-tempo metronome.)
- **Needs-audio side** = either illegal (ripping YouTube) OR requires the user to bring their
  own file (clean) OR a browser extension that can tap the tab's audio (clean-ish, separate build).

The tiers do **not** smoothly upgrade — Tier 1 ↔ Tier 1.5 is a **chasm**, because Tier 1 needs
zero audio and everything above it needs audio a website can't get from YouTube.

### Key consequence
You **cannot** do in-tune slow-down / pitch-shift / EQ / beat-detection on YouTube audio as a
**website**. Your signalsmith/Tone.js stretch engine works on audio you *possess* (your stems,
user uploads), not on the YouTube `<iframe>`. The market extensions (Transpose, KeyPitch) can do
it on YouTube only because **a Chrome extension runs inside the tab and can tap `<video>` audio
via `captureStream`/Web Audio** — a capability a sandboxed website does not have.

---

## The tiers (YouTube path)

| Tier | What | Effort | Legal | Notes |
|---|---|---|---|---|
| **1** | Loop a section + tap-tempo metronome + count-in + coarse speed | days | ✅ clean | ~5 systems already hardened (see Reuse). |
| 1.5 | + auto BPM / key detection | weeks | ⚠️ audio wall | Needs audio → not possible on YouTube as a website. |
| 2 | Notes → tab/drill (transcription) | months | ❌ ToS + audio wall | Research frontier; needs owned audio. |

### How loop boundaries are found (Tier 1)
The platform does **not** analyze the video. The **user** sets boundaries — and that's fine:
1. **Drag** on a timeline/scrubber (baseline — you already have draggable region UI).
2. **Set-A / Set-B buttons while it plays** (the good UX — `getCurrentTime()` at each press).
3. **±0.1s nudge while looping** (the loop is its own feedback — matches the ear-first principle).

Loop enforcement = a guard loop on the YouTube clock:
`poll getCurrentTime() ~4×/s → if currentTime >= loopEnd then seekTo(loopStart)`.
No transport engine needed for the *video* loop; metronome BPM comes from **tap-tempo**, not analysis.

### Legal summary (Tier 1 YouTube looping)
- **Copyright: low.** No copy made — authorized stream replayed. A loop is not a copy.
- **YouTube ToS: the real risk, contractual not copyright.** Must use official IFrame API
  (driving it as intended = OK), must **NOT interfere with / skip / obscure ads** (pause the
  guard loop during ad playback), must keep player visible/branded, no audio-only.
- **Worst realistic case = API key revoked**, not a lawsuit.
- **Action before shipping:** read current YouTube API Services ToS (ad/branding clauses move).

---

## Browser extension (the YouTube-DSP unlock + distribution)

A Chrome/Firefox/Edge extension runs **inside** the YouTube tab and **can tap the audio** the
website can't. This unlocks, *on any YouTube video*: in-tune slow-down, pitch/transpose, EQ /
"solo the bass" frequency isolation, beat detection, and a fretboard overlay on the page.

- **You already own the hard part** — the Web Audio graph + the stretch engine. The extension is
  mostly a new *shell* around DSP you've shipped.
- **Strategic payoff:** (1) goes from "worse than the free extensions" to "as good + bass-specialized";
  (2) Chrome Web Store = a discovery/acquisition funnel toward your login; (3) reuses the existing
  Supabase auth + `subscriptions` entitlement (free = loop+metronome, member = DSP).
- **Costs:** separate MV3 codebase + Google store review; tightest ToS exposure (audio tap + playback
  replacement); ads still apply. Reference: Transpose has 1M+ users doing exactly this.
- **Verify before committing:** current Chrome Web Store policies + YouTube's stance on audio-tapping
  extensions (this is the place the ground has shifted recently).

---

## The headline idea: "Moises but bass-first" (in-browser stem separation)

**Upload your song → we pull the bass out → practice the backing track with loop / slow-down /
transpose / metronome.** This is the **best fit for the stack** of everything explored.

### Why the user's "just extract & mute the bass" narrowing is a big deal
1. **2-stem problem, not 6-stem.** Bass vs. everything-else, not full multi-instrument separation.
2. **Mute is more forgiving than solo.** Residual bass bleed into "other" is masked by the user's
   own bass playing on top → imperfect separation is acceptable. (Solo-for-transcription would not be.)
3. Bass occupies a distinct frequency band → even crude approaches get partway as a fallback.

### Feasibility: weeks, not months — the hard part is pre-built
- **Demucs v4 (htdemucs) runs IN the browser TODAY** via ONNX Runtime Web (WebGPU accel, WASM
  fallback) — `demucs-web`, `demucs.app`. Splits drums/**bass**/other/vocals client-side.
- **~80 MB model weights, MIT license — commercially usable** (you still need rights to the music,
  which the *user* supplies by bringing their own file).
- htdemucs ≈ **9.0 dB SDR** vs Spleeter's ~5.9 — "substantially cleaner, less bleeding."
- **No server: $0 storage, $0 compute, $0 bandwidth, no job queue, no GPU infra, works offline
  after model download.** The user's machine does the work.

### Pipeline (bass-mute)
```
upload file → decodeAudioData → AudioBuffer
  → run htdemucs (ONNX/WebGPU) ONCE → {bass, drums, other, vocals}
  → backing track = drums + other + vocals (sum non-bass stems)
  → cache stems in IndexedDB keyed by file hash
  → playback through EXISTING audio graph: A/B loop, in-tune slow-down, transpose, metronome
  → "mute bass" = play backing only;  "hear bass" = add bass stem back in
```
The bottom half (loop/slow-down/transpose/metronome) is **entirely the existing playback domain.**
Separation is a front-end preprocessing step feeding machinery already shipped → **integration,
not invention.** Bonus: the model returns all 4 stems anyway → full solo/mute of every instrument
for free; ship bass-mute as the headline, keep the rest as a member perk.

### Honest tradeoffs
- **Not real-time:** a 4-min song = **3–5 min** to separate even with WebGPU. UX is
  **"prep once (progress bar) → cache → then practice instantly."** (Same as Moises's web flow.)
- **~80 MB model download** on first use (one-time, cached) → "preparing your studio…" moment.
- **WebGPU vs WASM:** tolerable on modern desktop w/ WebGPU; slow on old machines w/ WASM fallback.
- **Mobile is the weak spot** — heavy in-browser ML on phones is rough. If mobile matters, a
  server-side Demucs fallback may eventually be worth it — but **don't build it until in-browser
  desktop proves demand**, and note it FLIPS the privacy story (see below).

### Speeding up / slowing down the separated upload — REUSE, not new work
**Q: can we time-stretch the bass-muted backing of an uploaded, separated song (in tune), the way
we already stretch drums + harmony separately for groove cards? → YES, and it's the EASIEST yes.**

- **After htdemucs, the stems are just AudioBuffers — same shape as groove-card stems.** The
  existing per-stem stretch engine (signalsmith worklet + the drum WSOLA/transient handling)
  doesn't care where the buffer came from. So the bass-muted backing (drums+other+vocals) is just
  more stems feeding the engine already shipped. **Integration, not invention.**
- **It's BETTER on separated stems than on a raw mix.** Stretching a full mix forces one algorithm
  to handle transients (drums, hate stretch) and tonal material (harmony, love stretch) at once →
  it compromises (smear). Separation lets each stem get the RIGHT treatment — WSOLA/transient on
  drums, signalsmith tonal stretch on other/vocals — exactly the per-stem approach behind the drum-
  tempo architecture. This is where we beat market slow-downers that stretch the mix.
- **Muting bass makes the stretch target the FRIENDLIEST possible:** fewer stems, and bass (the
  most pitch-/artifact-sensitive low-freq content — the stem the drum-sync-contract warns must NOT
  use playbackRate) is REMOVED (the user plays it). The remaining backing is more forgiving.
- Drums MUST NOT use playbackRate (pitch-shifts out of tune) — same rule as the drum-sync contract.
- **The one real caveat = SYNC between independently-stretched stems** — the exact problem already
  solved (shared-grid / re-anchor / latency-comp; see drum-sync-contract + stretch-latency memories).
  NOT solved from scratch — REUSED. **Load-bearing UNKNOWN (a TEST, not a design question): do
  real-world uploads (human-timed, VARIABLE TEMPO, not clean loops, recorded to a drummer not a
  click) hold sync through the engine the way authored groove stems do?** That's the thing to test;
  authored content never exercised it.
- Composes with structure work: **identify loopable section (local) → loop it → stretch the loop
  in tune, bass-muted.** "Loop the chorus at 70% and play bass over it, in tune" = the headline moment.

---

## Cold-start: how the FIRST users get their analysis

**On-device computation is the source of truth and works standalone. The crowd-sourced DB is pure
acceleration that, at launch, has nothing to accelerate.** User #1 never waits on the DB — the DB
is empty; user #1 FILLS it. If the DB never existed, the product still works — everyone just always
computes locally. The DB only ever makes things FASTER, never POSSIBLE.

```
User picks file → decodeAudioData (instant)
  ↓  [progress: "Preparing your studio…"]
1. htdemucs separation         → {bass, drums, other, vocals}   (~3-5 min — the slow step)
2. beat-grid / tempo detection → bars & downbeats               (seconds, on the buffer)
3. section / loop finding      → loopable region candidates     (seconds, on the buffer)
  ↓  → player gets: bass-muted backing + structure + loops
4. (later/optional) AcoustID fingerprint locally → donate {fingerprint, structure FACTS} to DB
```

### Honesty check — separation CANNOT be crowd-shortcut
Because we (correctly) store only FACTS, never audio/stems, the DB can skip the FAST steps, not
the slow one:

| Step | DB skips it for the next user? |
|---|---|
| Separation (~3-5 min) | **❌ No** — DB has no audio; every user separates their own copy locally, always |
| Beat-grid / tempo | ✅ yes — metadata by fingerprint |
| Sections / loops | ✅ yes — metadata + human-verified corrections |

So the moat is **"skip the analysis + get better-than-algorithm structure," NOT "skip the 3-min
wait."** Never let anyone (incl. future-me) pitch the DB as eliminating separation time — by design
it can't. (Correction to a stray "1-2 min" assumption: the slow step is ~3-5 min, not 1-2.)

### First-run UX decision — quick-rough-then-refine, CONTINGENT, with a fallback
**Target = progressive separation:** a fast/rough pass (~30s — lighter model OR fewer
overlap/shift passes) gives bass-mute + loops immediately while full htdemucs runs in the
background; **hot-swap stems to the clean version at a loop boundary** so it's seamless.

**CONTINGENT on a TEST (ear is ground truth — build it, then listen):** is a ~30s rough pass
*practiceable* (not just playable)? The **mute** use-case makes this likely — the user's own bass
masks the rough pass's bass-bleed. "Rough" comes from a lighter model (2 downloads, more complexity)
OR fewer passes of htdemucs (1 model, but unclear the in-browser ports expose that knob) — both
need validation.
**FALLBACK if the rough pass is too smeared even for mute-practice:** "background-separate while
they explore" — start the user on the ORIGINAL mix (manual loop + metronome) immediately, unlock
bass-mute when the single good pass finishes. Build so this fallback is cheap; which wins is empirical.

### DB-timing decision — SCALE FIRST, then DB (later + opt-in), NOT at launch
**Recommendation: ship pure on-device, NO fingerprint, "100% on-device — nothing leaves your
device, ever" as the launch claim.** Add the crowd-sourced DB later, opt-in, once collisions
actually happen.

Rationale — the DB only helps when **two users upload the SAME recording**, and at low scale with a
musically-diverse user base the **collision rate is tiny** (early users upload long-tail tracks —
a worship tune, a jazz standard, their teacher's backing). So at launch the DB would collect
fingerprints that never match → pure overhead + a privacy line-item (fingerprint leaving device) for
**~zero benefit**. And **you lose nothing by waiting** — the on-device path produces everything
regardless; the DB is acceleration with nothing to accelerate yet; the "missed" early data is the
least-likely-to-ever-collide data anyway.

| | Build DB at launch | Add DB later |
|---|---|---|
| Benefit first months | ~zero (no collisions) | none lost (there was none) |
| Cost | fingerprint leaves device + plumbing + consent UX | $0 until needed |
| Launch privacy story | "mostly on-device, except a fingerprint" | **"100% on-device, nothing leaves, ever"** |

**Instrument it:** log local-only "would this fingerprint have matched?" counts to KNOW when
collision rate justifies turning the DB on. **Flips only if** you seed the beta around a fixed
curriculum (everyone practices the same ~20 tracks) → high collisions day one → donate-from-launch
makes sense. For a general "upload whatever you're learning" product, scale-first-then-DB.

### What the user does DURING separation (~3-5 min) — turn the wait into the setup
**Principle: don't make them wait, make them WORK.** Separation runs in a Web Worker / WebGPU off
the main thread → the UI stays fully interactive. Front-load everything that DOESN'T need the
separated stems (it runs on the ORIGINAL mix + the fast local analysis that finishes in seconds).

**DECISION (2026-06-19): "roughly mark where you want to loop" via TAP-WHILE-IT-PLAYS** (the
chosen interaction — most musical, ear-first; user picked it over waveform-drag):
```
file decoded → original mix PLAYS + beat-grid detects (seconds)   [separation churning in bg]
  → user listens, taps [Mark Start] / [Mark End] at the bits they want
     → getCurrentTime() per tap → rough regions (0:42-0:51, 1:30-1:44, …)
  → separation lands → rough taps SNAP to nearest downbeat (beat-grid) → clean loops on the
     bass-muted backing, in tune. The wait PRODUCED their practice setup.
```
- **Why it's sharp:** harvests the one input the machine can't produce — the user's EAR judgment of
  "the bit I want" — in parallel with the machine doing the thing only it can (separation). Tap =
  intent (rough, ±100-200ms — humans can't tap frame-accurate, shouldn't have to); beat-grid = the
  precision (snap to bars). Same human-marks-rough + machine-snaps pattern as the structure section.
- **Design notes:** taps MUST be editable after snapping (show regions on the waveform, nudge/delete
  — never treat live taps as final); same "snap off" toggle for when beat-grid mis-detects
  (rubato / sparse intro). Reuses GrooveCardWaveform + the Set-A/B timestamp capture.
- **Dovetails with the fallback:** they're not staring at a spinner — they're LISTENING to the song
  they came to learn; marking is a byproduct. Separation finishing = an UPGRADE ("now without bass"),
  not the payoff they waited for. This IS the "practice-on-the-original-mix-now" filler → one build,
  serves as both the engagement filler AND the cold-start fallback.

**Other free fillers (Tier 1, need nothing from separation):** beat-grid + key detection (seconds →
pre-seed metronome + transpose), waveform render, section/loop suggestions on the mix.
**Engagement fillers (Tier 2, cheap):** a tuner (bassist's about to play), the day's Bass Gym
warm-up rep (routes idle time into the core membership product), "what do you want to work on?" intent setup.
**Be careful (Tier 3):** progress must be TRUTHFUL not a fake bar (musicians re-run + notice
non-determinism); NEVER "upload to speed it up" (that's the privacy wall — filler must not become
an excuse to send audio off-device).

---

## "Upload" is in quotes — nothing leaves the device (in-browser path)

The original file is read into the **tab's RAM**; the model runs **in the tab**; results cache in
**IndexedDB (the browser's local DB, on the user's disk)**. **No network touched.**

| Property | In-browser path |
|---|---|
| Original/separated files leave the device? | **No** |
| Do *we* ever possess the user's copyrighted song? | **No** |
| Storage / compute / bandwidth cost to us | **$0 / $0 / $0** |
| "User uploaded pirated audio" liability | **Minimal** (we never received it) |
| Works offline after model download? | **Yes** |
| Marketing claim | **"Your music never leaves your computer"** (literally true) |

**This privacy property is ONLY true for the in-browser path.** A server-side fallback transmits
the file to our backend and flips every "No" to "Yes" (storage + compute + bandwidth + "we possess
users' copyrighted audio"). If we keep the clean story, that's a deliberate design constraint:
**in-browser only**, or any cloud path is an explicit, separately-consented "process in the cloud
(faster)" opt-in.

---

## Finding sections / loops — ALSO 100% on-device

NON-NEGOTIABLE: the recording NEVER leaves the user's computer. Every analysis below runs in
the browser tab on the SAME already-decoded AudioBuffer — no network, no server. The
"audio-access wall" was ONLY about YouTube audio (unreachable by a website); it does NOT apply
to the user's own uploaded file, which the tab has full local access to. Doing all work
on-device is the deliberate goal: cheaper for us ($0), and "your music never leaves your device"
stays literally true.

Two distinct things:

- **Manual A/B loop (push A, push B):** 🟢 trivial / already-built. Capture playback time on each
  press (or drag on `GrooveCardWaveform`); loop the buffer through the existing engine — seamless
  and in-tune (we own the buffer, not a `seekTo()` jump on a sandboxed player). Ships with the studio.
- **Auto "find" (optional, local):**

| "Find" means | Difficulty | How (all in-tab) |
|---|---|---|
| Beat/bar grid → **snap A/B to downbeats** | 🟢🟡 moderate, real value | beat/downbeat tracking on the buffer. THE one to prioritize — makes every manual loop musically clean. Needs a "snap off" toggle (misfires on rubato/tempo-change/sparse intros). |
| Repeated-section candidates (riff recurs at 0:45/1:30/…) | 🟡 moderate | self-similarity matrix on chroma/MFCC → "loopable region" suggestions; good-not-perfect; present as candidates, user adopts. |
| Song structure (intro/verse/chorus) | 🟡🔴 hard | music structure segmentation; labels unreliable; suggestive only. Skip for now. |
| Bassline phrases specifically | 🔴 frontier | needs separated bass stem + transcription-ish; Tier-2. Skip. |

**Sweet spot:** human marks A/B roughly (reliable, zero ML risk, ear-first), machine SNAPS to the
beat grid (achievable, local). Fully-automatic "find me a loop" is a cherry-on-top, not load-bearing.
Section-finding is **suggestive, not authoritative** — never claim "this is the chorus."

---

## Song identification + where structure ACTUALLY comes from

Explored: "identify the uploaded song → fetch its structure by ID → apply timestamps → find
sections." The chain BREAKS at the middle link. Verdict on each part:

### Part 1 — Identify the song: ✅ possible, privacy-soft (NOT pure on-device)
- **Chromaprint runs client-side (WASM), fingerprints a 2-min song in <100ms.** The fingerprint
  is a **compact, IRREVERSIBLE hash — NOT the audio** (can't reconstruct the song from it).
- **AcoustID:** open/free, MusicBrainz-backed, ~90M fingerprints, returns song ID + confidence 0–1.
- So the recording stays on-device; **only a non-reversible fingerprint leaves.** Softer than
  uploading audio, but it IS a small derived blob going out → a different promise than the
  pure-local studio. Decide if acceptable. Weak on covers/live/remix/obscure → design for
  "couldn't identify → manual fallback."
- **Real value of song-ID = METADATA/UX, not analysis:** auto-label the library entry
  ("Artist – Title" not "track_03.mp3"), album art, maybe pre-seed metronome (thin/unreliable).
  NOT a source of structure.

### Part 2 — Fetch structure FROM the ID: ❌ DOES NOT WORK (the load-bearing failure)
- **Spotify Audio Analysis API (the one service giving sections/bars/beats by song ID) was
  DEPRECATED Nov 2024. Gone. No replacement.**
- No major API offers structure-by-ID lookup. MusicBrainz = metadata only, no structure.
  Audjust/Cyanite ANALYZE audio you give them (no pre-computed structure-by-ID DB) → save nothing
  + require sending audio.
- Even if it existed: **structure timestamps are recording-specific.** A user's MP3 has a
  different master/trim/lead-in → external "chorus at 1:12" wouldn't align to THEIR file's timeline.
  Structure MUST be derived from THEIR actual audio to be frame-accurate.

### Part 3 — Find sections: ✅ but LOCALLY from their audio, not from an ID
You don't need the song's identity to get its structure — derive it directly from the uploaded
buffer, in-tab (self-similarity / segmentation). **More private AND more accurate** than
identify-then-lookup (works on their exact recording, no catalog dependency, nothing transmitted).
Song-ID is a bonus LABEL, not the source of structure.

### "Aren't there free song-structure databases in 2026?" — Yes, but they're TRAINING DATA, not a lookup catalog
| Dataset | Size | Has |
|---|---|---|
| SALAMI | 1,359 | hierarchical sections + functional labels (verse/chorus/…), expert |
| Harmonix Set | 912 | beats, downbeats, segments — pop/dance/rock/metal |
| RWC / AIST | 300 | flat structural segments |
| Isophonics | 174 | Beatles — sections + chords |
| POP909 | 909 | beats/downbeats (Chinese pop) |
| Verse-Bench | — | pre-consolidates Harmonix+SALAMI-pop+RWC-Pop+Isophonics |

**~3,000 unique songs total** — research-curated, recording-specific (aligned to files you don't
have), and often **ship annotations only, NOT audio** (copyright). The odds a random bass student's
upload is one of these specific 3,000 ≈ zero. **They are NOT a queryable "any song → structure"
catalog. No such catalog exists.**

BUT they're **gold as TRAINING/EVAL DATA** for a segmentation model — which is their actual purpose
and the better use:
```
~3,000 labeled songs (SALAMI/Harmonix/…) → train/fine-tune segmentation MODEL
  → ship the MODEL in-browser → detect sections on the user's OWN audio, locally, frame-accurate
```
Three layers, pick where to stop: (1) **off-the-shelf** segmenter in-browser, zero data work,
probably enough; (2) **fine-tune** on Harmonix/SALAMI if not; (3) **crowd-sourced corrections**
(below) for human-verified accuracy on popular songs.

### Building "our own structure DB": crowd-source it — DON'T scrape audio
**HARD LEGAL GUARDRAIL — for future-me / any AI agent:**
- ❌ **Scraping audio off the internet (YouTube/streaming/torrents) to analyze + build a structure
  DB = THE lawsuit.** Downloading the copyrighted recording IS the infringement (reproduction
  right), regardless of throwing the audio away after. Also ToS violation. AI-training fair-use
  cases DON'T cover mass-scraping a catalog to resell structural metadata. It also DESTROYS the
  "we never possess users' audio" defense by putting copyrighted audio on our servers. **Never do this.**
- ✅ **Crowd-source from the on-device analysis users already run on their OWN legal copies:**
```
user uploads their legal copy (on-device) → local analysis: beat grid, sections, loop candidates
  → compute AcoustID fingerprint locally (irreversible, NOT audio)
  → send ONLY {fingerprint, structure-metadata, optional user corrections} to our DB  ← NO audio ever
  → next user who uploads the SAME song → fingerprint match → inherits structure, skips 3-5min analysis
```
  Strictly superior: we never hold copyrighted audio; $0 to build (users' devices analyze);
  frame-accurate to real uploads; catalog grows with every user = **network-effect moat**.
  Store only FACTS (section boundaries, tempo, key) — NOT anything reconstructing the music (a
  transcribed bassline = derivative work; stay on the facts side). Even factual-metadata storage
  isn't zero risk → get an IP lawyer's blessing before scaling, but it's categorically safe vs scraping.
  **This = Wave 4 social feature, NOT a launch dependency.**

The reframe: you wanted to scrape because you assumed you'd have to manufacture structures yourself.
You don't — the product manufactures them as a byproduct of normal use, legally, on hardware you
don't pay for. The datasets make local DETECTION good; crowd-sourced corrections build the actual DB.

---

## The "library" — IndexedDB, not a user folder

Saving to the "platform library" = writing the separated stems into **IndexedDB** keyed by file
hash + name. It is **NOT** a folder the user can see/navigate in Finder — it's a managed sandbox
owned by your origin, physically on their disk. Return visit → read keys back → instant reload, no
re-separation. **But IndexedDB is a cache that can disappear:**

- Per-origin, **per-browser, per-device** — does NOT follow the user to another browser/phone/machine.
- Wiped by "clear browsing data" or storage-pressure eviction → **treat as a convenience cache,
  not durable storage.**
- Per-origin storage caps; stems are multi-MB each → show usage, let users delete old ones.
- Not user-visible files — can't back up / email / open elsewhere.

### How Moises does it (the benchmark) — and why NOT to copy it
Moises is **cloud-everything**: separates in the cloud (their GPUs), **stores stems in the cloud**,
**syncs the library across devices**. That's why they can do "open it on your phone, it's all there"
— and *also* why they **cap tracks/month**, **gate offline behind higher tiers**, **upload your
copyrighted song to their servers**, and **pay for storage + compute**. Their cross-device library
is a **consequence of cloud architecture**, not a free-standing feature. You can't have their
library convenience AND the privacy/$0 story for free — opposite ends of one axis.

### Recommended library design
**IndexedDB library + a "Download stems" button** (Moises exports MP3/M4A/WAV too):
- Local library covers the 90% "I return to the same machine" case (instant, $0, private).
- Download button gives durable **user-owned** backups for "don't lose my work" — without us ever
  storing/transmitting their audio.
- **Cross-device sync = a later, opt-in premium** only if users demand it, knowingly accepting cloud
  cost for that subset. (DECISION STILL OPEN — user asked "how does Moises do it" before deciding.)

---

## Difficulty map (for THIS stack specifically)

| Feature | Difficulty | Why |
|---|---|---|
| Upload + decode | 🟢 trivial | `decodeAudioData`, done for every stem |
| A/B section loop | 🟢 trivial | groove-card loop work, easy version |
| In-tune slow-down / tempo | 🟢 **already better than Moises** | signalsmith worklet runs now |
| Pitch-shift / transpose | 🟢 already built | PitchShiftAdapter + swap engine |
| Metronome + count-in | 🟢 done | standalone metronome track / MetronomeWidget |
| Waveform display | 🟢 done | GrooveCardWaveform (peaks + playhead + drag-select) |
| BPM detection | 🟡 moderate | now you HAVE audio; onset/tempo libs ~80–90%, tap-tempo fallback |
| Key/chord detection | 🟡 moderate | chromagram libs in-browser; "suggest + correct" UX |
| **Stem separation (mute bass)** | 🟡 **integration, model pre-built** | htdemucs in-browser, MIT; the one real lift |
| Beat-grid → snap A/B to bars | 🟢🟡 moderate, real value | beat-tracking on the local buffer; "snap off" toggle |
| Section finding (local) | 🟡 moderate | self-similarity / segmentation on local buffer; suggestive |
| Song identification | 🟡 moderate | Chromaprint(WASM)+AcoustID; fingerprint leaves, NOT audio; for LABELS not structure |
| Structure-by-ID lookup | ⛔ N/A | no such API (Spotify Analysis killed Nov 2024); recording-specific anyway |
| Crowd-sourced structure DB | 🟡 later/moat | fingerprint-keyed FACTS from user analysis; never scrape audio; Wave 4 |
| Transcription → tab | 🔴 frontier | monophonic bass okay-ish; clean tab unsolved; Tier 2 |

**Most of what a bass practice app needs is GREEN — already owned.** The difficulty concentrates in
stem separation (now a downloadable MIT library) and transcription (skip for now). Structure comes
from LOCAL detection (datasets = training data, not a lookup catalog); structure-by-ID lookup does
not exist.

---

## Existing reusable infrastructure (recon, 2026-06-19)

- **YouTube IFrame sync:** `apps/frontend/src/domains/widgets/services/YouTubePlaybackSync.ts`
  — play/pause/seek/getCurrentTime, latency comp, drift correction.
- **A/B loop region:** `useGrooveCardPlayback.ts` `setLoopSelection()` (1-indexed bars, validates/clamps,
  next-bar boundary); `LoopGridStrip.tsx`; `region.ts`; `GrooveCardDynamicLoopDial.tsx`.
- **Metronome (standalone vs external clock):** `playback/modules/instruments/.../metronome/Metronome.ts`
  + `MetronomeInstrumentProcessor.ts` + `MetronomeCore.ts`; `widgets/hooks/useCountdown.ts`;
  `MetronomeWidget/` + `useMetronomeRegistration.ts`. Runs as an independent track vs `MusicalTruthAuthority`.
- **Tempo / BPM UI + authority:** `GrooveCardControls.tsx` (stepper), `MusicalTruthAuthority.ts`
  (`setBPM`, single source of truth), `useGrooveCardPlayback.ts` `setTempo` (clamping).
- **Timeline / waveform / scrubber:** `transport/core/Timeline.ts`, `GrooveCardWaveform.tsx`
  (canvas peaks + playhead + pointer-drag select + seek), `TransportController.ts`, `TransportClock.tsx`.

---

## Recommended build order (each wave ships value + de-risks the next)

1. **Wave 1 — Web app, YouTube embed:** Set-A/B loop + nudge, tap-tempo metronome + count-in,
   section bookmarks, coarse speed. Days. All reuse. Legally tamest. Validates demand.
2. **Wave 2 — Web app, owned/uploaded audio = "Moises but bass-first":** in-browser htdemucs
   bass-mute + the existing loop/slow-down/transpose/metronome on the backing track. Manual A/B +
   local beat-grid snap. IndexedDB library + Download-stems. **The highest-leverage feature of the
   whole exploration.** Optional: song-ID (Chromaprint+AcoustID) for library LABELS only.
3. **Wave 3 — Browser extension:** Wave-2 DSP on *any* YouTube video + fretboard overlay +
   distribution funnel. Biggest payoff, new surface, heaviest ToS exposure.
4. **Wave 4 — Frontier / moat (owned audio only):** local section-finding via segmentation model
   (trained on SALAMI/Harmonix/…), crowd-sourced fingerprint-keyed structure DB (FACTS only, never
   scrape audio), full stem control, transcription → tab. Skip until 1–3 prove demand.

**Sequencing within Wave 2:** prove the **separation step works on real songs / target devices
FIRST** (load-bearing unknown), then wire to the existing loop/stretch/metronome surface.

### All gated by the existing `subscriptions` membership entitlement (the same lever as the Gym).

---

## Open items before any build
- [ ] Verify current `demucs-web` / `demucs.app` repo specifics: API surface, exact model size,
      browser/WebGPU requirements, license fine print, real separation time on target devices.
- [ ] Decide library durability (IndexedDB-only vs +Download vs +opt-in cloud sync). User leaned
      toward understanding Moises first; recommendation = IndexedDB + Download, cloud sync later.
- [ ] Read current YouTube API ToS (ad/branding clauses) before the YouTube looper ships.
- [ ] Read Chrome Web Store + YouTube audio-tap policies before the extension.
- [ ] Decide whether song-ID is in scope at all — it's the ONLY thing that sends data off-device
      (a non-reversible fingerprint, not audio). If yes, it's for LABELS, not structure.
- [ ] (Wave 4) IP-lawyer review before scaling a fingerprint-keyed crowd-sourced structure DB.
      Store only FACTS (boundaries/tempo/key), never audio, never anything reconstructing the music.

### Decisions firmed up (2026-06-19)
- **First-run = quick-rough-then-refine, CONTINGENT** on a ~30s rough pass being *practiceable*
  (test it; mute use-case makes it likely). FALLBACK = background-separate-while-they-explore
  (start on original mix, unlock bass-mute when the good pass finishes). Build the fallback cheap.
- **Crowd-sourced DB = SCALE FIRST, then DB (later + opt-in), NOT at launch.** Launch = pure
  on-device, "100% on-device, nothing leaves, ever." Instrument local "would-have-matched" counts
  to know when collision rate justifies it. Flips only if beta is seeded on a fixed ~20-track curriculum.
- **Separation (~3-5 min/song) can NEVER be crowd-shortcut** (DB holds facts, not audio). Moat =
  skip-analysis + better-structure, NOT skip-the-wait. (Slow step is ~3-5 min, not "1-2 min".)
- TEST (not design): cache stems in IndexedDB so re-opening a song is instant (skip re-separation).

---

## Capturing the user's OWN bass recording (the INGEST question — separate from playback)

**Date added:** 2026-06-20.
**Question:** "What can a browser extension do regarding taking user bass recordings into our app?"
Then: "Difference between a desktop daemon that captures a no-latency bass signal vs a browser
extension — can they work together?" Then the deciding constraint:
**"Users need to hear the underlying backing track from the platform AND their own bass signal at
the same time, in sync."**

This is a DIFFERENT problem from everything above. The rest of this doc is about *playback* of
audio the app already has (stems, uploads). This section is about *capturing* the user's live bass
*into* the app — an INPUT path, not an output one.

### Headline conclusion
- **A browser extension is the WRONG tool for capturing a bass recording.** Recording mic/interface
  input is `getUserMedia` — a plain web-page API. An extension uses the EXACT same call and adds
  nothing for capture; its only unique capture power is tapping ANOTHER tab's audio (`tabCapture`,
  e.g. a YouTube backing) — which is the Wave-3 YouTube-DSP job, not bass capture.
- **A browser extension does NOT reduce latency.** Page and extension share the same Web Audio path
  and the same 20–150 ms round-trip. Only a **native desktop daemon** (ASIO / CoreAudio, exclusive
  driver mode, 32–64-sample buffers) reaches the **3–10 ms** that "no-latency" requires. The browser
  sandbox cannot reach exclusive driver mode — a deliberate security boundary, not a missing feature.

### The two latencies — separate them or the analysis goes wrong
| | What it is | Solvable in the browser? |
|---|---|---|
| **Monitoring latency** | The delay the user HEARS while playing (their bass coming back late) | **No** — this is the molasses-feel, word-of-mouth killer. Only a daemon (or hardware) fixes it. |
| **Recording offset** | The captured take lands a few ms late in the timeline | **Yes** — a correctable number (punch-in compensation). The user never feels it. |

The backing track from the platform has **no input latency** (it's already an `AudioBuffer` we
schedule). Only the bass round-trips. So the hard half of "hear both in sync" is *only* the bass
monitoring half.

### The fork that decides whether a daemon is needed: HOW does the user monitor?
- **Hardware direct monitoring (how every studio overdubs):** the audio interface mixes the analog
  bass with the platform's backing track **in hardware**, in the user's headphones. Bass is heard at
  **0 ms (analog)** — it never round-trips through software to reach the ears. The app's only job for
  the bass is to RECORD it (offset corrected in software, invisible). **This satisfies "hear backing
  + bass, in sync" with a BROWSER-ONLY solution and NO daemon.** The catch is a SETUP-UX problem
  (route platform output to the interface, enable direct monitoring), not a software-latency problem.
- **Monitoring through the app** (hear the bass WITH the app's click/effects, no hardware monitoring):
  the bass MUST round-trip through software → browser latency = molasses → **requires the native
  daemon.** This is the ONLY case the daemon is truly mandatory.

### Two user classes, two right answers (given the validated "mix of both" user base)
| User | Proper solution | Latency they FEEL | Daemon? |
|---|---|---|---|
| Has an audio interface | **Hardware direct monitoring** + good setup wizard; browser records only | **0 ms (analog)** | **No** |
| Laptop mic, no interface | Native daemon for low-latency software mixing — OR don't promise live monitoring at launch (record-then-review) | 3–10 ms w/ daemon | Yes, for live monitoring |

**Uncomfortable truth:** the laptop-mic user is BOTH the one who needs the daemon AND the one for
whom the result is weakest anyway (bad mic, room noise, backing-track bleed into the mic). Pouring a
multi-OS native-daemon effort into the lowest-quality segment is worth questioning. The interface
user — who needs NO daemon — is the one who'll actually get a recommend-worthy experience.

### Can daemon + extension + web app work together? YES — it's the standard pro-audio architecture
Three NON-overlapping jobs (each does something the others can't):

| Component | Unique job nothing else can do |
|---|---|
| **Desktop daemon** | Low-latency NATIVE capture of the **bass** (ASIO/CoreAudio, 3–10 ms) |
| **Browser extension** | Capture **another tab's** audio (`tabCapture` — e.g. a YouTube backing) |
| **Web app** | All UI, the playback/stretch engine, gym, library, auth |

The daemon and the extension solve COMPLETELY different capture problems (your bass low-latency vs
someone else's tab audio). You'd only build both for "low-latency bass over a YouTube backing track."

**Handoff: the web app talks to the daemon directly over a `localhost` WebSocket — you often need NO
extension for the daemon path.** Daemon runs a tiny WS/HTTP server on `127.0.0.1`; the page connects
and receives the recorded take / streamed frames → into the existing engine. (Mixed-content caveat:
serving to an HTTPS page from localhost needs a loopback cert or a `localhost` exception.) Native
messaging (extension ↔ daemon) is only relevant if the EXTENSION is the hub — more moving parts.

```
Desktop daemon (native, low-latency)
  • ASIO/CoreAudio → bass at 3–10 ms
  • localhost server: ws://127.0.0.1:PORT
        │  recorded take / frames
        ▼
Web app (app.bassicology.com)
  • connects to ws://127.0.0.1:PORT
  • bass AudioBuffer → existing loop/stretch engine, UI, gym, library
```

### What the daemon costs (why it is NOT the launch default)
Per-OS native builds (Win/Mac/Linux), code-signing + Apple notarization, installers, auto-update
infra, a "background process listening to your audio" trust hurdle, ongoing OS-audio-stack
maintenance — it's a **whole product, not a feature** — and it is **DEAD on mobile** (no daemons on
iOS/Android; PWA/web only there).

### RECOMMENDATION (capture path)
1. **Launch = web-app `getUserMedia` recorder + hardware-direct-monitoring + a genuinely good setup
   wizard** (detect interface; walk through routing + direct monitoring; verify with "play a note —
   do you hear it instantly?"). For interface users this is **0 ms, proper, recommend-worthy, and
   browser-only.** Bass take → `AudioBuffer` → straight into the existing loop/stretch/transport
   engine (REUSE — same shape as groove stems & htdemucs output).
   ⚠️ Must disable the browser's default `getUserMedia` constraints — `echoCancellation:false,
   autoGainControl:false, noiseSuppression:false` — or they DESTROY a bass signal.
2. **Laptop-mic users at launch: don't promise live through-app monitoring** — offer "play to the
   backing in your room, we record, review aligned after." Honest, no molasses, no daemon.
3. **Daemon = later Pro-tier upgrade** unlocking true through-app low-latency monitoring (interface
   users who want app effects + serious laptop users). Composes over `localhost` WebSocket. Ship when
   a real user pushes for it — NOT at launch.

### LOAD-BEARING UNKNOWN (a TEST, not a design debate)
On a real interface, measure: (a) the actual `getUserMedia` round-trip offset on this machine, (b)
whether punch-in alignment lands the recorded take sample-accurate against the backing, (c) that
hardware direct monitoring makes the FEEL zero-latency. **If that proves out, the launch capture
solution needs no daemon.** Build the test before committing to ANY native work.

### ✅ TEST RESULT (2026-06-20) — measured on a real rig, verdict CONFIRMED
Built an in-app probe (`BassRecorderPanel` + `useBassRecorder`, dev-flagged behind
`NEXT_PUBLIC_BASS_RECORDER_PROBE`) wired to the REAL groove engine — played Test Groove 2 with the
bass stem MUTED (existing `setStemMuted('audio-bass', true)`), recorded a live bass performance via
`getUserMedia` on the engine's own AudioContext, snapped note onsets to the groove's beat grid
(`loopStartAudioTime` + `loopDurationSeconds`), and split the timing error into constant-offset vs
jitter. Rig = **Focusrite Clarett** (DI bass in, headphone monitoring).

- **Capture works:** clean input received at ~−18 dBFS (healthy instrument level), AGC/NS/EC forced off.
- **Recording latency (the load-bearing number):** measured **+11.1 ms then −4.7 ms** across two
  takes → i.e. **~±5–11 ms, near-zero and punch-in-correctable.** Below most players' perception
  even UNcorrected. **This is the verdict: browser-only capture works; NO daemon needed.**
- **Monitoring:** 0 ms analog via Focusrite Control direct monitoring (hardware), as predicted — the
  app's job is only to RECORD, not to play the bass back to the ears.
- Jitter readings (160 ms → 70 ms) were dominated by the probe's onset detector over-triggering on
  bass sustain (note count 92 → 75, too high for a ~14 s line), NOT by the player or the system.
  Irrelevant to the decision — jitter exists only to keep the offset reading clean, which it is.

**CONCLUSION (measured, not just reasoned): launch the capture feature BROWSER-ONLY + hardware
direct monitoring. The native daemon is unnecessary for the interface-user path.** Daemon stays a
later Pro-tier option only for monitor-THROUGH-app (laptop-mic users / app-effects monitoring).

### Two real prerequisites surfaced by the test (needed whenever capture ships)
- **`Permissions-Policy: microphone=(self)`** in [next.config.js](apps/frontend/next.config.js) — prod
  currently sends `microphone=()` (mic denied to EVERY document, even same-origin), which blocks
  `getUserMedia` entirely. `=(self)` allows our own origin only (third-party iframes still blocked).
- The probe lives at `apps/frontend/.../groove-card/{useBassRecorder.ts,BassRecorderPanel.tsx}` +
  the standalone `docs/dev-tools/recording-latency/` page. Onset detector is rough (sustain
  over-triggers) — fine as a latency probe, would need hardening (HPF + min-note-spacing) to report
  honest jitter, but that's a diagnostic, not on the ship path.

---

## Sources
- Market: Transpose (transpose.video), YouTube Looper & Pitch Changer, KeyPitch, Transposer,
  Transcribe! (seventhstring), Music Slow Downer, Transcribe+, Moises (moises.ai), Guitar Pro.
- In-browser separation: github.com/timcsy/demucs-web, demucs.app, htdemucs vs BS-RoFormer vs
  Spleeter 2026 benchmark, Spleeter vs Demucs (StemSplit). htdemucs ~80MB, MIT, ~9.0 dB SDR.
- Moises storage/sync: cloud separation + cloud library + cross-device sync; stem export
  MP3/M4A/WAV; offline playback of already-processed tracks gated to higher tiers.
- Song-ID: Chromaprint (acoustid.org/chromaprint, WASM, <100ms/2min, irreversible hash), AcoustID
  (~90M fingerprints, free/MusicBrainz). Structure-by-ID: Spotify Audio Analysis API DEPRECATED
  Nov 2024, no replacement; MusicBrainz = metadata only.
- Structure datasets (TRAINING data, ~3,000 songs total, NOT a lookup catalog): SALAMI (1,359),
  Harmonix Set (912), RWC/AIST (300), Isophonics (174 Beatles), POP909 (909), Verse-Bench
  (consolidates Harmonix+SALAMI-pop+RWC-Pop+Isophonics). Often annotations-only, no audio.
