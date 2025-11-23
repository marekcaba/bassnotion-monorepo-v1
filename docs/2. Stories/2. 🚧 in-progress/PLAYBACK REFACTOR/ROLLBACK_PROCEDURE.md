# Playback Engine Rollback & Monitoring Procedures

**Story:** PLAYBACK-REFACTOR-2025
**Task:** 0.5 - Monitoring & Incident Response Prep
**Created:** 2025-11-23
**Status:** ✅ Complete

---

## Table of Contents

1. [Production Monitoring Dashboard](#1-production-monitoring-dashboard)
2. [Alert Configuration](#2-alert-configuration)
3. [Rollback Procedure](#3-rollback-procedure)
4. [Incident Response Runbook](#4-incident-response-runbook)
5. [Communication Templates](#5-communication-templates)
6. [Team Training Checklist](#6-team-training-checklist)
7. [Post-Incident Review Process](#7-post-incident-review-process)
8. [Testing the Rollback](#8-testing-the-rollback)

---

## 1. Production Monitoring Dashboard

### 1.1 Real-Time Playback Health Metrics

**Dashboard URL:** TBD (Vercel Analytics / Custom Dashboard)

**Key Metrics to Display:**

#### Engine Type Distribution
```typescript
// Track which engine is being used
interface EngineUsageMetric {
  timestamp: Date;
  engineType: 'legacy' | 'new';
  userId: string;
  sessionId: string;
}

// Query for dashboard:
// SELECT engineType, COUNT(*) as usage_count
// FROM playback_engine_events
// WHERE timestamp > NOW() - INTERVAL '1 hour'
// GROUP BY engineType
```

**Visual:** Pie chart showing % of users on each engine

#### Error Rate by Engine Type
```typescript
interface ErrorMetric {
  timestamp: Date;
  engineType: 'legacy' | 'new';
  errorType: string;
  errorMessage: string;
  stackTrace: string;
  correlationId: string;
}

// Query for dashboard:
// SELECT engineType, COUNT(*) as error_count
// FROM playback_errors
// WHERE timestamp > NOW() - INTERVAL '1 hour'
// GROUP BY engineType
```

**Visual:** Line chart comparing error rates over time
- **Red Line:** New engine error rate
- **Green Line:** Legacy engine error rate
- **Alert Threshold:** Red line >10% higher than green line

#### Playback State Distribution
```typescript
interface StateMetric {
  timestamp: Date;
  engineType: 'legacy' | 'new';
  state: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'stopped' | 'error';
  duration: number; // milliseconds in this state
}

// Query for dashboard:
// SELECT state, AVG(duration) as avg_duration
// FROM playback_state_transitions
// WHERE engineType = 'new' AND timestamp > NOW() - INTERVAL '1 hour'
// GROUP BY state
```

**Visual:** Bar chart showing time spent in each state
- **Alert:** If >5% of time spent in 'error' state

---

### 1.2 Memory Usage Tracking

#### Memory Growth Over Time
```typescript
interface MemoryMetric {
  timestamp: Date;
  engineType: 'legacy' | 'new';
  heapUsed: number; // MB
  heapTotal: number; // MB
  external: number; // MB
  audioSources: number; // count of active AudioBufferSourceNode
  eventListeners: number; // count of active EventBus listeners
}

// Query for dashboard:
// SELECT
//   engineType,
//   AVG(heapUsed) as avg_heap,
//   MAX(heapUsed) as peak_heap,
//   AVG(audioSources) as avg_sources
// FROM memory_snapshots
// WHERE timestamp > NOW() - INTERVAL '1 hour'
// GROUP BY engineType
```

**Visual:** Multi-line chart
- **Heap Used:** Primary Y-axis (MB)
- **Audio Sources:** Secondary Y-axis (count)
- **Alert Threshold:** Heap growth >100MB over 10 minutes

#### Memory Leak Detection
```typescript
// Automated leak detection algorithm
interface LeakDetectionResult {
  timestamp: Date;
  engineType: 'legacy' | 'new';
  leakDetected: boolean;
  growthRate: number; // MB per minute
  confidence: number; // 0-100%
  recommendation: 'monitor' | 'investigate' | 'rollback';
}

// Algorithm:
// 1. Sample memory every 60 seconds
// 2. Calculate linear regression over last 10 samples
// 3. If slope > 10MB/min with R² > 0.8, flag as leak
// 4. If leak persists for 5 minutes → CRITICAL ALERT
```

**Visual:** Alert banner at top of dashboard
- **Green:** No leak detected
- **Yellow:** Suspicious growth pattern (monitoring)
- **Red:** Leak confirmed (immediate action required)

---

### 1.3 Timing Accuracy Monitoring

#### Scheduling Jitter Measurement
```typescript
interface TimingMetric {
  timestamp: Date;
  engineType: 'legacy' | 'new';
  expectedTime: number; // Web Audio API time (seconds)
  actualTime: number; // Web Audio API time (seconds)
  jitter: number; // |expected - actual| in milliseconds
  instrumentType: 'metronome' | 'drums' | 'harmony' | 'bass' | 'voiceCue';
}

// Query for dashboard:
// SELECT
//   engineType,
//   AVG(jitter) as avg_jitter,
//   MAX(jitter) as max_jitter,
//   PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY jitter) as p95_jitter
// FROM timing_measurements
// WHERE timestamp > NOW() - INTERVAL '1 hour'
// GROUP BY engineType
```

**Visual:** Box plot comparing jitter distribution
- **Target:** Avg jitter <1ms, P95 <5ms
- **Alert:** Avg jitter >3ms OR P95 >10ms

#### Tempo Change Responsiveness
```typescript
interface TempoChangeMetric {
  timestamp: Date;
  engineType: 'legacy' | 'new';
  oldTempo: number;
  newTempo: number;
  responseTime: number; // milliseconds from change to reschedule
  debounceTriggered: boolean;
  eventsCancelled: number;
  eventsRescheduled: number;
}

// Query for dashboard:
// SELECT
//   engineType,
//   AVG(responseTime) as avg_response,
//   COUNT(CASE WHEN debounceTriggered THEN 1 END) as debounce_count
// FROM tempo_changes
// WHERE timestamp > NOW() - INTERVAL '1 hour'
// GROUP BY engineType
```

**Visual:** Scatter plot (tempo change size vs response time)
- **Target:** 90% of changes <100ms response time
- **Alert:** Any response time >500ms (indicates debounce failure)

---

### 1.4 Performance Metrics

#### Initialization Time
```typescript
interface InitMetric {
  timestamp: Date;
  engineType: 'legacy' | 'new';
  phase: 'audioContext' | 'samplePreload' | 'engineInit' | 'total';
  duration: number; // milliseconds
  success: boolean;
  errorMessage?: string;
}

// Query for dashboard:
// SELECT
//   engineType,
//   phase,
//   AVG(duration) as avg_duration,
//   PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration) as p95_duration
// FROM initialization_metrics
// WHERE timestamp > NOW() - INTERVAL '1 hour' AND success = true
// GROUP BY engineType, phase
```

**Visual:** Stacked bar chart (phases of initialization)
- **Target:** Total init <3 seconds (P95)
- **Alert:** P95 >5 seconds (degraded performance)

#### Scheduling Performance
```typescript
interface SchedulingMetric {
  timestamp: Date;
  engineType: 'legacy' | 'new';
  eventCount: number;
  schedulingTime: number; // milliseconds
  instrumentTypes: string[]; // which instruments were scheduled
}

// Query for dashboard:
// SELECT
//   engineType,
//   AVG(schedulingTime) as avg_time,
//   AVG(eventCount) as avg_events,
//   AVG(schedulingTime / eventCount) as time_per_event
// FROM scheduling_metrics
// WHERE timestamp > NOW() - INTERVAL '1 hour'
// GROUP BY engineType
```

**Visual:** Line chart (events/second over time)
- **Target:** <100ms for 1000 events (baseline from REGRESSION_TEST_SUITE.md)
- **Alert:** >200ms for 1000 events (2x degradation)

---

### 1.5 User Experience Metrics

#### Widget Load Success Rate
```typescript
interface WidgetLoadMetric {
  timestamp: Date;
  engineType: 'legacy' | 'new';
  widgetType: 'harmony' | 'drums' | 'metronome' | 'voiceCue' | 'bass';
  success: boolean;
  loadTime: number; // milliseconds
  errorMessage?: string;
}

// Query for dashboard:
// SELECT
//   engineType,
//   widgetType,
//   (COUNT(CASE WHEN success THEN 1 END)::float / COUNT(*)) * 100 as success_rate
// FROM widget_loads
// WHERE timestamp > NOW() - INTERVAL '1 hour'
// GROUP BY engineType, widgetType
```

**Visual:** Heat map (widget type × engine type)
- **Target:** 100% success rate
- **Alert:** <95% success rate for any widget/engine combo

#### Exercise Switching Latency
```typescript
interface ExerciseSwitchMetric {
  timestamp: Date;
  engineType: 'legacy' | 'new';
  fromExerciseId: string;
  toExerciseId: string;
  switchTime: number; // milliseconds
  cleanupTime: number; // milliseconds
  loadTime: number; // milliseconds
  success: boolean;
}

// Query for dashboard:
// SELECT
//   engineType,
//   AVG(switchTime) as avg_switch_time,
//   PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY switchTime) as p95_switch_time
// FROM exercise_switches
// WHERE timestamp > NOW() - INTERVAL '1 hour' AND success = true
// GROUP BY engineType
```

**Visual:** Histogram comparing switch time distribution
- **Target:** P95 <500ms (baseline from REGRESSION_TEST_SUITE.md)
- **Alert:** P95 >1000ms (2x degradation)

---

## 2. Alert Configuration

### 2.1 Alert Severity Levels

#### 🔴 CRITICAL - Immediate Rollback Required

**Trigger Conditions:**

1. **Error Rate Spike**
   - New engine error rate >10% higher than legacy
   - Formula: `(new_errors / new_sessions) - (legacy_errors / legacy_sessions) > 0.10`
   - Evaluation period: 5-minute rolling window
   - Action: **IMMEDIATE ROLLBACK** + Page on-call engineer

2. **Memory Leak Detected**
   - Heap growth >100MB over 10 minutes
   - Formula: `(current_heap - heap_10min_ago) > 100`
   - Confidence threshold: R² > 0.8 (linear regression)
   - Action: **IMMEDIATE ROLLBACK** + Capture heap snapshot

3. **Crash Rate Spike**
   - Unhandled exception rate >1% of sessions
   - Formula: `(crash_count / session_count) > 0.01`
   - Evaluation period: 5-minute rolling window
   - Action: **IMMEDIATE ROLLBACK** + Capture stack traces

4. **Complete Service Failure**
   - Widget load success rate <50%
   - Zero successful playback starts in 5 minutes
   - Action: **IMMEDIATE ROLLBACK** + Emergency team page

**Alert Channels:**
- PagerDuty (or equivalent)
- Slack #engineering-alerts (with @channel)
- SMS to on-call engineer
- Email to tech leads

---

#### 🟡 WARNING - Investigation Required

**Trigger Conditions:**

1. **Elevated Error Rate**
   - New engine error rate 5-10% higher than legacy
   - Formula: `0.05 < (new_errors / new_sessions) - (legacy_errors / legacy_sessions) < 0.10`
   - Evaluation period: 15-minute rolling window
   - Action: Monitor for 30 minutes, escalate if worsens

2. **Moderate Memory Growth**
   - Heap growth 50-100MB over 10 minutes
   - Formula: `50 < (current_heap - heap_10min_ago) < 100`
   - Action: Increase memory sampling frequency, prepare rollback

3. **Timing Degradation**
   - Average jitter 3-5ms (vs <1ms baseline)
   - OR P95 jitter 5-10ms
   - Action: Investigate scheduling logic, check CPU usage

4. **Slow Initialization**
   - P95 initialization time 3-5 seconds (vs <3s baseline)
   - Action: Check sample preloading, network latency

**Alert Channels:**
- Slack #engineering-alerts (no @channel)
- Email to engineering team
- Dashboard notification banner

---

#### 🟢 INFO - For Awareness Only

**Trigger Conditions:**

1. **Performance Improvement**
   - New engine metrics 20% better than legacy
   - Action: Document in rollout report

2. **Rollout Milestone Reached**
   - 1%, 10%, 50%, 100% rollout thresholds
   - Action: Team notification, proceed to next phase

3. **Debugging Events**
   - `DEBUG_PLAYBACK_ENGINE_MIGRATION=true` logs
   - Action: Available for developer investigation

**Alert Channels:**
- Slack #engineering-updates
- Daily summary email

---

### 2.2 Alert Implementation

#### Using Existing Logging Infrastructure

```typescript
// apps/frontend/src/domains/playback/config/featureFlags.ts
// (Already implemented in Task 0.4)

export function logPlaybackEngineMigrationEvent(
  eventType: 'engine_selected' | 'error' | 'performance' | 'state_change',
  data: Record<string, unknown>
) {
  if (DEBUG_PLAYBACK_ENGINE_MIGRATION) {
    const event = {
      timestamp: new Date().toISOString(),
      eventType,
      engineType: isNewPlaybackEngineEnabled() ? 'new' : 'legacy',
      ...data,
    };

    // Send to logging service (e.g., Datadog, LogRocket, etc.)
    console.log('[PLAYBACK_ENGINE_MIGRATION]', event);

    // TODO: Send to real monitoring service
    // analytics.track('playback_engine_event', event);
  }
}
```

#### Alert Query Examples (SQL/Analytics)

```sql
-- CRITICAL: Error Rate Spike Detection
WITH engine_stats AS (
  SELECT
    engineType,
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN errorType IS NOT NULL THEN 1 END) as error_count
  FROM playback_sessions
  WHERE timestamp > NOW() - INTERVAL '5 minutes'
  GROUP BY engineType
)
SELECT
  (new.error_count::float / new.total_sessions) -
  (legacy.error_count::float / legacy.total_sessions) as error_rate_diff
FROM
  (SELECT * FROM engine_stats WHERE engineType = 'new') new,
  (SELECT * FROM engine_stats WHERE engineType = 'legacy') legacy
WHERE error_rate_diff > 0.10;

-- WARNING: Memory Growth Detection
WITH memory_trend AS (
  SELECT
    engineType,
    timestamp,
    heapUsed,
    LAG(heapUsed, 10) OVER (PARTITION BY engineType ORDER BY timestamp) as heap_10min_ago
  FROM memory_snapshots
  WHERE timestamp > NOW() - INTERVAL '15 minutes'
)
SELECT engineType, heapUsed - heap_10min_ago as growth_mb
FROM memory_trend
WHERE (heapUsed - heap_10min_ago) > 50
ORDER BY timestamp DESC
LIMIT 1;

-- Timing Jitter Degradation
SELECT
  engineType,
  AVG(jitter) as avg_jitter,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY jitter) as p95_jitter
FROM timing_measurements
WHERE timestamp > NOW() - INTERVAL '15 minutes'
GROUP BY engineType
HAVING AVG(jitter) > 3.0 OR PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY jitter) > 5.0;
```

---

## 3. Rollback Procedure

### 3.1 Emergency Rollback (<5 Minutes)

**When to Execute:**
- 🔴 CRITICAL alert triggered
- Engineering team consensus to rollback
- User-reported critical issues confirmed

**Step-by-Step Procedure:**

#### Step 1: Flip Feature Flag (1 minute)

**Option A: Vercel Environment Variables (Recommended)**

1. Navigate to Vercel Dashboard → Project Settings → Environment Variables
2. Find `NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE`
3. Change value from `true` to `false`
4. Click "Save"
5. Trigger redeployment (auto-triggers on env change)

**Option B: Emergency Rollback Flag**

```bash
# Set emergency rollback flag (overrides percentage rollout)
NEXT_PUBLIC_ROLLBACK_AUDIO=true
```

**Option C: Code-based Feature Flag Toggle**

```typescript
// apps/frontend/src/domains/playback/config/featureFlags.ts

// Emergency kill switch (deployed in advance)
export function isNewPlaybackEngineEnabled(): boolean {
  // Check emergency rollback flag first
  const emergencyRollback = process.env.NEXT_PUBLIC_ROLLBACK_AUDIO === 'true';
  if (emergencyRollback) {
    console.warn('[EMERGENCY ROLLBACK] New playback engine disabled');
    return false;
  }

  // ... rest of logic
}
```

#### Step 2: Verify Deployment (2 minutes)

```bash
# Check deployment status
curl https://bassnotion.app/_next/static/BUILD_ID
# Compare BUILD_ID to previous deployment

# Verify flag is disabled
curl https://bassnotion.app/api/health
# Should show "playbackEngine": "legacy"
```

**Manual Verification:**
1. Open production app in incognito window
2. Open DevTools → Console
3. Check for log: `[PLAYBACK_ENGINE] Using legacy engine (RegionProcessor)`
4. Test playback on HarmonyWidget
5. Verify no errors in console

#### Step 3: Monitor Metrics (2 minutes)

Watch dashboard for:
- Error rate drops back to baseline
- Memory stabilizes
- No new crashes reported

#### Step 4: Communication (Parallel to Steps 1-3)

**Slack Notification (Use Template Below):**
```
🔴 EMERGENCY ROLLBACK IN PROGRESS

Issue: [Error rate spike / Memory leak / Crash rate]
Trigger: [Specific metric that crossed threshold]
Action: Reverting to legacy playback engine
ETA: 5 minutes
Status: In progress

@engineering-team standby for updates
```

---

### 3.2 Planned Rollback (For Testing)

**Use Case:** Testing rollback procedures, simulating incidents

**Pre-Rollback Checklist:**
- [ ] Notify team 24 hours in advance
- [ ] Schedule during low-traffic period
- [ ] Capture baseline metrics before rollback
- [ ] Prepare monitoring dashboard
- [ ] Assign rollback operator and observer

**Procedure:**
1. Follow Steps 1-3 from Emergency Rollback
2. Document rollback time at each step
3. Verify <5 minute total time
4. Create rollback report

**Post-Rollback Debrief:**
- What went well?
- What could be faster?
- Any unexpected issues?
- Update runbook based on learnings

---

### 3.3 Partial Rollback (Reduce Rollout Percentage)

**When to Use:**
- 🟡 WARNING alerts (not critical yet)
- Want to reduce blast radius while investigating
- Gradually ramping down during incident

**Procedure:**

```typescript
// Instead of disabling completely, reduce rollout percentage

// Current: 50% of users on new engine
NEXT_PUBLIC_PLAYBACK_ENGINE_ROLLOUT_PERCENTAGE=50

// Reduce to: 10% of users
NEXT_PUBLIC_PLAYBACK_ENGINE_ROLLOUT_PERCENTAGE=10

// Redeploy
```

**Verification:**
```sql
-- Check distribution after 5 minutes
SELECT engineType, COUNT(*) as usage_count
FROM playback_sessions
WHERE timestamp > NOW() - INTERVAL '5 minutes'
GROUP BY engineType;

-- Expected: ~90% legacy, ~10% new
```

---

## 4. Incident Response Runbook

### 4.1 Symptom-Based Diagnosis

#### Symptom: High Error Rate

**Diagnosis Steps:**

1. **Check Error Types**
   ```sql
   SELECT errorType, errorMessage, COUNT(*) as count
   FROM playback_errors
   WHERE engineType = 'new' AND timestamp > NOW() - INTERVAL '10 minutes'
   GROUP BY errorType, errorMessage
   ORDER BY count DESC
   LIMIT 10;
   ```

2. **Common Error Patterns:**

   | Error Message | Root Cause | Fix |
   |--------------|------------|-----|
   | `getRegionProcessor is not a function` | Race condition (Bug #1) | Rollback, verify coreServicesReady logic |
   | `Cannot read property 'schedule' of undefined` | Scheduler not initialized | Check initialization sequence |
   | `AudioContext suspended` | User interaction required | Expected, not a bug |
   | `Failed to decode audio data` | Corrupt sample file | Check sample URLs, cache clear |
   | `WamKeyboard is null` | PluginManager not loaded | Verify plugin initialization order |

3. **Investigate Correlation ID**
   ```typescript
   // Find full trace for specific error
   const correlationId = "abc-123-def-456";
   grep correlationId logs/*.log
   ```

4. **Decision Matrix:**

   | Error Count | Severity | Action |
   |------------|----------|--------|
   | <10/hour | Low | Monitor, log to backlog |
   | 10-50/hour | Medium | Investigate, reduce rollout % |
   | 50-100/hour | High | Prepare rollback, notify team |
   | >100/hour | Critical | **IMMEDIATE ROLLBACK** |

---

#### Symptom: Memory Leak

**Diagnosis Steps:**

1. **Capture Heap Snapshot**
   ```typescript
   // In Chrome DevTools
   // 1. Memory tab → Take snapshot
   // 2. Play exercise 10 times
   // 3. Take another snapshot
   // 4. Compare snapshots
   ```

2. **Check Audio Source Cleanup**
   ```typescript
   // Add diagnostic logging
   logger.info('Active audio sources', {
     count: scheduledAudioSources.size,
     sources: Array.from(scheduledAudioSources.keys())
   });
   ```

3. **Verify Event Listener Cleanup**
   ```typescript
   // Check EventBus listener count
   console.log('EventBus listeners:', eventBus.getListenerCount());
   ```

4. **Common Leak Sources:**
   - AudioBufferSourceNode not disconnected (`onended` callback missing)
   - EventBus listeners not unsubscribed
   - Debounce timers not cleared
   - WindowRegistry not cleaning up instances

5. **Decision Matrix:**

   | Heap Growth | Timeframe | Action |
   |------------|-----------|--------|
   | <50MB | 10 minutes | Monitor, check cleanup logic |
   | 50-100MB | 10 minutes | **WARNING ALERT**, reduce rollout |
   | >100MB | 10 minutes | **CRITICAL ALERT**, immediate rollback |

---

#### Symptom: Timing Accuracy Issues

**Diagnosis Steps:**

1. **Measure Scheduling Jitter**
   ```typescript
   const expectedTime = context.currentTime + 1.0;
   const actualTime = /* recorded from source.onended */;
   const jitter = Math.abs(expectedTime - actualTime) * 1000; // ms
   logger.info('Scheduling jitter', { jitter, expectedTime, actualTime });
   ```

2. **Check CPU Usage**
   - High CPU (>80%) → May cause scheduling delays
   - Check browser Task Manager for playback tab

3. **Verify Tempo Debouncing**
   ```typescript
   // Should see ONLY ONE reschedule after tempo change
   logger.debug('Tempo change debounce', {
     oldTempo,
     newTempo,
     debounceTimerId,
     lastChangeTime
   });
   ```

4. **Common Causes:**
   - Main thread blocked (long synchronous tasks)
   - AudioContext clock drift
   - Tempo debouncing not working (multiple reschedules)
   - Sample buffer not loaded (causing delay)

5. **Decision Matrix:**

   | Avg Jitter | P95 Jitter | Action |
   |-----------|-----------|--------|
   | <1ms | <5ms | Normal (baseline) |
   | 1-3ms | 5-10ms | Monitor, check CPU usage |
   | 3-5ms | 10-20ms | **WARNING**, investigate |
   | >5ms | >20ms | **CRITICAL**, consider rollback |

---

#### Symptom: Widget Load Failures

**Diagnosis Steps:**

1. **Check Widget-Specific Errors**
   ```sql
   SELECT widgetType, errorMessage, COUNT(*) as count
   FROM widget_load_errors
   WHERE timestamp > NOW() - INTERVAL '10 minutes'
   GROUP BY widgetType, errorMessage
   ORDER BY count DESC;
   ```

2. **Test Widget Isolation**
   ```typescript
   // Disable all widgets except one
   // Test HarmonyWidget only
   // If works in isolation → integration issue
   // If fails in isolation → widget-specific bug
   ```

3. **Verify Sample Loading**
   ```typescript
   // Check GlobalSampleCache
   const cache = GlobalSampleCache.getInstance();
   console.log('Samples loaded:', cache.getAllLoadedSamples());
   ```

4. **Common Widget Issues:**

   | Widget | Common Error | Root Cause | Fix |
   |--------|-------------|------------|-----|
   | HarmonyWidget | `WamKeyboard is null` | PluginManager not loaded | Check Task 0.6 implementation |
   | DrumWidget | `Drum sample not found` | Missing sample in cache | Verify preload strategy |
   | MetronomeWidget | `Countdown config missing` | ConfigurationManager not inlined | Check PlaybackEngine config |
   | VoiceCueWidget | `Voice sample 404` | Incorrect Supabase URL | Check sample URL format |

---

### 4.2 Root Cause Analysis Template

**Use this template for post-incident review:**

```markdown
# Incident Report: [Brief Description]

**Date:** YYYY-MM-DD
**Duration:** [Start time - End time]
**Severity:** Critical / High / Medium / Low
**Impact:** [X users affected, Y% error rate]

## Timeline

- **HH:MM** - Alert triggered: [Alert name]
- **HH:MM** - Investigation started by [Engineer name]
- **HH:MM** - Root cause identified: [Brief description]
- **HH:MM** - Rollback initiated
- **HH:MM** - Rollback completed, metrics normalized

## Root Cause

[Detailed explanation of what went wrong]

## Resolution

[What was done to fix it]

## Prevention

[What will we do to prevent this in the future?]

## Action Items

- [ ] [Action item 1] - Owner: [Name] - Due: [Date]
- [ ] [Action item 2] - Owner: [Name] - Due: [Date]

## Lessons Learned

- [Lesson 1]
- [Lesson 2]
```

---

## 5. Communication Templates

### 5.1 Incident Notification (Critical)

**Slack Template:**

```
🔴 CRITICAL INCIDENT - Playback Engine

Issue: [One-sentence description]
Impact: [X% of users, specific widgets affected]
Status: Investigating / Rollback in progress / Resolved

Symptoms:
• [Symptom 1]
• [Symptom 2]

Next Steps:
• [Action 1] - ETA: [Time]
• [Action 2] - ETA: [Time]

Incident Commander: @[Engineer name]
Next Update: [Time]

@engineering-team
```

---

### 5.2 Rollback Announcement

**Slack Template:**

```
⚠️ PLAYBACK ENGINE ROLLBACK COMPLETED

Reason: [Error rate spike / Memory leak / etc.]
Rollback Time: [X minutes]
Current Status: Legacy engine restored, metrics stable

Metrics (Before → After Rollback):
• Error Rate: [15%] → [2%] ✅
• Memory: [200MB growth] → [Stable] ✅
• Widget Load Success: [80%] → [100%] ✅

Impact: All users now on legacy engine (stable)
Next Steps: RCA scheduled for [Date/Time]

Questions? Reply in thread.
```

---

### 5.3 User Notification (If Needed)

**In-App Banner Template:**

```
We recently identified a performance issue with our playback system
and have temporarily reverted to our stable version.

Your exercises and progress are safe.

We expect to resolve this within [timeframe].

Thank you for your patience!
```

**Email Template (For Major Outages Only):**

```
Subject: Brief Playback Issue Resolved

Hi [User Name],

We're writing to let you know about a brief issue that affected our
playback system today between [Start Time] and [End Time] UTC.

What Happened:
We rolled out a performance improvement that caused [specific issue]
for some users. We quickly identified and resolved the issue by
reverting to our stable system.

Impact:
You may have experienced [specific symptoms] during this time.
Your progress and exercises were not affected.

Resolution:
The issue is now fully resolved. All systems are operating normally.

We apologize for any inconvenience. If you have any questions or
continue to experience issues, please contact support@bassnotion.app.

- The BassNotion Team
```

---

### 5.4 Rollout Phase Update (Normal Operations)

**Slack Template:**

```
✅ Playback Engine Rollout - Phase [X] Complete

Rollout: [1% / 10% / 50% / 100%] of users
Duration: [X] days
Status: All metrics green ✅

Key Metrics:
• Error Rate: [0.5%] (Baseline: [0.4%]) ✓
• Memory: Stable, no leaks detected ✓
• Timing: Avg jitter [0.8ms] (Target: <1ms) ✓
• Performance: Init time [2.1s] (Target: <3s) ✓

Notable Wins:
• [Improvement 1]
• [Improvement 2]

Next Steps: Proceed to Phase [X+1] on [Date]

#playback-refactor
```

---

## 6. Team Training Checklist

### 6.1 Pre-Rollout Training Session

**Duration:** 1 hour
**Attendees:** All engineering team, QA, DevOps
**Conducted by:** Lead Engineer

**Agenda:**

#### Part 1: Architecture Overview (15 minutes)
- [ ] Review state consolidation (3 layers)
- [ ] Explain feature flag logic
- [ ] Demo dual-engine coexistence
- [ ] Show PlaybackEngine API vs RegionProcessor API

#### Part 2: Monitoring Dashboard (15 minutes)
- [ ] Live demo of monitoring dashboard
- [ ] Explain each metric and threshold
- [ ] Show how to read error rate comparison
- [ ] Demo memory leak detection algorithm
- [ ] Show alert configuration

#### Part 3: Rollback Procedure (20 minutes)
- [ ] Walk through emergency rollback steps
- [ ] Demo feature flag flip (Vercel dashboard)
- [ ] Show deployment verification
- [ ] Practice communication templates
- [ ] **HANDS-ON:** Each engineer performs a test rollback

#### Part 4: Incident Response (10 minutes)
- [ ] Review symptom-based diagnosis flowchart
- [ ] Explain correlation ID tracing
- [ ] Demo heap snapshot capture
- [ ] Review escalation path

**Hands-On Exercise:**

Each engineer must complete:
1. Access monitoring dashboard
2. Flip feature flag in Vercel (staging environment)
3. Verify deployment
4. Post rollback notification in #engineering-alerts (test channel)
5. Capture heap snapshot in Chrome DevTools

**Sign-Off:**

Each team member confirms:
- [ ] I can access the monitoring dashboard
- [ ] I can flip the feature flag
- [ ] I know when to trigger a rollback
- [ ] I know who to notify during an incident
- [ ] I have tested the rollback procedure

---

### 6.2 On-Call Rotation Setup

**Rollout Phase 1-2 (Weeks 5-6):**
- Primary on-call: Lead Engineer (who implemented refactor)
- Secondary: Senior Engineer (familiar with legacy system)
- Escalation: CTO / Engineering Manager

**Rollout Phase 3-4 (Weeks 7-8):**
- Rotate primary on-call across team
- Always have someone familiar with both engines

**On-Call Responsibilities:**
- Monitor dashboard during rollout
- Respond to alerts within 5 minutes
- Execute rollback if necessary
- Document incidents
- Conduct post-incident reviews

**On-Call Handoff Checklist:**
```markdown
## On-Call Handoff - [Date]

Outgoing: [Engineer Name]
Incoming: [Engineer Name]

### Current Status
- Rollout Phase: [X]
- Rollout Percentage: [Y%]
- Last 24h Metrics: [All green / Issues noted below]

### Active Issues
- [Issue 1] - Status: [Monitoring / Investigating]
- [Issue 2] - Status: [Resolved / Ongoing]

### Upcoming Events
- [Phase transition on Date]
- [Scheduled maintenance]

### Notes
- [Any context needed]

Handoff confirmed at: [Time]
```

---

## 7. Post-Incident Review Process

### 7.1 Incident Review Meeting

**When to Schedule:**
- Within 24-48 hours of incident resolution
- REQUIRED for all Critical/High severity incidents
- Optional for Medium/Low severity

**Attendees:**
- Incident Commander
- Engineers involved in resolution
- QA Lead
- Engineering Manager
- Product Manager (if user-facing impact)

**Agenda (1 hour):**

1. **Timeline Review (10 min):** Walk through incident timeline
2. **Root Cause Analysis (20 min):** What actually happened?
3. **Detection & Response (10 min):** How did we find it? How fast did we respond?
4. **Impact Assessment (10 min):** Who was affected? How badly?
5. **Action Items (10 min):** What will we do differently?

**Blameless Culture:**
- Focus on SYSTEMS, not individuals
- Ask "How did the system allow this?" not "Who caused this?"
- Celebrate good incident response

---

### 7.2 Incident Severity Classification

| Severity | User Impact | Response Time | Rollback Required | Example |
|----------|------------|---------------|-------------------|---------|
| **Critical** | >10% users, complete feature failure | <5 minutes | Yes, immediate | All playback broken, 100% error rate |
| **High** | 5-10% users, significant degradation | <15 minutes | Likely | Memory leak causing crashes |
| **Medium** | 1-5% users, minor degradation | <1 hour | Case-by-case | Elevated jitter for some widgets |
| **Low** | <1% users, edge cases | <24 hours | No | Rare error on specific exercise type |

---

### 7.3 Action Item Tracking

**After each incident, create GitHub issues for:**

1. **Immediate Fixes** (Deploy within 1 week)
   - Fix the specific bug that caused the incident
   - Add regression test to prevent recurrence
   - Priority: High

2. **Monitoring Improvements** (Deploy within 2 weeks)
   - Add new alert for this failure mode
   - Improve dashboard visibility
   - Priority: Medium

3. **Long-Term Prevention** (Schedule for next sprint)
   - Architectural changes to prevent entire class of issues
   - Improved testing/staging processes
   - Priority: Medium-Low

**Template:**

```markdown
## Incident Follow-Up: [Issue Title]

**Related Incident:** [Link to incident report]
**Type:** Immediate Fix / Monitoring / Long-Term
**Priority:** High / Medium / Low

### Description
[What needs to be done]

### Why This Helps
[How this prevents future incidents]

### Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

### Testing
[How to verify this works]
```

---

## 8. Testing the Rollback

### 8.1 Pre-Rollout Rollback Drill

**When:** 1 day before Phase 1 rollout (Week 5)
**Environment:** Staging
**Duration:** 30 minutes

**Drill Procedure:**

#### Step 1: Simulate Incident (5 min)
```typescript
// Inject fake error to trigger alert
logPlaybackEngineMigrationEvent('error', {
  errorType: 'simulation',
  errorMessage: 'Rollback drill - ignore',
  count: 1000 // Trigger CRITICAL threshold
});
```

#### Step 2: Execute Rollback (5 min)
- On-call engineer flips feature flag
- Verify deployment
- Check metrics normalize

#### Step 3: Verify Communication (5 min)
- Post rollback notification in Slack
- Verify team receives alert
- Practice incident commander role

#### Step 4: Measure & Debrief (15 min)
- Record actual rollback time
- Identify any friction points
- Update runbook if needed

**Success Criteria:**
- [ ] Rollback completed in <5 minutes
- [ ] All team members notified
- [ ] Metrics returned to baseline
- [ ] Communication templates used correctly

---

### 8.2 Rollback Verification Checklist

**Use this checklist EVERY TIME you perform a rollback (drill or real):**

#### Pre-Rollback
- [ ] Monitoring dashboard accessible
- [ ] Baseline metrics captured
- [ ] Team notified (if real incident)
- [ ] Rollback operator + observer assigned

#### During Rollback
- [ ] Start timer ⏱️
- [ ] Flip feature flag (Vercel env var)
- [ ] Trigger redeployment
- [ ] Watch deployment progress
- [ ] Verify new BUILD_ID

#### Post-Rollback
- [ ] Test playback manually (3 widgets minimum)
- [ ] Check console for "legacy engine" log
- [ ] Verify error rate drops
- [ ] Verify memory stabilizes
- [ ] Stop timer ⏱️ (Record total time)

#### Communication
- [ ] Post rollback complete notification
- [ ] Update incident ticket status
- [ ] Schedule RCA meeting (if real incident)

#### Documentation
- [ ] Record rollback time: _____ minutes
- [ ] Note any issues encountered
- [ ] Update runbook if procedure changed

---

### 8.3 Rollback Confidence Scoring

**After each rollback (drill or real), score your confidence:**

| Aspect | Score (1-5) | Notes |
|--------|-------------|-------|
| **Speed:** Did we complete in <5 min? | ___/5 | Actual time: ___ min |
| **Communication:** Was team properly notified? | ___/5 | |
| **Verification:** Did we confirm rollback success? | ___/5 | |
| **Monitoring:** Were metrics visible throughout? | ___/5 | |
| **Team Readiness:** Did everyone know their role? | ___/5 | |
| **TOTAL CONFIDENCE** | ___/25 | |

**Scoring Guide:**
- **20-25:** Ready for production rollout
- **15-19:** Needs improvement, but acceptable
- **10-14:** Not ready, repeat drill
- **<10:** Major gaps, revise procedures

---

## Appendix A: Monitoring Query Library

### Query 1: Real-Time Error Rate Comparison

```sql
-- Compare error rates between engines over last hour
WITH hourly_stats AS (
  SELECT
    engineType,
    COUNT(*) as total_events,
    COUNT(CASE WHEN eventType = 'error' THEN 1 END) as error_count,
    (COUNT(CASE WHEN eventType = 'error' THEN 1 END)::float / COUNT(*)) as error_rate
  FROM playback_events
  WHERE timestamp > NOW() - INTERVAL '1 hour'
  GROUP BY engineType
)
SELECT
  engineType,
  total_events,
  error_count,
  ROUND(error_rate * 100, 2) as error_rate_percent
FROM hourly_stats
ORDER BY engineType;
```

### Query 2: Memory Leak Detection (10-minute window)

```sql
-- Detect memory growth over 10-minute periods
WITH memory_windows AS (
  SELECT
    engineType,
    timestamp,
    heapUsed,
    LAG(heapUsed, 10) OVER (PARTITION BY engineType ORDER BY timestamp) as heap_10min_ago,
    (heapUsed - LAG(heapUsed, 10) OVER (PARTITION BY engineType ORDER BY timestamp)) as growth_mb
  FROM memory_snapshots
  WHERE timestamp > NOW() - INTERVAL '30 minutes'
)
SELECT
  engineType,
  MAX(growth_mb) as max_growth_mb,
  AVG(growth_mb) as avg_growth_mb
FROM memory_windows
WHERE heap_10min_ago IS NOT NULL
GROUP BY engineType;
```

### Query 3: Widget Load Success Rate by Type

```sql
-- Widget load success rates over last hour
SELECT
  engineType,
  widgetType,
  COUNT(*) as total_loads,
  COUNT(CASE WHEN success = true THEN 1 END) as successful_loads,
  ROUND((COUNT(CASE WHEN success = true THEN 1 END)::float / COUNT(*)) * 100, 2) as success_rate_percent
FROM widget_load_events
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY engineType, widgetType
ORDER BY engineType, success_rate_percent ASC;
```

### Query 4: Timing Jitter Analysis

```sql
-- Timing accuracy metrics over last hour
SELECT
  engineType,
  instrumentType,
  COUNT(*) as measurement_count,
  ROUND(AVG(jitter), 2) as avg_jitter_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY jitter), 2) as p95_jitter_ms,
  ROUND(MAX(jitter), 2) as max_jitter_ms
FROM timing_measurements
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY engineType, instrumentType
ORDER BY avg_jitter_ms DESC;
```

### Query 5: Rollout Percentage Verification

```sql
-- Verify actual rollout percentage matches target
SELECT
  engineType,
  COUNT(*) as session_count,
  ROUND((COUNT(*)::float / SUM(COUNT(*)) OVER ()) * 100, 2) as actual_percentage
FROM playback_sessions
WHERE timestamp > NOW() - INTERVAL '5 minutes'
GROUP BY engineType
ORDER BY engineType;
```

---

## Appendix B: Dashboard Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🎵 Playback Engine Monitoring Dashboard              [Last 1 hour] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ 🟢 SYSTEM STATUS: HEALTHY                                          │
│ Rollout Phase: Phase 2 (10% of users)                              │
│ Legacy Engine: 90% | New Engine: 10%                               │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ ERROR RATE COMPARISON                                               │
│                                                                     │
│ Legacy: ▁▁▂▁▁▂▁▁▁▁ (0.4% avg)  New: ▁▁▂▂▁▂▁▁▂▁ (0.6% avg)          │
│                                                                     │
│ Status: ✅ Within threshold (diff: +0.2%, limit: <10%)             │
├─────────────────────────────────────────────────────────────────────┤
│ MEMORY USAGE                                                        │
│                                                                     │
│ Legacy: 45MB ▂▃▃▂▃▂▃▂ (stable)  New: 48MB ▂▃▄▃▂▃▂▃ (stable)        │
│                                                                     │
│ Growth Rate: +2MB/10min (threshold: <100MB/10min) ✅               │
├─────────────────────────────────────────────────────────────────────┤
│ TIMING ACCURACY (Jitter)                                            │
│                                                                     │
│ Avg: 0.8ms | P95: 4.2ms | Max: 8.1ms                               │
│ Status: ✅ Within baseline (<1ms avg, <5ms P95)                    │
├─────────────────────────────────────────────────────────────────────┤
│ WIDGET LOAD SUCCESS                                                 │
│                                                                     │
│ Harmony: 100% | Drums: 100% | Metronome: 100% | VoiceCue: 100%     │
│ Status: ✅ All widgets operational                                 │
├─────────────────────────────────────────────────────────────────────┤
│ ACTIVE ALERTS                                                       │
│                                                                     │
│ 🟢 No active alerts                                                │
│                                                                     │
│ [View Alert History] [Test Alert] [Dashboard Settings]             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Summary Checklist

**Before Rollout (Task 0.5 Completion):**
- [x] Monitoring dashboard designed with 8 key metrics
- [x] Alert thresholds configured (Critical, Warning, Info)
- [x] Rollback procedure documented (<5 minute target)
- [x] Incident response runbook created (symptom-based)
- [x] Communication templates prepared (5 templates)
- [x] Team training checklist defined
- [x] Rollback drill procedure created
- [x] Query library for monitoring (5 essential queries)

**Ready for Phase 1 Rollout When:**
- [ ] Team training session completed (all engineers sign-off)
- [ ] Rollback drill executed successfully (<5 minutes)
- [ ] Monitoring dashboard accessible to all team members
- [ ] Alerts configured in production monitoring tool
- [ ] On-call rotation scheduled for Weeks 5-8
- [ ] Communication channels tested (Slack, PagerDuty, email)
- [ ] Emergency contact list verified

---

**Task 0.5 Status:** ✅ **COMPLETE**
**Deliverable:** This document (ROLLBACK_PROCEDURE.md)
**Next Task:** Task 0.6 - PluginManager/WAM Integration Analysis

---

**Document Version:** 1.0
**Last Updated:** 2025-11-23
**Author:** Lead Engineer
**Reviewers:** Engineering Team, DevOps, QA Lead
