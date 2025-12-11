# [PLAYBACK PHASE 2-03] Consolidate Tone.js Getters Into Single Module

**Parent Epic:** [Playback Domain Production Readiness](../playback-domain-production-readiness.md)

---

## Story Objective

Unify all Tone.js getter/util initializers into a single, canonical module to prevent fragmentation, reduce duplication, and centralize initialization patterns.

## Background/Context

- Tone.js-related code exists in multiple files (tone.ts, toneInitializer.ts, toneLoader.ts, ToneProvider.tsx), each managing/returning Tone.js instances slightly differently (assessment, Phase 2-3).

## Requirements

- Inventory all Tone.js "getter" utilities in playback domain.
- Create new canonical module for Tone instance management.
- Refactor all current uses to reference new canonical module.
- Add/update tests covering initialization and usage.
- Update docs to specify single point of Tone.js setup/access.

## Acceptance Criteria

- [ ] All Tone.js instantiations are consolidated into single getter/manager module.
- [ ] No duplicate or outdated Tone.js loaders remain.
- [ ] All code referencing Tone.js goes via canonical utility.
- [ ] Tests cover canonical path.
- [ ] Docs reflect new pattern.
