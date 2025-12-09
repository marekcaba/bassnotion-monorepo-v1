# [PLAYBACK PHASE 3-03] Add Tests for Instrument Adapter Fallback

**Parent Epic:** [Playback Domain Production Readiness](../playback-domain-production-readiness.md)

---

## Story Objective
Automate tests demonstrating correctness and reliability of instrument adapter fallback logic in the event of adapter failures or unsupported features.

## Background/Context
- No explicit coverage for instrument adapter fallback logic (assessment, Phase 3-3).

## Requirements
- Identify all fallback/alternate-path code paths in instrument adapter modules.
- Create tests to simulate failures or unavailability of primary adapters.
- Assert that fallback is triggered and results in correct operational state.
- Add tests for all major supported instruments and fallback scenarios.
- Update documentation to list fallback logic and tested outcomes.

## Acceptance Criteria
- [ ] All fallback code paths are covered by tests.
- [ ] Simulated adapter failures trigger correct fallback logic.
- [ ] Operational state after fallback is correct and regressable.
- [ ] Docs updated to describe fallback, test cases, and gaps.

---

## Notes
- Related files: `src/domains/playback/instruments/`, `adapter/`, etc.

