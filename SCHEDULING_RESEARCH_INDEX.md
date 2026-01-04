# Audio Scheduling Research - Complete Index

## Overview

This research package contains a complete analysis of how BassNotion's audio scheduling system works, including frame-based timing calculations, visual vs audio timing differences, and why 3% accuracy is not an appropriate target.

## Documents Included

### 1. **SCHEDULING_SUMMARY.txt** (START HERE)
**Type:** Executive summary  
**Length:** ~500 lines  
**Best for:** Getting the big picture quickly

**Contents:**
- How scheduling works (3 key layers)
- Frame-based timing explanation
- Visual vs audio timing comparison
- Does 3% accuracy make sense? (Answer: NO)
- Look-ahead window explanation (150ms)
- Key timing measurements and configurations
- Recommended targets (not 3%)

**Start with this if:** You have 10-15 minutes and want the essentials

---

### 2. **AUDIO_SCHEDULING_ANALYSIS.md**
**Type:** Deep technical analysis  
**Length:** ~800 lines  
**Best for:** Understanding the complete system in detail

**Contents:**
- Scheduling architecture overview
- Configuration layer (transportTiming.ts)
- Event collection pipeline (RegionScheduler)
- Look-ahead mechanism (how it works)
- Visual vs audio timing (the real difference)
- Frame-based scheduling calculations
- Timing drift compensation (Kalman filtering)
- Position update strategies (polling/event-driven)
- Diagnostic tool and accuracy measurement
- Real-world timing behavior
- Recommendation: better accuracy targets

**Start with this if:** You want comprehensive technical understanding

---

### 3. **SCHEDULING_TIMING_FLOW.md**
**Type:** Visual explanations with diagrams  
**Length:** ~700 lines  
**Best for:** Visual learners and understanding the flow

**Contents:**
- Event scheduling timeline with ASCII diagrams
- Frame calculations (48kHz sample rate)
- targetFrame vs scheduleFrame with examples
- Cross-instrument timing measurement
- Scheduler update cycle (20ms polling)
- Visual vs audio timing (with diagrams)
- Tempo change and beat tracking
- Look-ahead safety margins
- Diagnostic tool usage
- Complete event journey diagram

**Start with this if:** You prefer visual explanations and examples

---

### 4. **SCHEDULING_CODE_REFERENCE.md**
**Type:** Code location and reference guide  
**Length:** ~600 lines  
**Best for:** Developers implementing or debugging

**Contents:**
- File locations for all key components
- Code excerpts with line numbers
- Key method signatures
- Calculation formulas quick reference
- Time conversion formulas
- Look-ahead window calculations
- Tempo-aware position tracking
- Debug commands for browser console
- Key metrics and targets table
- Testing commands (vitest)
- Complete code execution flow

**Start with this if:** You need to find specific code or debug issues

---

### 5. **SCHEDULING_DIAGRAMS.txt**
**Type:** ASCII diagrams and visual representations  
**Length:** ~400 lines  
**Best for:** Understanding timing relationships visually

**Contents:**
1. Look-ahead scheduling window
2. Event timing calculation (MIDI ticks → scheduled time)
3. Frame-based timing (48kHz conversions)
4. Visual vs audio timing (side-by-side comparison)
5. Cross-instrument timing measurement
6. Tempo change compensation
7. Drift detection & correction
8. Scheduling layers (complete view)
9. Polling vs event-driven strategies
10. Timeline: complete event journey

**Start with this if:** You're a visual learner

---

### 6. **SCHEDULING_RESEARCH_INDEX.md** (this file)
**Type:** Navigation guide  
**Best for:** Navigating the research package

**Contents:**
- Overview of all documents
- Quick navigation by question
- Quick navigation by role/expertise
- Key findings summary
- File locations for reference

---

## Quick Navigation by Question

### Q: How does the scheduling system work?
**Read:** SCHEDULING_SUMMARY.txt (section 1-2)  
**Then:** AUDIO_SCHEDULING_ANALYSIS.md (section 2-3)  
**Diagrams:** SCHEDULING_DIAGRAMS.txt (sections 1-2)

### Q: What are targetFrame and scheduleFrame?
**Read:** SCHEDULING_SUMMARY.txt (section 2)  
**Then:** SCHEDULING_TIMING_FLOW.md (section 2-3)  
**Code:** SCHEDULING_CODE_REFERENCE.md (section 5)  
**Diagrams:** SCHEDULING_DIAGRAMS.txt (section 3)

### Q: How is visual timing different from audio timing?
**Read:** SCHEDULING_SUMMARY.txt (section 3)  
**Then:** AUDIO_SCHEDULING_ANALYSIS.md (section 4)  
**Diagrams:** SCHEDULING_DIAGRAMS.txt (section 4)  
**Code:** SCHEDULING_CODE_REFERENCE.md (section 9)

### Q: Does 3% accuracy make sense?
**Read:** SCHEDULING_SUMMARY.txt (section 4)  
**Then:** AUDIO_SCHEDULING_ANALYSIS.md (section "Does 3% Accuracy Make Sense?")  
**Recommendation:** Appendix in AUDIO_SCHEDULING_ANALYSIS.md

### Q: What's the look-ahead window and why 150ms?
**Read:** SCHEDULING_SUMMARY.txt (section 5)  
**Then:** AUDIO_SCHEDULING_ANALYSIS.md (section 5)  
**Diagrams:** SCHEDULING_DIAGRAMS.txt (section 1)  
**Code:** SCHEDULING_CODE_REFERENCE.md (sections 1-2)

### Q: How do I debug timing issues?
**Read:** SCHEDULING_CODE_REFERENCE.md (sections 10-11)  
**Diagrams:** SCHEDULING_DIAGRAMS.txt (section 8)  
**Code:** SCHEDULING_CODE_REFERENCE.md (section 8)

### Q: Where's the actual code?
**Read:** SCHEDULING_CODE_REFERENCE.md (all sections)

---

## Quick Navigation by Role

### Product Manager / Designer
1. Read: SCHEDULING_SUMMARY.txt (10 min)
2. Read: AUDIO_SCHEDULING_ANALYSIS.md - "Does 3% Accuracy Make Sense?" (5 min)
3. Recommendation: Use absolute timing targets, not percentages

### Audio Engineer / Music Expert
1. Read: AUDIO_SCHEDULING_ANALYSIS.md (30 min)
2. Study: SCHEDULING_TIMING_FLOW.md diagrams (15 min)
3. Reference: SCHEDULING_CODE_REFERENCE.md sections 1-5

### Frontend Developer
1. Read: SCHEDULING_CODE_REFERENCE.md (20 min)
2. Read: SCHEDULING_TIMING_FLOW.md (15 min)
3. Debug: Use commands in SCHEDULING_CODE_REFERENCE.md section 8

### Backend Developer
1. Read: AUDIO_SCHEDULING_ANALYSIS.md sections 1-3 (15 min)
2. Reference: SCHEDULING_CODE_REFERENCE.md sections 1-7
3. Study: Event calculation flow in SCHEDULING_DIAGRAMS.txt sections 2-3

### QA / Tester
1. Read: SCHEDULING_CODE_REFERENCE.md section 8 (Debug Commands)
2. Study: SCHEDULING_DIAGRAMS.txt section 10 (Event Journey)
3. Reference: SCHEDULING_TIMING_FLOW.md section 8 (Diagnostic Tool)

---

## Key Findings Summary

### 1. Scheduling Architecture
- **Look-ahead based:** 150ms advance scheduling
- **Multi-layer:** Collection → Batching → Execution → Visual feedback
- **Professional standard:** Matches DAW practices (Pro Tools, Ableton)

### 2. Frame-Based Timing
- **Sample rate:** 48kHz (standard for audio)
- **Frame duration:** 20.83 microseconds
- **Look-ahead frames:** 7,200 frames = 150ms
- **Measurement:** `lookaheadMs = (targetFrame - scheduleFrame) / 48`

### 3. Visual vs Audio
- **Audio:** Scheduled 150ms ahead, sample-accurate (< 1ms)
- **Visual:** Updated at 60fps (16.67ms intervals), ±5-10ms sync
- **Different systems:** Don't confuse them!

### 4. Accuracy Targets
- **NOT 3%:** Too variable with tempo, not professional standard
- **Audio:** Sample-accurate (< 1ms)
- **Cross-instrument:** < 5ms (measured)
- **Visual sync:** ±5-10ms
- **Look-ahead:** 150ms for stability

### 5. Current Performance
- **Cross-instrument sync:** < 5ms (excellent)
- **Audio jitter:** < 1ms (sample-accurate)
- **Professional quality:** Matching DAW standards
- **Safety margin:** 150ms prevents missed deadlines

---

## File Locations for Code Reference

### Core Scheduling Files
- **Configuration:** `/apps/frontend/src/domains/playback/config/transportTiming.ts`
- **Orchestrator:** `/apps/frontend/src/domains/playback/services/core/region-processing/scheduling-orchestrator/RegionScheduler.ts`
- **Scheduler:** `/apps/frontend/src/domains/playback/modules/transport/core/Scheduler.ts`
- **Clock:** `/apps/frontend/src/domains/playback/modules/transport/core/Clock.ts`

### Timing Components
- **Sample Accurate Clock:** `/apps/frontend/src/domains/playback/modules/transport/sync/SampleAccurateClock.ts`
- **Drift Predictor:** `/apps/frontend/src/domains/playback/modules/transport/sync/DriftPredictor.ts`
- **Polling Strategy:** `/apps/frontend/src/domains/playback/modules/transport/scheduling/strategies/PollingStrategy.ts`

### Visual/Diagnostic
- **Audio-Visual Sync:** `/apps/frontend/src/domains/widgets/services/AudioVisualSync.ts`
- **Timing Diagnostic:** `/apps/frontend/src/domains/playback/services/core/diagnostics/InstrumentTimingDiagnostic.ts`

---

## Key Metrics At A Glance

| Metric | Value | Source | Notes |
|--------|-------|--------|-------|
| Look-ahead time | 150ms | transportTiming.ts:32 | Professional DAW standard |
| Update interval | 20ms | transportTiming.ts:39 | 50Hz polling rate |
| Sample rate | 48kHz | SampleAccurateClock | Standard for audio |
| Cross-instrument sync | < 5ms | InstrumentTimingDiagnostic | Actual measurements |
| Audio jitter | < 1ms | AudioWorklet | Sample-accurate |
| Visual sync target | ±5ms | AudioVisualSync | Animation frame based |
| Drift threshold | 1ms | DriftPredictor | Significant drift = > 1ms |
| Visual frame rate | 60fps | transportTiming.ts:63 | 16.67ms per frame |

---

## Browser Console Commands

### Enable Timing Diagnostics
```javascript
window.__timingDiagnostic.enable();
// Play exercise for 30+ seconds
window.__timingDiagnostic.report();
```

### Set Log Level
```javascript
window.logger.setLevel(window.LogLevel.DEBUG);
```

### Check Audio Context
```javascript
Tone.Transport.seconds        // Current position
Tone.Transport.bpm.value      // Current BPM
Tone.context.currentTime      // AudioContext time
Tone.context.lookAhead        // Scheduler look-ahead
Tone.context.updateInterval   // Update rate
```

---

## Testing Commands

### Run Scheduling Tests
```bash
pnpm vitest run apps/frontend/src/domains/playback/modules/transport/core/__tests__/Scheduler.test.ts
```

### Run Drift Prediction Tests
```bash
pnpm vitest run apps/frontend/src/domains/playback/modules/transport/sync/__tests__/DriftPredictor.test.ts
```

### Run Position Update Tests
```bash
pnpm vitest run apps/frontend/src/domains/playback/modules/transport/scheduling/__tests__/PositionUpdateScheduler.test.ts
```

---

## Recommended Reading Order

### For Comprehensive Understanding (Total Time: ~60 minutes)
1. **SCHEDULING_SUMMARY.txt** (10 min) - Big picture
2. **SCHEDULING_DIAGRAMS.txt** (15 min) - Visual understanding
3. **AUDIO_SCHEDULING_ANALYSIS.md** (25 min) - Deep dive
4. **SCHEDULING_CODE_REFERENCE.md** (10 min) - Code details

### For Quick Overview (Total Time: ~20 minutes)
1. **SCHEDULING_SUMMARY.txt** (10 min)
2. **SCHEDULING_TIMING_FLOW.md** sections 1, 3 (5 min)
3. **SCHEDULING_DIAGRAMS.txt** sections 1, 3 (5 min)

### For Debugging (Total Time: ~15 minutes)
1. **SCHEDULING_CODE_REFERENCE.md** section 8 (5 min)
2. **SCHEDULING_TIMING_FLOW.md** section 8 (5 min)
3. Open browser console, run commands (5 min)

---

## Version Information

- **Research Date:** December 2024
- **System Version:** BassNotion feature/drum-pattern-editor branch
- **Audio Library:** Tone.js (latest)
- **Sample Rate:** 48kHz
- **Look-ahead:** 150ms (professional standard)

---

## Next Steps

### If You Found 3% Accuracy Target
1. Replace with absolute timing targets (see recommendations)
2. Update acceptance criteria
3. Add diagnostic measurements to CI/CD pipeline
4. Monitor cross-instrument sync in production

### If You're Implementing Audio Features
1. Use look-ahead window pattern (150ms)
2. Implement with InstrumentTimingDiagnostic measurements
3. Follow batching strategy (events at same time together)
4. Test with browser diagnostic tool

### If You're Debugging Timing Issues
1. Enable diagnostic tool: `window.__timingDiagnostic.enable()`
2. Play exercise, collect data
3. Review report: look for deltas > 5ms
4. Check cross-instrument sync: should be < 5ms
5. Review scheduler logs: look for missed events

---

## Questions Answered

✓ How does targetFrame/scheduleFrame calculate timing?  
✓ What's the look-ahead window and why 150ms?  
✓ How do visual and audio timing differ?  
✓ Does 3% accuracy make sense? (Answer: NO)  
✓ What are the recommended targets?  
✓ How do you measure timing accuracy?  
✓ Where's the actual code?  
✓ How do you debug timing issues?  

---

## Contact / References

All code references are absolute paths in:
```
/Users/marekcaba/Documents/Projekty 2024/🟣 BassNotion/4. Cursor Project Folder/bassnotion-monorepo-v1/
```

Key files documented in SCHEDULING_CODE_REFERENCE.md

---

**Last Updated:** December 28, 2024  
**Research Status:** Complete  
**Recommendations:** Implement absolute timing targets, not 3% accuracy
