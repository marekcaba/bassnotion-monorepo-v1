# [PLAYBACK PHASE 2-05] Remove Layer Violations From React Hooks

**Parent Epic:** [Playback Domain Production Readiness](../playback-domain-production-readiness.md)

---

## Story Objective

Eliminate all React hook patterns that directly import from modules/lower level implementation; enforce service/interface-layer boundaries throughout playback domain.

## Background/Context

- Multiple hooks bypass dependency injection/service layers, importing directly from implementation modules (assessment, Phase 2-5).

## Requirements

- Audit all playback-domain hooks for direct module imports outside the public service interface.
- Refactor to ensure service, not module-level, access for all hooks.
- Add/refactor tests shutting down layer-violation paths.
- Document boundaries and allowed import patterns in contributing/developer docs.

## Acceptance Criteria

- [ ] All playback hooks rely on services, not direct module imports.
- [ ] Forbidden import patterns eliminated with testable coverage.
- [ ] Docs describe and enforce boundary.
