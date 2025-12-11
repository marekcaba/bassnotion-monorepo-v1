# Story 5.1: Professional Bass Guitar Instrument System – End-to-End Workflow

## Status: DRAFT 🚧

**Start Date:** 2025-11-16
**Epic Lead:** Marek Caba
**Estimated Effort:** TBD (multi-phase, full-system implementation)
**Target Completion:** TBD

---

## Story

- As an **Admin, Educator, or Power User**
- I want **an advanced, highly realistic Bass Guitar Instrument supporting true articulation, round-robin sampling, and authentic playback**
- so that **learners and creators experience actual instrument nuance previously impossible in virtualized bass, with pro-level articulation accuracy, timbral realism, and intuitive admin control.**

---

## Context / Problem Statement

- The current bass instrument implementation provides basic sample-based playback without true string-aware sampling, professional-grade articulation transitions, or admin-controlled articulation mapping. This limits musical expressiveness, reduces authenticity of exercises for advanced learners, and decouples sample realism from actual fretboard workflows.
- User feedback and music teacher pilots highlighted a critical need for:
  - Fully string-aware sample organization (E/A/D/G)
  - Realistic pre-recorded articulations (hammer-on, pull-off, slides)
  - Admin-controlled note-by-note articulation (`matrix`) step during MIDI upload
  - True multi-velocity, technique, and round-robin selection
  - Seamless fretboard/notation workflow integration
- Benchmark: Target parity or superior usability over commercial libraries (Native Instruments, AmpleSound, etc.) for bass.

---

## Solution / Scope

### Full Architecture Overview

- ⚡ Replace generic sampling logic with dedicated BassVelocitySampler, ArticulationEngine, and TechniqueManager components per architecture doc.
- ⚡ Insert new 'Articulation Matrix' phase in the admin MIDI workflow.
- ⚡ Implement true round-robin & crossfade scheduling (Player arrays, NOT Tone.Sampler).
- ⚡ Support admin auto-suggestions for articulations with human override.
- ⚡ Integrate all features into existing region scheduling (RegionProcessor), preventing double-scheduling, supporting full articulation playback, and proper context propagation.
- ⚡ Provide full test strategy, memory/cpu management, and rapid fallback handling for sample gaps.

#### Key Features/Flows

1. **Admin Workflow:**
   - Upload MIDI → Parse → (NEW) Articulation Matrix UI → Set Anchors → Convert → Save
   - Admin selects technique/articulations per note with auto-suggestion assist, can preview, save, or revert.
2. **Backend & Data:**
   - Zod-typed schemas extended for note techniques + articulation metadata (fromNote, toNote, etc.).
   - Store all info in database for each exercise.
3. **Playback System:**
   - BassVelocitySampler manages technique, round-robin selection, and sample pool
   - ArticulationEngine triggers pre-recorded transitions, schedules at source note's time, handles crossfades, and prevents double-playback.
   - TechniqueManager manages ~1,100+ samples using Player arrays, NOT Sampler.
   - NoiseEngine triggers contextually (ghost, slap, pop, fret, etc.), velocity-aware.
4. **Sample Organization:**
   - String/{technique}/{velocity}/{note}\_RRx and articulations/articulationType/{from}-{to}.mp3
   - Support for full and initial libraries with graceful fallback (pitch-shift or normal triggers)
5. **Integration:**
   - All backend/frontend flows mapped to existing exercise and playback system
   - Special logic for crossfade, tempo-awareness, and memory management
6. **Testing/Validation:**
   - Full suite of unit/integration tests per phase (timing, crossfade, fallback logic, rapid-slide detection, etc.)

---

## Acceptance Criteria (ACs)

1. The admin MIDI upload workflow includes a step for full note-by-note articulation matrix editing (UI matches architecture doc, supports technique/articulations, auto-suggest, preview, and save).
2. Articulation choices are persisted in the exercise database and extend the GeneratedBassNote schema with all required metadata per architecture doc.
3. The backend uses BassMapperService to merge MIDI parse, articulation matrix, and anchors, generating fully enriched notes played by the new playback engine.
4. The BassVelocitySampler and TechniqueManager classes select samples using round-robin arrays (not single-sample Sampler), handle velocity, string, and technique selection, and support string-aware RR selection.
5. ArticulationEngine triggers pre-recorded articulation samples at the source note timing (not target), follows crossfade/blend protocol, and supports fallback for missing samples.
6. The RegionProcessor is updated to prevent double-scheduling (both source and target for articulations), always schedules full transitions at the correct time, and marks involved notes as scheduled.
7. All supported articulations (normal, hammer-on, pull-off, slide-up, slide-down, ghost note, accent, trill, bend) map to correct samples, transitions, and noises.
8. Backend, frontend, and playback system handle missing or partial libraries gracefully via human-friendly fallbacks and error logging.
9. Tests cover all edge cases: rapid articulation runs, instrument memory limits, crossfade cancellation errors, fallback pitch/interval shifting, etc.
10. Final user/QA review demonstrates: (a) Playable 'Come Together' exercise with at least 4 distinct articulations, (b) No double-triggered notes, (c) Realistic round-robin variation, (d) Acceptable browser performance at full load.

---

## Tasks / Subtasks

### Phase 1: Data & Schema

- [ ] Update Zod schemas for articulation (add 'toNote', validate all types)
- [ ] Extend GeneratedBassNote and ArticulationMatrixEntry for frontend/backend
- [ ] Unit test type mapping and backward compatibility

### Phase 2: BassTechniqueManager Implementation

- [ ] Use Tone.Player arrays for RR selection (per string/velocity/technique)
- [ ] Sample URL resolution system (sharps/strings/rr)
- [ ] Memory cleanup/disposal logic validated
- [ ] Unit tests for selection and Player disposal

### Phase 3: ArticulationEngine

- [ ] Implement sample lookup, load, & fallback for all articulation types
- [ ] Source-timing scheduling logic (not target note)
- [ ] Crossfade and tempo-aware blend for long durations
- [ ] Fallback: schedule notes separately if articulation sample missing
- [ ] Equal-power crossfade curves
- [ ] Full unit tests, including fallback edge cases

### Phase 4: Admin UI Articulation Matrix

- [ ] BassArticulationMatrix component per doc (table, per-note selectors, auto-suggest, preview)
- [ ] Wire articulation matrix into upload workflow (step 3)
- [ ] Validate correct save, preview, and error recovery
- [ ] Storybook test coverage

### Phase 5: RegionProcessor Update

- [ ] Implement context-aware scheduling logic (source note time, cross-action tracking)
- [ ] Add scheduledIndices Set, prevent double-scheduling
- [ ] Integrate with new note/articulation schemas
- [ ] Full sequence scheduling tests (normal, articulation, rapid slides)

### Phase 6: End-to-End QA & Fallback Handling

- [ ] Exercise: 'Come Together' with all articulation types
- [ ] QA for rapid-fire edge cases, real sample gaps, memory profile under load
- [ ] Implement 'graceful degradation' fallback report for missing samples
- [ ] Documentation + code comments for all critical timing/crossfade logic

---

## Dev Technical Guidance

- **Player Arrays NOT Tone.Sampler:** Use Player pools for RR across notes/techniques/velocities. Tone.Sampler doesn't support round-robin!
- **Source Note Timing:** Always trigger articulation samples at the source (fromNote) time. NEVER schedule at target.
- **Double-Scheduling Prevention:** ScheduledIndices is critical – ensure both source and target notes are tracked and marked.
- **Equal-Power Crossfades:** Use cosine/sine for blending; never linear (phase cancellation causes volume dip).
- **Missing Samples:** Always implement fallback – interval-based or normal note + log for library refinement.
- **Admin Workflow Priority:** UI must allow human override of any auto-suggestion.
- **Memory:** Dispose Tone.Player instances after playback! Monitor usage, especially with large sample libraries.
- **Testing:** Write sequence and crossfade tests for all ACs, especially edge cases (rapid runs, mixed articulations, fallback).
- **Documentation:** Inline all critical insights from architecture doc, pitfall list, and example code as comments for future maintainers.

---

## Story Progress Notes

### Agent Model Used: `<BMAD Agent v2025.11>`

### Completion Notes List

- Pending full resource planning and sample upload
- Expect iterative progress updates per implementation phase
- All ACs and tasks trace directly to architecture doc sections

### Change Log

- 2025-11-16: Initial draft created by BMAD Agent (auto-generated)
