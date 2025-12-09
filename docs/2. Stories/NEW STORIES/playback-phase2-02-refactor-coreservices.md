# [PLAYBACK PHASE 2-02] Refactor CoreServices to ServiceFactory & InitializationOrchestrator

**Parent Epic:** [Playback Domain Production Readiness](../playback-domain-production-readiness.md)

---

## Story Objective
Refactor `CoreServices.ts` to split its service factory versus initialization orchestration responsibilities into separate classes/files for improved clarity, maintainability, and separation of concerns.

## Background/Context
- `CoreServices.ts` currently combines factory/service registry patterns with buffer initialization and run-orchestration (see assessment, Phase 2-2).

## Requirements
- Analyze current code and extract all service construction logic to a `ServiceFactory` class/module.
- Extract all orchestrator/workflow/fluent initialization logic to an `InitializationOrchestrator` class/module.
- Update dependent modules to use the new classes.
- Add/refactor tests for both new classes.
- Document architecture and migration in code docs.

## Acceptance Criteria
- [ ] `CoreServices.ts` is removed (or left only as index/barrel forwarder).
- [ ] Service creation and orchestration are isolated in new, clear classes.
- [ ] All dependencies updated.
- [ ] Each new class has at least one test.
- [ ] Docs reflect new structure and intent.

