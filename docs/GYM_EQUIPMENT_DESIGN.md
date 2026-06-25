# Gym Equipment — Design (the practice floor that LISTENS)

> Status: **DESIGN / scoping** — written 2026-06-24. No code yet. This is the spec the
> build follows. The floor's *shape* exists today as static mock
> (`GymFloor.tsx`); the equipment *tools* behind each station do not.

---

## 1. The one-paragraph vision

The Bass Gym floor is a grid of **equipment stations** — one per skill a bassist works on
(Connecting Chords, Scales, Rhythm, Groove, Timing, Listening, Arpeggios, Song Structure).
Each station is a **doorway into an open-ended practice tool**: a groove-card-style player
(tempo / key / loop / stems) with a **skill-specific panel** on top. You load what you want,
set your tempo and key, and work — it's a practice *instrument*, not a closed, pass/fail
exercise.

**The differentiator — the platform has EARS.** Every time you hit play, the bass-coach
engine (the timing-mirror capture + scoring stack we built) **listens** to your playing,
scores it, and **stores the take**. The product isn't "track your numbers" — it's
**"here's how you sounded a month ago versus now."** You can play back your past self. No
other platform does this. The equipment floor is the surface that turns the bass-coach
engine into the headline feature.

---

## 2. Two layers on the gym floor (don't conflate them)

| Layer | What it is | Scored? | Engine |
|---|---|---|---|
| **The Rep** (overlay) | The daily, coached "Six minutes." session. Planned per-day, enrollment-driven. | YES — coached + scored via the training engine | `training-engine` (`generateRep`, `useGymSession`) — BUILT |
| **The Equipment** (floor) | Open practice tools, one per skill. Self-directed. | OPEN practice + listening: no pass/fail GATE, but the platform LISTENS, scores each take, and tracks progress over time | bass-coach / timing-mirror capture+scoring stack |

The rep is the recurring-membership core (built). The equipment is the self-directed floor
underneath it (this doc). They share the gym page; the rep sits as an overlay, dismissing it
reveals the floor.

---

## 3. What an "equipment tool" IS (architecture)

**Shared core + custom panel per skill** (decided 2026-06-24).

```
EquipmentTool (per station)
├── SHARED CORE (reused, not rebuilt)
│   ├── groove-card playback        (useGrooveCardPlayback / GrooveCardShell + Controls)
│   │     → tempo, key, loop region, per-stem mute, the transport
│   ├── load-your-own-content        (the tool is OPEN: user picks/loads what to practice)
│   └── the LISTENING engine         (bass-coach: captureBassInput → measureAtMarkers →
│         scoring → STORE the take)  ← the "ears". Fires on every play.
│
└── CUSTOM PANEL (per skill — genuinely different UI)
      e.g. Listening = ear-training UI; Timing = placement meter; Chords = voice-leading view
```

- **Open, not closed.** No fixed answer key required to use a tool. You load content, set
  tempo/key, and play. (A skill MAY offer suggested content, but the tool never forces it.)
- **The ears are always on.** Hitting play = a recorded, scored take, stored against your
  history for this station. This is the longitudinal "month ago vs now" data.
- **The custom panel is the skill's personality** — what you see/do differs per station,
  but the playback core + listening engine are shared.

---

## 4. The 8 stations

Names/icons/colors are already in `GymFloor.tsx` (the mock). For each, we must spec:
**custom-panel scope**, **what "listening" measures here**, and **default/loadable content**.
The musical/pedagogical design of each is the USER's call — table below is the frame to fill.

| # | Station | Skill | Custom panel (what's different) | What the ears measure here | Content |
|---|---|---|---|---|---|
| 1 | **Connecting Chords** | Voice-leading between changes | _TBD_ (voice-leading / target-tone view?) | _TBD_ | _TBD_ |
| 2 | **Scales** | Fluency in every position | _TBD_ (scale-pattern / position map?) | _TBD_ | _TBD_ |
| 3 | **Rhythm** | Lock to the click; pattern vocabulary | _TBD_ | _TBD_ | _TBD_ |
| 4 | **Groove** | Sit in the pocket at real tempo | _TBD_ (closest to a plain groove-card?) | timing feel (jitter/offset — built) | real grooves |
| 5 | **Timing** | Placement: ahead/behind/center on command | _TBD_ (placement meter) | onset offset vs grid (built) | _TBD_ |
| 6 | **Listening** | Ear training — name by sound | _TBD_ (ear-training UI; may NOT use the bass mic?) | _TBD_ (answer correctness, not audio?) | _TBD_ |
| 7 | **Arpeggios** | Outline harmony cleanly | _TBD_ | _TBD_ | _TBD_ |
| 8 | **Song Structure** | Map sections; know where bass goes | _TBD_ (locked behind College in the mock) | _TBD_ | _TBD_ |

> NOTE: not every station may use the bass-listening engine the same way. **Listening**
> (ear training) might be answer-based, not audio-scored. Flag per station; don't force the
> mic where it doesn't fit.

---

## 5. Dependencies & sequencing (the honest blockers)

1. **The bass-coach / listening engine must be available.** It's the whole point of the floor.
   Today it lives **dev-flagged on the unmerged `feature/timing-mirror-spike` branch**
   (`NEXT_PUBLIC_BASS_RECORDER_PROBE`), validated on a handful of takes, NOT calibrated on a
   real bass across the new dimensions (see `BASS_COACH_ENGINE_SOA_AND_ROADMAP.md` §4c).
   **The equipment floor cannot ship before that engine is merged + at least timing-validated.**
2. **Longitudinal storage is net-new.** The bass-coach panel today **persists nothing**
   (confirmed in the SoA doc). "How you sounded a month ago" requires storing each take's
   score (and maybe audio) per user per station — a new data model + storage decision
   (DB rows for scores; audio in a bucket vs on-device IndexedDB — the practice-tools
   feasibility memo already explored on-device capture).
3. **The shared tool shell is net-new.** Extracting the groove-card player + the listening
   engine into a reusable EquipmentTool shell (so 8 panels can ride it) is the core build.
4. **The floor is mock today.** `GymFloor.tsx` STATIONS + progress are static; wiring them to
   real per-station routes/state is part of this.

**Build order (proposed, not yet committed):**
- Step A: merge + timing-validate the bass-coach engine (separate track; its own §4c agenda).
- Step B: define the take-history data model (scores stored per user/station/date).
- Step C: build the shared EquipmentTool shell (groove-card core + always-on listening + history).
- Step D: build ONE station end-to-end (likely **Groove** — closest to a plain groove-card +
  the already-built timing feel score) as the proven template.
- Step E: build the remaining 7 custom panels, riding the shell.
- Step F: wire `GymFloor.tsx` to real stations + the "month ago vs now" progress view.

---

## 6. Open questions (resolve before/while building)

- **Audio storage**: store every take's AUDIO (for literal playback of "a month ago"), or only
  the SCORES (cheaper, but you can't *hear* your past self)? The "hear your past self" pitch
  implies storing audio — where (private bucket vs on-device IndexedDB)? Cost + privacy call.
- **Per-station listening fit**: which of the 8 actually use the bass mic+scoring, and which are
  answer-based (Listening/ear-training)? (Section 4 flags this.)
- **Does the Rep reuse the equipment tools?** A coached rep on the "Groove" skill could render
  the same tool with an answer key + scoring gate. Worth designing the shell so the rep can
  reuse it (one tool, two modes: open vs coached).
- **Membership gate**: the gym is the $24/mo product. The floor is members-only like the rep?
- **Song Structure** is `lockedBy: 'College'` in the mock — is it an equipment tool at all, or a
  doorway back into College content?

---

## 7. Why this matters (the strategic line)

The bass-coach engine was the hard, risky build of this whole arc. The equipment floor is
**what it was FOR**. "Open practice tools that listen and show you your progress over months"
is a claim no competitor can make, and it's the difference between the gym being "a rep timer"
and "the first practice room that actually hears you." Build the floor and the engine stops
being a dev-flagged spike and becomes the headline.

### Related docs
- `BASS_COACH_ENGINE_SOA_AND_ROADMAP.md` — the listening engine (§4c = its validation agenda)
- `PRACTICE_TOOLS_FEASIBILITY.md` — on-device capture + storage exploration
- `PERFORMANCE_ANALYSIS_FEASIBILITY.md`, `HONEST_MIRROR_BUILD_OPTIONS.md` — the "platform has ears" origin
- `GymFloor.tsx` — the floor's current (mock) shape: the 8 stations
