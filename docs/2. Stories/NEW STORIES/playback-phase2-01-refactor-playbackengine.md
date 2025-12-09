# [PLAYBACK PHASE 2-01] Refactor PlaybackEngine into Focused Classes

**Parent Epic:** [Playback Domain Production Readiness](../playback-domain-production-readiness.md)

---

## Story Objective
Decompose `PlaybackEngine.ts` (“god object”) into 5–6 logically separated classes, each reflecting a single key responsibility, to improve maintainability, testability, and alignment with modern architecture patterns.

## Background/Context
- `PlaybackEngine.ts` is oversized (~1400 lines, 28+ methods), conflating >10 responsibilities (see assessment, Phase 2-1).

## Requirements
- Analyze current class methods and group by main responsibilities.
- Define 5–6 new class skeletons, each mapping to a major domain concept (e.g., Scheduler, StateTracker, EventBus, AudioBufferManager, CommandDispatcher, etc.).
- Move code and migrate external uses to new classes, updating imports accordingly.
- Document the new class layout and migration rationale inside module/package docs.
- Add/refactor tests for refactored classes to preserve functionality.

## Acceptance Criteria
- [ ] PlaybackEngine is split into 5–6 purpose-specific classes with well-defined APIs.
- [ ] Legacy responsibilities are removed from the god object.
- [ ] All callers migrate to use the new class structure.
- [ ] Tests exist for each class.
- [ ] Documentation describes the new architecture.

---

## Notes
- See: `apps/frontend/src/domains/playback/engine/PlaybackEngine.ts` (or similar path)
- Seek small, tightly focused classes.

