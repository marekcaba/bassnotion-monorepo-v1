# [PLAYBACK PHASE 4-03] Prune Debug Feature Flags in Playback Domain

**Parent Epic:** [Playback Domain Production Readiness](../playback-domain-production-readiness.md)

---

## Story Objective

Identify and remove debug-only feature flags no longer relevant after architecture/module migration.

## Background/Context

- 4 debug feature flags remain in code and should be removed post-migration (assessment, Phase 4-3).

## Requirements

- List and audit all feature/debug flags in the playback codebase.
- Remove or migrate any no longer used for production/test/stage.
- Review flag usages to prevent regression.
- Update docs to reflect flags removed and the new config.

## Acceptance Criteria

- [ ] All unused legacy/debug feature flags in playback domain are pruned.
- [ ] Remaining flags are production/test relevant.
- [ ] Documentation updated for available flags.

---

## Notes

- Grep/code-search for `FEATURE_`, `DEBUG_`, or custom flag patterns in playback domain.
