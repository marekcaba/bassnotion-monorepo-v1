# Feature Flag Strategy - PlaybackEngine Rollout

**Task:** Phase 0.4 - Feature flag and rollback infrastructure
**Status:** ✅ COMPLETED
**Date:** 2025-11-23
**Purpose:** Enable safe, gradual rollout of PlaybackEngine with <5 minute rollback capability

---

## Executive Summary

This document defines the feature flag strategy for rolling out the new PlaybackEngine to replace RegionProcessor. The strategy leverages the existing feature flag infrastructure and adds three new flags for granular control.

### Feature Flags Added

| Flag | Environment Variable | Default | Purpose |
|------|---------------------|---------|---------|
| `ENABLE_NEW_PLAYBACK_ENGINE` | `NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE` | `false` | Main toggle for PlaybackEngine |
| `DEBUG_PLAYBACK_ENGINE_MIGRATION` | `NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION` | `false` | Debug logging during rollout |
| `COMPARE_PLAYBACK_ENGINE_PERFORMANCE` | `NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE` | `false` | Performance comparison metrics |

### Rollout Timeline

| Phase | Percentage | Duration | Status |
|-------|-----------|----------|--------|
| **Phase 1:** Internal Team | 1% | 5 days | 🔜 Pending |
| **Phase 2:** Beta Users | 10% | 5 days | 🔜 Pending |
| **Phase 3:** General Rollout | 50% | 3 days | 🔜 Pending |
| **Phase 4:** Full Rollout | 100% | 2 days | 🔜 Pending |
| **Total Duration** | - | **15 days** | - |

---

## Section 1: Feature Flag Implementation

### 1.1 Flag Definitions

#### Primary Flag: ENABLE_NEW_PLAYBACK_ENGINE

**Purpose:** Controls whether CoreServices.getRegionProcessor() returns the new PlaybackEngine (via adapter) or the old RegionProcessor

**Default:** `false` (disabled)

**Behavior:**
```typescript
// In CoreServices.ts
getRegionProcessor(): RegionProcessor {
  const flags = getAudioArchitectureFlags();

  if (flags.ENABLE_NEW_PLAYBACK_ENGINE && !flags.ROLLBACK_TO_OLD_SYSTEM) {
    // Return adapter wrapping PlaybackEngine
    logPlaybackEngineMigrationEvent('Using PlaybackEngine via adapter');
    return new RegionProcessorAdapter(this.playbackEngine);
  }

  // Return old RegionProcessor
  logPlaybackEngineMigrationEvent('Using legacy RegionProcessor');
  return this.regionProcessor;
}
```

**Usage Example:**
```typescript
import { isNewPlaybackEngineEnabled } from '@/domains/playback/config/featureFlags';

if (isNewPlaybackEngineEnabled()) {
  // New engine is active
  console.log('Using PlaybackEngine');
} else {
  // Old engine is active
  console.log('Using RegionProcessor');
}
```

---

#### Debug Flag: DEBUG_PLAYBACK_ENGINE_MIGRATION

**Purpose:** Enable verbose logging during migration for debugging

**Default:** `false`

**Behavior:**
```typescript
import { logPlaybackEngineMigrationEvent } from '@/domains/playback/config/featureFlags';

// Logs only if DEBUG_PLAYBACK_ENGINE_MIGRATION=true
logPlaybackEngineMigrationEvent('Exercise loaded', {
  exerciseId: exercise.id,
  trackCount: exercise.tracks.length,
  engineType: isNewPlaybackEngineEnabled() ? 'PlaybackEngine' : 'RegionProcessor',
});
```

**When to Enable:**
- During internal team testing (Phase 1)
- When investigating user-reported issues
- For performance profiling

**When to Disable:**
- Production rollout (Phases 3-4) - reduces log noise

---

#### Performance Flag: COMPARE_PLAYBACK_ENGINE_PERFORMANCE

**Purpose:** Collect side-by-side performance metrics for both engines

**Default:** `false`

**Behavior:**
```typescript
// In performance test harness
if (flags.COMPARE_PLAYBACK_ENGINE_PERFORMANCE) {
  // Run both engines and compare
  const oldMetrics = measureRegionProcessor();
  const newMetrics = measurePlaybackEngine();

  logger.info('[Performance Comparison]', {
    old: oldMetrics,
    new: newMetrics,
    improvement: calculateImprovement(oldMetrics, newMetrics),
  });
}
```

**When to Enable:**
- Phase 1 (Internal team testing)
- Phase 2 (Beta users - sample only)
- Performance regression investigation

**When to Disable:**
- After verifying performance matches baselines
- Full production rollout (reduces overhead)

---

### 1.2 Environment Variable Configuration

#### Development (.env.local)

```bash
# PlaybackEngine Rollout Flags (Phase 0.4)

# Enable new PlaybackEngine (default: false)
NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=false

# Enable debug logging (useful during development)
NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION=true

# Enable performance comparison (optional)
NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE=true

# Rollout percentage (0-100, default: 100)
# Set to 1 for internal team testing
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=100
```

#### Staging/QA Environment

```bash
# Enable for all staging users
NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=true
NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION=true
NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE=true
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=100
```

#### Production - Phase 1 (Internal Team, 1%)

```bash
# Enable for 1% of users
NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=true
NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION=true
NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE=false
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=1
```

#### Production - Phase 2 (Beta Users, 10%)

```bash
NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=true
NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION=false  # Reduce log noise
NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE=false
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=10
```

#### Production - Phase 3 (General Rollout, 50%)

```bash
NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=true
NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION=false
NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE=false
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=50
```

#### Production - Phase 4 (Full Rollout, 100%)

```bash
NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=true
NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION=false
NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE=false
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=100
```

---

## Section 2: Flag Management (No UI Required)

### 2.1 Management Approach

**Decision:** Use environment variables only (no admin UI)

**Rationale:**
- ✅ Simple and reliable
- ✅ Fast deployment via Vercel environment variables
- ✅ Audit trail (deployment logs)
- ✅ No risk of accidental UI changes
- ✅ Consistent with existing feature flag pattern

**Alternative Considered:** Admin UI
- ❌ Additional complexity
- ❌ Security risk (who has access?)
- ❌ Deployment delay
- ❌ Not needed for gradual % rollout (already handled by `ROLLOUT_PERCENTAGE`)

---

### 2.2 Deployment Process

#### Updating Flags in Production (Vercel)

**Method 1: Vercel Dashboard**
1. Navigate to Vercel project settings
2. Go to "Environment Variables"
3. Update `NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE` value
4. Redeploy application
5. **Deployment time:** ~2-3 minutes

**Method 2: Vercel CLI**
```bash
# Update environment variable
vercel env rm NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE production
vercel env add NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE production

# Trigger redeployment
vercel --prod

# Deployment time: ~2-3 minutes
```

**Method 3: GitHub Actions (Recommended)**
```yaml
# .github/workflows/rollout-playback-engine.yml
name: Rollout PlaybackEngine

on:
  workflow_dispatch:
    inputs:
      rollout_percentage:
        description: 'Rollout percentage (1, 10, 50, 100)'
        required: true
        default: '1'

jobs:
  update-flags:
    runs-on: ubuntu-latest
    steps:
      - name: Update Vercel env vars
        run: |
          vercel env add NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE production --value ${{ inputs.rollout_percentage }}
          vercel --prod
```

---

### 2.3 Rollback Process

#### Emergency Rollback (<5 Minutes)

**Trigger:** Critical bug, memory leak, or timing regression detected

**Steps:**
1. **Set rollback flag** (1 minute)
   ```bash
   vercel env add NEXT_PUBLIC_ROLLBACK_AUDIO production --value true
   ```

2. **Trigger redeployment** (2 minutes)
   ```bash
   vercel --prod
   ```

3. **Monitor** (2 minutes)
   - Check error rates drop
   - Verify users now using RegionProcessor
   - Confirm playback works

**Total Time:** <5 minutes ✅

**Alternative: Disable without full rollback**
```bash
# Just disable new engine, keep other features
vercel env add NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE production --value false
vercel --prod
```

---

## Section 3: Monitoring & Analytics Strategy

### 3.1 Metrics to Track

#### Real-Time Metrics (During Rollout)

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| **Error Rate** | Vercel Analytics | >10% increase |
| **Engine Usage** | Feature flag logs | Track % split |
| **Memory Usage** | Browser DevTools (sampled) | >50MB growth |
| **Timing Jitter** | Performance API | >5ms avg |
| **User Complaints** | Support tickets | >5 per day |
| **Crash Rate** | Error tracking | >1% increase |

---

#### Logging Strategy

**What to Log:**
```typescript
// 1. Engine Selection
logPlaybackEngineMigrationEvent('Engine selected', {
  engine: isNewPlaybackEngineEnabled() ? 'PlaybackEngine' : 'RegionProcessor',
  userId: getUserIdentifier(),
  rolloutPercentage: flags.ROLLOUT_PERCENTAGE,
});

// 2. Critical Operations
logPlaybackEngineMigrationEvent('Exercise loaded', {
  exerciseId: exercise.id,
  loadTime: performance.now() - startTime,
  engine: currentEngine,
});

// 3. Errors
logPlaybackEngineMigrationEvent('Error occurred', {
  error: error.message,
  stack: error.stack,
  engine: currentEngine,
  exerciseId: currentExercise?.id,
});

// 4. Performance Metrics
if (flags.COMPARE_PLAYBACK_ENGINE_PERFORMANCE) {
  logPlaybackEngineMigrationEvent('Performance comparison', {
    oldEngine: { memory: 45MB, jitter: 0.8ms },
    newEngine: { memory: 42MB, jitter: 0.6ms },
    improvement: { memory: -6.7%, jitter: -25% },
  });
}
```

**Log Levels:**
- `DEBUG_PLAYBACK_ENGINE_MIGRATION=true` → All events logged
- `DEBUG_PLAYBACK_ENGINE_MIGRATION=false` → Only errors logged

---

### 3.2 Monitoring Dashboard

**Tools:**
- **Vercel Analytics** - Error rates, performance metrics
- **Browser Console** - Structured logs (in development)
- **LogRocket** (optional) - Session replay for debugging

**Dashboard Queries:**
```javascript
// Query 1: Engine usage distribution
SELECT engine, COUNT(*) as count
FROM playback_events
WHERE event = 'Engine selected'
GROUP BY engine;

// Query 2: Error rate by engine
SELECT engine, COUNT(*) as errors
FROM playback_events
WHERE event = 'Error occurred'
GROUP BY engine;

// Query 3: Performance comparison
SELECT
  AVG(old_memory) as avg_old_memory,
  AVG(new_memory) as avg_new_memory,
  AVG(old_jitter) as avg_old_jitter,
  AVG(new_jitter) as avg_new_jitter
FROM performance_comparisons;
```

---

### 3.3 Alerts

**Critical Alerts (PagerDuty / Slack)**
- Error rate >10% increase → Immediate investigation
- Memory leak detected (>100MB growth) → Emergency rollback
- Crash rate >1% → Emergency rollback

**Warning Alerts (Slack only)**
- Error rate 5-10% increase → Investigate within 1 hour
- Timing jitter 3-5ms → Monitor closely
- User complaints >3 per day → Review support tickets

---

## Section 4: Rollout Schedule Plan

### 4.1 Phase 1: Internal Team (1%)

**Duration:** 5 days (Week 5)

**Configuration:**
```bash
NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=true
NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION=true
NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE=true
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=1
```

**Participants:**
- Engineering team (5-10 users)
- QA team (2-3 users)
- Product manager (1 user)

**Activities:**
- ✅ Test all 4 widgets (HarmonyWidget, DrummerWidget, MetronomeWidget, GlobalControls)
- ✅ Test exercise switching (50+ switches)
- ✅ Test tempo changes (rapid slider adjustments)
- ✅ Test sustain pedal (HarmonyWidget with WAM keyboard)
- ✅ Performance comparison (collect baseline metrics)
- ✅ Memory leak check (play for 10+ minutes)

**Success Criteria:**
- [ ] Zero critical bugs
- [ ] Error rate <1% increase vs baseline
- [ ] Memory growth <50MB per 10 minutes
- [ ] Timing jitter <1ms average
- [ ] All team members approve

**Go/No-Go Decision:** All criteria met → Proceed to Phase 2

---

### 4.2 Phase 2: Beta Users (10%)

**Duration:** 5 days (Week 6)

**Configuration:**
```bash
NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=true
NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION=false  # Reduce log noise
NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE=false
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=10
```

**Participants:**
- ~100-500 beta users (based on user base size)
- Opt-in beta program users
- Power users (high engagement)

**Activities:**
- ✅ Monitor dashboard continuously (every hour)
- ✅ Track error rates (compare old vs new engine)
- ✅ Collect user feedback (surveys, support tickets)
- ✅ Performance regression checks
- ✅ Memory leak detection (automated tests)

**Success Criteria:**
- [ ] Error rate <5% increase vs baseline
- [ ] Zero memory leaks reported
- [ ] Timing accuracy >99%
- [ ] User feedback neutral or positive (no major complaints)
- [ ] No emergency rollbacks

**Rollback Trigger:** Error rate >10% increase → Immediate rollback

**Go/No-Go Decision:** Metrics stable for 3 consecutive days → Proceed to Phase 3

---

### 4.3 Phase 3: General Rollout (50%)

**Duration:** 3 days (Week 7, Days 1-3)

**Configuration:**
```bash
NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=true
NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION=false
NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE=false
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=50
```

**Participants:**
- ~50% of all users

**Activities:**
- ✅ Monitor dashboard hourly (first day)
- ✅ Monitor dashboard every 4 hours (days 2-3)
- ✅ Track comparative metrics (new vs old engine)
- ✅ Response to support tickets within 2 hours

**Success Criteria:**
- [ ] Error rate stable (no increase vs Phase 2)
- [ ] Memory usage stable
- [ ] Timing accuracy maintained
- [ ] User complaints <5 per day

**Rollback Trigger:** Any critical metric degradation → Immediate rollback

**Go/No-Go Decision:** All metrics green for 2 days → Proceed to Phase 4

---

### 4.4 Phase 4: Full Rollout (100%)

**Duration:** 2 days (Week 7, Days 4-5)

**Configuration:**
```bash
NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=true
NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION=false
NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE=false
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=100
```

**Participants:**
- 100% of all users

**Activities:**
- ✅ Monitor dashboard closely (first 6 hours)
- ✅ Monitor dashboard regularly (every 8 hours)
- ✅ Verify all metrics stable
- ✅ Announce rollout complete to team

**Success Criteria:**
- [ ] Error rate matches Phase 3 baseline
- [ ] Memory usage stable
- [ ] Timing accuracy >99%
- [ ] Zero critical bugs

**Completion:** After 2 days of stable metrics, rollout is complete!

---

## Section 5: Flag Usage Patterns in Code

### 5.1 CoreServices Integration

**File:** `apps/frontend/src/domains/playback/services/core/CoreServices.ts`

```typescript
import { isNewPlaybackEngineEnabled, logPlaybackEngineMigrationEvent } from '../config/featureFlags.js';
import { RegionProcessorAdapter } from './RegionProcessorAdapter.js';
import { PlaybackEngine } from './PlaybackEngine.js';

export class CoreServices {
  private regionProcessor: RegionProcessor;
  private playbackEngine: PlaybackEngine;

  constructor() {
    // Initialize BOTH engines during migration period
    this.regionProcessor = new RegionProcessor(this.eventBus);
    this.playbackEngine = new PlaybackEngine(this.eventBus);
  }

  getRegionProcessor(): RegionProcessor {
    if (isNewPlaybackEngineEnabled()) {
      logPlaybackEngineMigrationEvent('Routing to PlaybackEngine via adapter');
      return new RegionProcessorAdapter(this.playbackEngine);
    }

    logPlaybackEngineMigrationEvent('Routing to legacy RegionProcessor');
    return this.regionProcessor;
  }

  // New method for direct access (future migration)
  getPlaybackEngine(): PlaybackEngine {
    return this.playbackEngine;
  }
}
```

---

### 5.2 Widget Usage

**File:** `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidget.tsx`

```typescript
import { isNewPlaybackEngineEnabled, logPlaybackEngineMigrationEvent } from '@/domains/playback/config/featureFlags';

export function HarmonyWidget() {
  const coreServices = useCoreServices();

  useEffect(() => {
    // Get engine (automatically routed based on flag)
    const processor = coreServices.getRegionProcessor();

    logPlaybackEngineMigrationEvent('HarmonyWidget loaded', {
      engine: isNewPlaybackEngineEnabled() ? 'PlaybackEngine' : 'RegionProcessor',
    });

    // Rest of widget code unchanged (adapter handles compatibility)
    processor.registerTracks([/* ... */]);
  }, []);

  // Widget UI code...
}
```

**Key Point:** Widgets don't need code changes during migration! The adapter handles routing.

---

### 5.3 Performance Comparison

**File:** `apps/frontend/src/domains/playback/services/core/__tests__/regression-suite/performance-baselines.test.ts`

```typescript
import { getAudioArchitectureFlags } from '../config/featureFlags.js';

describe('Performance Comparison', () => {
  it('should compare old vs new engine performance', async () => {
    const flags = getAudioArchitectureFlags();

    if (!flags.COMPARE_PLAYBACK_ENGINE_PERFORMANCE) {
      console.log('Performance comparison disabled');
      return;
    }

    // Test old engine
    const oldEngine = new RegionProcessor(eventBus);
    const oldMetrics = await measurePerformance(oldEngine);

    // Test new engine
    const newEngine = new PlaybackEngine(eventBus);
    const newMetrics = await measurePerformance(newEngine);

    // Compare
    console.log('[Performance Comparison]', {
      old: oldMetrics,
      new: newMetrics,
      improvement: {
        memory: ((oldMetrics.memory - newMetrics.memory) / oldMetrics.memory * 100).toFixed(2) + '%',
        jitter: ((oldMetrics.jitter - newMetrics.jitter) / oldMetrics.jitter * 100).toFixed(2) + '%',
      },
    });

    // Verify new engine matches or improves
    expect(newMetrics.memory).toBeLessThanOrEqual(oldMetrics.memory);
    expect(newMetrics.jitter).toBeLessThanOrEqual(oldMetrics.jitter);
  });
});
```

---

## Section 6: Rollback Trigger Conditions

### 6.1 Critical Triggers (Immediate Rollback)

| Condition | Threshold | Action | Time Limit |
|-----------|-----------|--------|------------|
| **Error Rate Spike** | >10% increase | Emergency rollback | <5 minutes |
| **Memory Leak** | >100MB growth in 10 min | Emergency rollback | <5 minutes |
| **Crash Rate** | >1% of users | Emergency rollback | <5 minutes |
| **Timing Regression** | >5ms average jitter | Emergency rollback | <5 minutes |
| **Critical Bug** | Sustain pedal broken, no audio | Emergency rollback | <5 minutes |

---

### 6.2 Warning Triggers (Investigate First)

| Condition | Threshold | Action | Time Limit |
|-----------|-----------|--------|------------|
| **Error Rate Increase** | 5-10% increase | Investigate, monitor closely | 1 hour |
| **Memory Growth** | 50-100MB in 10 min | Check for leaks, monitor | 2 hours |
| **Timing Drift** | 3-5ms average jitter | Performance profiling | 4 hours |
| **User Complaints** | 3-5 per day | Review tickets, reproduce | 1 day |

---

### 6.3 Rollback Decision Matrix

```
IF error_rate_increase > 10% THEN
  EXECUTE emergency_rollback()
  NOTIFY team_slack()
  CREATE incident_ticket()
ELSE IF error_rate_increase > 5% THEN
  ALERT team_slack()
  MONITOR for 1 hour
  IF still_elevated THEN
    EXECUTE emergency_rollback()
  END IF
END IF

IF memory_growth > 100MB THEN
  EXECUTE emergency_rollback()
  LOG memory_profile()
ELSE IF memory_growth > 50MB THEN
  ALERT team_slack()
  MONITOR for 2 hours
END IF

IF crash_rate > 1% THEN
  EXECUTE emergency_rollback()
  COLLECT crash_reports()
END IF
```

---

### 6.4 Rollback Procedure

**Emergency Rollback Steps:**

1. **Set Rollback Flag** (1 minute)
   ```bash
   # Method 1: Full rollback
   vercel env add NEXT_PUBLIC_ROLLBACK_AUDIO production --value true

   # Method 2: Just disable new engine
   vercel env add NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE production --value false
   ```

2. **Trigger Deployment** (2 minutes)
   ```bash
   vercel --prod
   ```

3. **Verify Rollback** (1 minute)
   - Check error rate drops
   - Verify users using RegionProcessor
   - Confirm playback works

4. **Monitor** (1 minute)
   - Watch dashboard for 5 minutes
   - Ensure metrics return to baseline

**Total Time:** <5 minutes ✅

---

### 6.5 Post-Rollback Actions

**Immediate (Within 1 hour):**
- [ ] Create incident postmortem
- [ ] Collect error logs
- [ ] Reproduce issue locally
- [ ] Identify root cause

**Short-Term (Within 1 day):**
- [ ] Fix bug
- [ ] Add regression test
- [ ] Test fix in staging
- [ ] Re-enable flag for internal team (1%)

**Long-Term (Within 1 week):**
- [ ] Verify fix in production (1% rollout)
- [ ] Gradually re-roll out (10% → 50% → 100%)
- [ ] Document lesson learned

---

## Section 7: Communication Plan

### 7.1 Internal Team Communication

**Channels:**
- **Slack #engineering** - Rollout announcements
- **Slack #playback-migration** - Detailed updates
- **Email** - Formal announcements

**Templates:**

#### Phase Start Announcement
```
🚀 PlaybackEngine Rollout - Phase {N} Starting

We're rolling out the new PlaybackEngine to {X}% of users today.

**What to watch:**
- Error rates (target: <5% increase)
- Memory usage (target: <50MB growth)
- User complaints (target: <5 per day)

**Dashboard:** [link]
**Rollback procedure:** [link to this doc]

**On-call engineer:** @{name}
```

#### Rollback Announcement
```
⚠️ ROLLBACK: PlaybackEngine → RegionProcessor

We've rolled back the PlaybackEngine due to: {reason}

**Issue:** {description}
**Rollback time:** {X} minutes
**Status:** All users now on RegionProcessor

**Next steps:**
- Root cause analysis (owner: @{name})
- Fix ETA: {date}
- Re-rollout plan: TBD

**Incident ticket:** {link}
```

---

### 7.2 User Communication

**When to Notify Users:**
- **Never** during gradual rollout (users shouldn't notice)
- **Only if:** Critical bug affects user experience

**Template (if needed):**
```
We recently updated our audio playback system. If you experience
any issues with playback, please refresh your browser.

For assistance, contact support@bassnotion.com
```

---

## Section 8: Success Criteria

### 8.1 Phase 0.4 Complete When:
- [x] `ENABLE_NEW_PLAYBACK_ENGINE` flag added to config
- [x] `DEBUG_PLAYBACK_ENGINE_MIGRATION` flag added
- [x] `COMPARE_PLAYBACK_ENGINE_PERFORMANCE` flag added
- [x] Environment variable handling implemented
- [x] Helper functions created (`isNewPlaybackEngineEnabled`, `logPlaybackEngineMigrationEvent`)
- [x] Rollout schedule documented (4 phases, 15 days)
- [x] Rollback procedure documented (<5 minute target)
- [x] Monitoring strategy defined
- [x] Communication templates created

### 8.2 Phase 3.1 (Rollout) Complete When:
- [ ] Phase 1 (1%) successful - 5 days
- [ ] Phase 2 (10%) successful - 5 days
- [ ] Phase 3 (50%) successful - 3 days
- [ ] Phase 4 (100%) successful - 2 days
- [ ] Zero critical bugs in production
- [ ] Error rate <1% increase vs baseline
- [ ] Memory usage stable
- [ ] Timing accuracy >99%
- [ ] User feedback positive or neutral

---

## Section 9: Next Steps

### 9.1 Before Phase 1 Kickoff

1. ✅ Complete Phase 0 tasks (0.1-0.7)
2. ✅ Complete Phase 1 (Core Refactor)
3. ✅ Complete Phase 2 (Bug Preservation & Widget Migration)
4. [ ] Team training on rollback procedure
5. [ ] Set up monitoring dashboard
6. [ ] Configure Vercel environment variables
7. [ ] Schedule Phase 1 kickoff meeting

### 9.2 Phase 1 Preparation Checklist

- [ ] All regression tests passing
- [ ] PlaybackEngine matches RegionProcessor baselines
- [ ] Adapter implementation complete and tested
- [ ] All 4 widgets migrated and tested
- [ ] Bug fixes preserved and verified
- [ ] Documentation complete
- [ ] Team trained on monitoring
- [ ] Rollback procedure tested in staging

---

## Document Metadata

**Created:** 2025-11-23
**Last Updated:** 2025-11-23
**Version:** 1.0
**Status:** ✅ COMPLETE

**Next Document:** Task 0.5 - `ROLLBACK_PROCEDURE.md`
