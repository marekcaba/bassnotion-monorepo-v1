# [PLAYBACK PHASE 2-04] Consolidate React Audio Hooks

**Parent Epic:** [Playback Domain Production Readiness](../playback-domain-production-readiness.md)

---

## Story Objective

Refactor and consolidate all React audio- and context-related hooks (e.g., useAudio, useCoreServices, useAudioServices, useAudioContext) into 2–3 well-named, composable hooks for clarity, maintenance, and architectural compliance.

## Background/Context

- There are four React hooks related to audio and service context, with overlap/deep coupling (see assessment, Phase 2-4).

## Requirements

- Inventory all hooks loading/creating audio services or context in playback domain.
- Design 2–3 focused hooks capturing all functional needs, separating concerns where possible.
- Refactor all usages in codebase to new hooks.
- Add/refactor tests for new hooks.
- Document names, usage, and intent of new hooks in developer docs.

## Acceptance Criteria

- [ ] All existing audio/context-related hooks are removed or aliased to new hooks.
- [ ] 2–3 composable, clearly documented hooks are present and widely used.
- [ ] All direct imports of old hooks are migrated.
- [ ] Tests cover new hooks.
- [ ] Documentation reflects migration and intent.
