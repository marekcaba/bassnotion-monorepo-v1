# PlaybackEngine Rollout Report

**Epic:** Professional Playback System Modernization
**Story ID:** PLAYBACK-REFACTOR-2025
**Task:** Phase 3.1 - Staged Rollout with Feature Flag
**Status:** 🟡 **In Progress** - Phase 1 (Week 5)
**Report Date:** 2025-11-23

---

## Executive Summary

This document tracks the staged rollout of the new PlaybackEngine to replace the legacy RegionProcessor. The rollout follows a 4-phase approach over 15 days, with continuous monitoring and rollback capability at each stage.

### Rollout Timeline

| Phase                        | Percentage | Duration    | Start Date | End Date   | Status             |
| ---------------------------- | ---------- | ----------- | ---------- | ---------- | ------------------ |
| **Phase 1:** Internal Team   | 1%         | 5 days      | 2025-11-23 | 2025-11-27 | 🟡 **In Progress** |
| **Phase 2:** Beta Users      | 10%        | 5 days      | TBD        | TBD        | 🔜 Pending         |
| **Phase 3:** General Rollout | 50%        | 3 days      | TBD        | TBD        | 🔜 Pending         |
| **Phase 4:** Full Rollout    | 100%       | 2 days      | TBD        | TBD        | 🔜 Pending         |
| **Total Duration**           | -          | **15 days** | -          | -          | -                  |

### Overall Status

✅ **Phase 0 (Discovery):** Complete - All 7 tasks complete
✅ **Phase 1 (Core Refactor):** Complete - All 5 tasks complete
✅ **Phase 2 (Bug Preservation & Migration):** Complete - All 2 tasks complete
🟡 **Phase 3 (Rollout):** In Progress - Phase 1 Week 5

---

## Phase 1: Internal Team Rollout (1%)

**Duration:** 5 days (November 23-27, 2025)
**Target Audience:** Engineering team, QA team, Product manager
**Estimated Users:** 5-10 users

### Configuration

```bash
# .env.local configuration for Phase 1
NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=true
NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION=true
NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE=true
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=1
```

### Day 1: November 23, 2025

#### Setup Actions

- [x] Feature flags configured in [featureFlags.ts](../../../apps/frontend/src/domains/playback/config/featureFlags.ts)
- [x] Environment variables set in .env.local
- [x] PM2 servers restarted to apply configuration
- [x] Rollout report initialized

#### Monitoring Checklist

- [x] Dashboard setup verified (Feature flags in place)
- [x] Error tracking confirmed working (Structured logging enabled)
- [x] Memory profiling enabled (Browser DevTools ready)
- [x] Timing accuracy measurements active (Performance API ready)
- [ ] Team notification sent

#### Initial Metrics (Baseline)

**Error Rates:**

- PlaybackEngine errors: TBD
- RegionProcessor errors: TBD
- Error rate increase: TBD%

**Memory Usage:**

- PlaybackEngine peak memory: TBD MB
- RegionProcessor peak memory: TBD MB
- Memory growth over 10 minutes: TBD MB

**Timing Accuracy:**

- Average jitter: TBD ms
- Max jitter: TBD ms
- Scheduling latency: TBD ms

**User Experience:**

- Widget load time: TBD ms
- Exercise switching time: TBD ms
- User complaints: 0

#### Issues Discovered

**Issue #1: CRITICAL - Rollout percentage logic disables CoreServices at 1%**

- **Severity:** Critical (Blocking)
- **Discovered:** 2025-11-24 (Day 1)
- **Symptom:** "Timeout waiting for audio services" error when clicking exercise and play button
- **Root Cause:** The `ROLLOUT_PERCENTAGE` flag at 1% was disabling Epic 3.18 flags (`USE_NEW_AUDIO_ENGINE`, `USE_NEW_DEPENDENCY_INJECTION`) in `featureFlags.ts` lines 141-151. This prevented AudioProvider from initializing CoreServices entirely, making the entire audio system non-functional.
- **Design Flaw:** Epic 3.18 (CoreServices architecture - completed) was conflated with Phase 3.1 (PlaybackEngine rollout - in progress). These should be separate:
  - Epic 3.18 rollout = 100% (CoreServices must always initialize)
  - Phase 3.1 rollout = 1% (which engine CoreServices uses: RegionProcessor vs PlaybackEngine)
- **Temporary Fix:** Set `NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=100` in `.env.local` to enable CoreServices
- **Proper Fix Needed:** Separate rollout into two independent flags:
  - `EPIC_3_18_ROLLOUT_PERCENTAGE` (controls CoreServices initialization - should be 100%)
  - `PLAYBACK_ENGINE_ROLLOUT_PERCENTAGE` (controls PlaybackEngine vs RegionProcessor - can be 1%)
- **Files Modified:**
  - `apps/frontend/.env.local` (line 23: changed 1 → 100)
  - `apps/frontend/src/domains/playback/hooks/useTrack.ts` (lines 31, 39-105: added WindowRegistry pattern)
  - `apps/frontend/src/domains/playback/providers/AudioProvider.tsx` (lines 120-138: added diagnostics)
- **Status:** WORKAROUND APPLIED - CoreServices now initializes, but proper fix needed before proceeding to Phase 2

**Issue #2: Pre-existing bugs discovered during rollout**

- **Severity:** Medium
- **Discovered:** 2025-11-24 (Day 1)
- **Bugs Fixed:**
  1. `library/[tutorialId]/page.tsx` - incorrect logger import (`createLogger` → `getLogger`)
  2. `HarmonyPreloadStrategy.ts` - undefined `audioBuffer` variable (3 instances, should be `arrayBuffer`)
- **Status:** Fixed

**Issue #3: InitialSamplePreloader using legacy window globals**

- **Severity:** High
- **Discovered:** 2025-11-24 (Day 1)
- **Symptom:** "CRITICAL: CoreServices not found!" error during sample preloading
- **Root Cause:** `InitialSamplePreloader.ts:86` was accessing `window.__globalCoreServices` (legacy key) instead of using `WindowRegistry.getCoreServices()`. When `WindowRegistry.setCoreServices()` runs, it deletes legacy keys, making them unavailable.
- **Fix:** Updated InitialSamplePreloader to use `WindowRegistry.getCoreServices()`
- **Files Modified:**
  - `apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts` (line 86-88)
- **Status:** Fixed

**Issue #4: ServiceRegistry mismatch in useTrack causing initialization failures**

- **Severity:** Critical (Blocking)
- **Discovered:** 2025-11-24 (Day 1)
- **Symptom:** "Service eventBus not found - ServiceRegistry may not be initialized yet" error when initializing tracks (interactive-fretboard, metronome, drums, etc.)
- **Root Cause:** After fixing Issue #3, a new issue emerged. The `waitForServices()` function in `useTrack.ts` successfully validated services via `WindowRegistry.getServiceRegistry()` (GLOBAL registry), but then line 221 tried to use the `serviceRegistry` parameter (LOCAL prop passed to hook) which was not the same instance.
- **The Disconnect:**
  - Line 39-105: `waitForServices()` checks `WindowRegistry.getServiceRegistry()` (global singleton)
  - Line 221: `eventBusRef.current = serviceRegistry.get('eventBus')` uses local prop (different instance)
- **Fix:** Changed line 221-226 to use `WindowRegistry.getServiceRegistry()` instead of local prop
- **Files Modified:**
  - `apps/frontend/src/domains/playback/hooks/useTrack.ts` (lines 220-226: use global registry)
  - `apps/frontend/src/domains/playback/hooks/useTrack.ts` (lines 39-89: cleaned up diagnostic logs)
  - `apps/frontend/src/domains/playback/providers/AudioProvider.tsx` (lines 119-138: cleaned up diagnostic logs)
- **Status:** Fixed - awaiting verification

#### Actions Taken

- [x] Rollout report created
- [x] Configuration documented in .env.local
- [x] Feature flags verified in featureFlags.ts
- [x] Fixed `createLogger` → `getLogger` import in library/[tutorialId]/page.tsx (Issue #2)
- [x] Fixed `audioBuffer` → `arrayBuffer` in HarmonyPreloadStrategy.ts (3 occurrences) (Issue #2)
- [x] Updated useTrack.ts to use WindowRegistry pattern
- [x] Added diagnostic logging to AudioProvider.tsx (for Issue #1 investigation)
- [x] Discovered critical rollout percentage bug (Issue #1)
- [x] Applied workaround: ROLLOUT_PERCENTAGE=100 to enable CoreServices (Issue #1)
- [x] Verified CoreServices initialization successful
- [x] Fixed InitialSamplePreloader to use WindowRegistry (Issue #3)
- [x] Fixed serviceRegistry mismatch in useTrack.ts (Issue #4)
- [x] Clean up diagnostic console.logs from useTrack and AudioProvider
- [ ] Test end-to-end playback functionality with exercise
- [ ] Implement proper fix: separate Epic 3.18 and Phase 3.1 rollout flags
- [ ] Search for other files using legacy window globals and update them

---

### Day 2: November 24, 2025

#### Monitoring Checklist

- [ ] Error rates checked (hourly)
- [ ] Memory usage verified (every 2 hours)
- [ ] Timing accuracy measured
- [ ] Team feedback collected
- [ ] Performance comparison data gathered

#### Metrics

**Error Rates:**

- PlaybackEngine errors: TBD
- RegionProcessor errors: TBD
- Error rate increase: TBD%

**Memory Usage:**

- PlaybackEngine peak memory: TBD MB
- RegionProcessor peak memory: TBD MB
- Memory growth: TBD MB

**Timing Accuracy:**

- Average jitter: TBD ms
- Max jitter: TBD ms
- Scheduling latency: TBD ms

**User Experience:**

- Widget load time: TBD ms
- Exercise switching time: TBD ms
- User complaints: TBD

#### Issues Discovered

_To be updated_

#### Actions Taken

_To be updated_

---

### Day 3: November 25, 2025

#### Monitoring Checklist

- [ ] Error rates stable
- [ ] Memory usage within limits
- [ ] Timing accuracy maintained
- [ ] Team feedback positive
- [ ] No critical bugs

#### Metrics

_To be updated daily_

#### Issues Discovered

_To be updated_

#### Actions Taken

_To be updated_

---

### Day 4: November 26, 2025

#### Monitoring Checklist

- [ ] Error rates stable
- [ ] Memory usage within limits
- [ ] Timing accuracy maintained
- [ ] Team feedback positive
- [ ] No critical bugs

#### Metrics

_To be updated daily_

#### Issues Discovered

_To be updated_

#### Actions Taken

_To be updated_

---

### Day 5: November 27, 2025

#### Monitoring Checklist

- [ ] Final error rate check
- [ ] Final memory usage check
- [ ] Final timing accuracy check
- [ ] Team sign-off collected
- [ ] Go/No-Go decision for Phase 2

#### Final Metrics (Phase 1 Summary)

**Error Rates:**

- PlaybackEngine errors: TBD
- RegionProcessor errors: TBD
- Error rate change: TBD%

**Memory Usage:**

- PlaybackEngine avg memory: TBD MB
- RegionProcessor avg memory: TBD MB
- Memory improvement: TBD%

**Timing Accuracy:**

- Average jitter: TBD ms (target: <1ms)
- Max jitter: TBD ms (target: <5ms)
- Scheduling latency: TBD ms (target: <100ms)

**User Experience:**

- Widget load time: TBD ms
- Exercise switching time: TBD ms
- Total user complaints: TBD (target: 0)

#### Phase 1 Success Criteria

- [ ] Zero critical bugs
- [ ] Error rate <1% increase vs baseline
- [ ] Memory growth <50MB per 10 minutes
- [ ] Timing jitter <1ms average
- [ ] All team members approve

#### Go/No-Go Decision

**Status:** TBD
**Decision:** TBD (Proceed to Phase 2 / Hold / Rollback)
**Decision Maker:** TBD
**Rationale:** TBD

#### Phase 1 Summary

_To be completed on Day 5_

---

## Phase 2: Beta Users Rollout (10%)

**Duration:** 5 days (TBD)
**Target Audience:** ~100-500 beta users, opt-in users, power users
**Status:** 🔜 Pending Phase 1 completion

### Configuration

```bash
NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=true
NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION=false  # Reduce log noise
NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE=false
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=10
```

### Success Criteria

- [ ] Error rate <5% increase vs baseline
- [ ] Zero memory leaks reported
- [ ] Timing accuracy >99%
- [ ] User feedback neutral or positive
- [ ] No emergency rollbacks

### Rollback Trigger

Error rate >10% increase → Immediate rollback

_Phase 2 details to be completed after Phase 1 success_

---

## Phase 3: General Rollout (50%)

**Duration:** 3 days (TBD)
**Target Audience:** ~50% of all users
**Status:** 🔜 Pending Phase 2 completion

### Configuration

```bash
NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=true
NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION=false
NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE=false
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=50
```

### Success Criteria

- [ ] Error rate stable (no increase vs Phase 2)
- [ ] Memory usage stable
- [ ] Timing accuracy maintained
- [ ] User complaints <5 per day

_Phase 3 details to be completed after Phase 2 success_

---

## Phase 4: Full Rollout (100%)

**Duration:** 2 days (TBD)
**Target Audience:** 100% of all users
**Status:** 🔜 Pending Phase 3 completion

### Configuration

```bash
NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=true
NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION=false
NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE=false
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=100
```

### Success Criteria

- [ ] Error rate matches Phase 3 baseline
- [ ] Memory usage stable
- [ ] Timing accuracy >99%
- [ ] Zero critical bugs

_Phase 4 details to be completed after Phase 3 success_

---

## Monitoring Dashboard

### Key Metrics Tracked

#### 1. Error Rates

- **Metric:** Errors per 1000 playback sessions
- **Alert Threshold:** >10% increase
- **Warning Threshold:** 5-10% increase
- **Target:** <1% increase vs baseline

#### 2. Memory Usage

- **Metric:** Peak memory during playback
- **Alert Threshold:** >100MB growth in 10 minutes
- **Warning Threshold:** 50-100MB growth
- **Target:** <50MB growth

#### 3. Timing Accuracy

- **Metric:** Average and max jitter in ms
- **Alert Threshold:** >5ms average jitter
- **Warning Threshold:** 3-5ms average jitter
- **Target:** <1ms average, <5ms max

#### 4. Performance Metrics

- **Metric:** Initialization time, scheduling latency
- **Alert Threshold:** >2x baseline
- **Warning Threshold:** >1.5x baseline
- **Target:** Match or improve baseline

#### 5. User Experience

- **Metric:** Widget load time, exercise switching time
- **Alert Threshold:** >500ms increase
- **Warning Threshold:** >200ms increase
- **Target:** <100ms increase

### Monitoring Queries

```javascript
// Query 1: Engine usage distribution
SELECT engine, COUNT(*) as count
FROM playback_events
WHERE event = 'Engine selected'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY engine;

// Query 2: Error rate by engine
SELECT
  engine,
  COUNT(*) as total_errors,
  COUNT(*) / (SELECT COUNT(*) FROM playback_sessions WHERE engine = e.engine) as error_rate
FROM playback_errors e
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY engine;

// Query 3: Memory usage comparison
SELECT
  engine,
  AVG(peak_memory) as avg_peak_memory,
  MAX(peak_memory) as max_peak_memory,
  AVG(memory_growth_10min) as avg_growth
FROM memory_metrics
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY engine;

// Query 4: Timing accuracy
SELECT
  engine,
  AVG(jitter_ms) as avg_jitter,
  MAX(jitter_ms) as max_jitter,
  AVG(scheduling_latency_ms) as avg_latency
FROM timing_metrics
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY engine;
```

---

## Issues Log

### Issue Template

```
**Issue ID:** PLAYBACK-XXX
**Severity:** Critical / High / Medium / Low
**Phase:** 1 / 2 / 3 / 4
**Discovered:** YYYY-MM-DD HH:MM
**Engine:** PlaybackEngine / RegionProcessor
**Description:** [Brief description]
**Impact:** [User impact]
**Root Cause:** [Technical details]
**Resolution:** [How it was fixed]
**Resolved:** YYYY-MM-DD HH:MM
**Time to Resolve:** X hours
```

### Critical Issues

_No critical issues discovered yet_

### High Priority Issues

_No high priority issues discovered yet_

### Medium Priority Issues

_No medium priority issues discovered yet_

### Low Priority Issues

_No low priority issues discovered yet_

---

## Rollback Events

### Rollback Template

```
**Rollback ID:** RB-XXX
**Phase:** 1 / 2 / 3 / 4
**Triggered:** YYYY-MM-DD HH:MM
**Trigger Reason:** [Metric / Issue]
**Rollback Time:** X minutes
**Recovery Time:** X minutes
**Root Cause:** [Technical details]
**Actions Taken:** [Steps to resolve]
**Re-rollout Date:** YYYY-MM-DD
```

### Rollback History

_No rollbacks performed yet_

---

## Performance Comparison

### Baseline (RegionProcessor)

**Memory:**

- Peak memory: TBD MB
- Memory growth (10 min): TBD MB
- Cleanup time: TBD ms

**Timing:**

- Average jitter: TBD ms
- Max jitter: TBD ms
- Scheduling latency (1000 events): TBD ms

**Performance:**

- Initialization time: TBD ms
- Exercise switching time: TBD ms
- Widget load time: TBD ms

### PlaybackEngine (Target)

**Memory:**

- Peak memory: TBD MB (target: ≤baseline)
- Memory growth (10 min): TBD MB (target: <50MB)
- Cleanup time: TBD ms (target: <500ms)

**Timing:**

- Average jitter: TBD ms (target: <1ms)
- Max jitter: TBD ms (target: <5ms)
- Scheduling latency (1000 events): TBD ms (target: <100ms)

**Performance:**

- Initialization time: TBD ms (target: ≤baseline)
- Exercise switching time: TBD ms (target: ≤baseline)
- Widget load time: TBD ms (target: ≤baseline)

### Improvement Summary

_To be calculated after Phase 1 completion_

---

## Team Feedback

### Internal Team (Phase 1)

#### Engineering Team

_Feedback to be collected_

#### QA Team

_Feedback to be collected_

#### Product Manager

_Feedback to be collected_

### Beta Users (Phase 2)

_Feedback to be collected after Phase 2_

### General Users (Phase 3-4)

_Feedback to be collected after Phase 3-4_

---

## Lessons Learned

### What Went Well

_To be documented throughout rollout_

### What Could Be Improved

_To be documented throughout rollout_

### Recommendations for Future Rollouts

_To be documented after completion_

---

## Appendix

### A. Environment Configuration

#### Development (.env.local)

```bash
# PlaybackEngine Rollout Flags
NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=true
NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION=true
NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE=true
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=1
```

#### Staging

```bash
NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=true
NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION=true
NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE=true
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=100
```

#### Production (varies by phase)

_See phase-specific configuration above_

### B. Test Results Summary

**Phase 0 (Discovery):** ✅ 7/7 tasks complete
**Phase 1 (Core Refactor):** ✅ 5/5 tasks complete, 179 tests passing
**Phase 2 (Bug Preservation & Migration):** ✅ 2/2 tasks complete, 42 tests passing

**Total Tests:** 221 tests passing (100%)

### C. References

- [PLAYBACK_ENGINE_REFACTOR_STORY.md](./PLAYBACK_ENGINE_REFACTOR_STORY.md) - Master story
- [FEATURE_FLAG_STRATEGY.md](./FEATURE_FLAG_STRATEGY.md) - Flag implementation
- [ROLLBACK_PROCEDURE.md](./ROLLBACK_PROCEDURE.md) - Emergency rollback steps
- [BUG_FIX_VERIFICATION_REPORT.md](./BUG_FIX_VERIFICATION_REPORT.md) - Bug fix tests
- [WIDGET_MIGRATION_GUIDE.md](./WIDGET_MIGRATION_GUIDE.md) - Widget migration docs

---

## Document Metadata

**Created:** 2025-11-23
**Last Updated:** 2025-11-23
**Version:** 1.0
**Status:** 🟡 In Progress - Phase 1 Day 1
**Next Update:** Daily during active rollout

---

## Next Steps

### Immediate (Day 1)

1. [ ] Configure environment variables in .env.local
2. [ ] Restart PM2 servers to apply configuration
3. [ ] Verify feature flags are working
4. [ ] Set up monitoring dashboard
5. [ ] Send team notification about Phase 1 start

### Short-term (Days 2-5)

1. [ ] Daily metric collection
2. [ ] Daily team feedback gathering
3. [ ] Issue tracking and resolution
4. [ ] Performance comparison data analysis
5. [ ] Prepare Go/No-Go decision for Phase 2

### Long-term (Phases 2-4)

1. [ ] Progressive rollout to larger user base
2. [ ] Continuous monitoring and optimization
3. [ ] Documentation of lessons learned
4. [ ] Final cleanup and legacy code removal (Task 3.2)
