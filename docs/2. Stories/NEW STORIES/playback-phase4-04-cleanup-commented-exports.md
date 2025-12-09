# [PLAYBACK PHASE 4-04] Clean Up Commented-Out Exports in Playback Domain

**Parent Epic:** [Playback Domain Production Readiness](../playback-domain-production-readiness.md)

---

## Story Objective
Audit, remove, or uncomment and document at least 10+ commented-out export statements across playback domain code, to reduce clutter and clarify public API.

## Background/Context
- More than 10 commented-out exports exist, conflating interface clarity and dead code risk (assessment, Phase 4-4).

## Requirements
- Search for commented-out export statements across playback domain.
- Remove unnecessary/dead code or uncomment and document the usage/intent where needed.
- Ensure codebase and API docs reflect actual exports.
- Test that all modules still build/export correctly.

## Acceptance Criteria
- [ ] All commented-out exports are either removed (if dead code) or uncommented and documented (if needed).
- [ ] No untracked exports or surprises in API surface.
- [ ] Code and docs reflect current state.

---

## Notes
- Search `// export` or `/* export` or similar patterns in playback-domain codebases.

