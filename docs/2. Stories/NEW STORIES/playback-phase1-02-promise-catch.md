# [PLAYBACK PHASE 1-02] Ensure .catch() on All Promise.all in InitialSamplePreloader

**Parent Epic:** [Playback Domain Production Readiness](../playback-domain-production-readiness.md)

---

## Story Objective
Add `.catch()` handling to all Promise.all chains within `InitialSamplePreloader` to prevent unhandled promise rejections and improve error visibility in sample loading flows.

## Background/Context
- Unhandled rejections in asynchronous sample loading occur in `InitialSamplePreloader.ts`, causing errors to be swallowed in production (see production readiness assessment, Phase 1 Recommendation 2).
- `InitialSamplePreloader.ts` is responsible for loading multiple audio samples concurrently using Promise.all patterns.

## Requirements
- Identify all usages of `Promise.all` within `InitialSamplePreloader.ts` (and related sample loading utilities, if any).
- Ensure every `Promise.all` chain includes a `.catch()` with appropriate error logging or reporting mechanisms.
- Add a test that simulates a sample load failure and ensures the error is logged/caught without unhandled rejections.
- Document the change and error handling policy for sample preloading.

## Acceptance Criteria
- [ ] Every Promise.all in `InitialSamplePreloader.ts` and related sample loading utils has an attached `.catch()`.
- [ ] Errors in Promise chains are logged or reported with informative context.
- [ ] No unhandled promise rejection appears in automated tests for the sample loader.
- [ ] At least one test validates error capture in sample preloader flows.
- [ ] Documentation on updated error handling is added.

---

## Notes
- Related files: `src/domains/playback/services/InitialSamplePreloader.ts` (or similar)
- Important for production stability and diagnose-ability in audio sample management.

