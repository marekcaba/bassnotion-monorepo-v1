# [PLAYBACK PHASE 3-04] Add Tests for GlobalSampleCache Edge Cases

**Parent Epic:** [Playback Domain Production Readiness](../playback-domain-production-readiness.md)

---

## Story Objective
Create high-coverage tests for `GlobalSampleCache` that cover edge cases—such as cache miss, eviction, concurrent loads, and duplicate/sample overwrite.

## Background/Context
- GlobalSampleCache is critical for audio preloading, but edge cases lack tests (assessment, Phase 3-4).

## Requirements
- Identify all public/internal cache mutation/use flows.
- Write or expand tests that simulate every unusual edge/limit state: miss, eviction, concurrent request, overwrite, clear, error on add, etc.
- Add at least one regression/case for each.
- Update docstring and module README to document known tested edge cases.

## Acceptance Criteria
- [ ] Each main cache edge case is exercised in tests, and regressable.
- [ ] All cache-busting and error scenarios have a test.
- [ ] Docs/README updated for cache edge coverage.

---

## Notes
- Related files: `src/domains/playback/services/GlobalSampleCache.ts` or related sample cache modules.

