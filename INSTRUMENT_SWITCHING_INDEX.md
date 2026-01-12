# Instrument Switching & Sample Loading - Complete File Index

## Documents Created

This search has created 4 comprehensive documents for instrument switching bug investigation:

### 1. INSTRUMENT_SWITCHING_QUICK_REFERENCE.md (268 lines)
**Best for:** Quick lookup and console debugging
- File locations (absolute paths)
- Bug flow diagram
- Instrument characteristics comparison table
- Critical line numbers in HarmonySchedulerV2.ts
- Console debugging commands
- Debugging checklist
- Testing commands
- Key methods to trace

**Start here if:** You need quick answers and want to get to debugging fast

### 2. INSTRUMENT_SWITCHING_FILES.md (230 lines)
**Best for:** Understanding the architecture
- Detailed file descriptions with responsibilities
- Method signatures and key features
- Code patterns and lifecycle flows
- Cache key patterns
- Configuration file structures
- Bug investigation focus areas
- Complete file organization

**Start here if:** You want comprehensive understanding of the system

### 3. INSTRUMENT_BUG_SUMMARY.md (248 lines)
**Best for:** Focused bug investigation
- Problem statement
- Root cause hypotheses (4 areas)
- Step-by-step investigation procedures
- Console checks with code examples
- Diagnostic outputs to watch for
- Test case for reproduction
- Hypothesis testing matrix

**Start here if:** You're ready to debug and need investigation procedures

### 4. This File - INSTRUMENT_SWITCHING_INDEX.md
**Best for:** Navigation between documents
- Overview of all 4 guides
- Quick navigation table
- Suggested reading order
- Key questions answered

## Quick Navigation

| Question | Answer | Document |
|----------|--------|----------|
| Where is the bug? | HarmonySchedulerV2.ts line 200-205 | QUICK_REFERENCE or BUG_SUMMARY |
| What files do I need? | See file list below | INSTRUMENT_SWITCHING_FILES |
| How do I debug? | Follow steps in Section 2 | BUG_SUMMARY |
| What are the cache keys? | See line 189+ | QUICK_REFERENCE |
| How do instruments differ? | See characteristics table | QUICK_REFERENCE |
| What tests exist? | See test file list | INSTRUMENT_SWITCHING_FILES |
| What should I check first? | stopAll() execution | BUG_SUMMARY Step 1 |

## Critical Files Summary

### Instrument Switching Logic (Primary Bug Location)
```
apps/frontend/src/domains/playback/services/core/scheduling/HarmonySchedulerV2.ts
  - setBuffers() at line 188-243
  - stopAll() at line 586-700
  - BUG POINT: Line 200-205
```

### Sample Cache (Potential Issue)
```
apps/frontend/src/domains/playback/modules/storage/cache/GlobalSampleCache.ts
  - Cache key pattern: {instrument}-{layer}-{note}
  - Check if keys properly namespaced
```

### Instrument Samplers (Tone.js Disposal)
```
GrandPianoVelocitySampler.ts
  - 7 velocity layers, sparse sampling
  - Check if dispose() is called

WurlitzerVelocitySampler.ts
  - 5 velocity layers, full chromatic
  - Check if dispose() is called

RhodesVelocitySampler.ts
  - 4 velocity layers, full chromatic
```

### Tests (Understanding Expected Behavior)
```
InstrumentSwitching.test.ts (unit tests)
  - Cache key separation tests
  - Velocity layer separation tests
  - Octave shift separation tests

InstrumentSwitching.integration.test.ts (integration tests)
  - Full switching flow
  - Sample buffer loading
```

## Investigation Flow

```
1. Read BUG_SUMMARY.md sections 1-2
   ↓
2. Add diagnostics from BUG_SUMMARY Step 1
   ↓
3. Reproduce bug with console open
   ↓
4. Check console outputs against expected (BUG_SUMMARY)
   ↓
5. If stopAll() not called → QUICK_REFERENCE line 200-205
   ↓
6. If stopAll() incomplete → BUG_SUMMARY Step 2-4
   ↓
7. If cache issue → INSTRUMENT_SWITCHING_FILES cache section
   ↓
8. If Tone.js issue → BUG_SUMMARY Step 4
   ↓
9. If EQ issue → BUG_SUMMARY Step 4
```

## Key Code Locations

```
Line Numbers in HarmonySchedulerV2.ts:
  193-197:  Instrument change detection
  200-205:  stopAll() call ← PRIMARY BUG POINT
  209:      Update harmonyBuffers
  211:      Update currentHarmonyInstrument
  218:      Configure velocity selector
  224:      Load Grand Piano keyboard map
  246-288:  Setup EQ for Grand Piano
  531:      Track active sources
  586-700:  stopAll() implementation ← SECONDARY BUG POINT
  703-704:  Clear maps
```

## Instrument Characteristics Quick Reference

| Aspect | Grand Piano | Wurlitzer | Rhodes |
|--------|-------------|-----------|--------|
| Layers | 7 | 5 | 4 |
| Sampling | Sparse (25 notes) | Full (88 notes) | Full (88 notes) |
| Cache Key | `grandpiano-{layer}-{note}` | `wurlitzer-{layer}-{note}` | `rhodes-{layer}-{note}` |
| Octave Shift | 0 | -12 semitones | -12 semitones |
| EQ | Yes | No | No |

## Testing & Verification

```bash
# Unit tests
pnpm vitest run apps/frontend/src/domains/playback/services/core/scheduling/__tests__/InstrumentSwitching.test.ts

# Integration tests
pnpm vitest run apps/frontend/src/domains/playback/services/core/scheduling/__tests__/InstrumentSwitching.integration.test.ts

# Full domain
pnpm test:frontend:playback

# Manual testing
# 1. Open tutorial with Grand Piano
# 2. Play notes (hear Grand Piano)
# 3. Switch to Wurlitzer exercise
# 4. Check console for debug outputs
```

## Recommended Reading Order

### For Quick Understanding (15 minutes)
1. This index (you are here)
2. QUICK_REFERENCE.md - File Locations section
3. QUICK_REFERENCE.md - Critical Line Numbers section
4. QUICK_REFERENCE.md - Instrument Characteristics

### For Bug Investigation (30 minutes)
1. This index
2. BUG_SUMMARY.md - Problem Statement
3. BUG_SUMMARY.md - Root Cause Hypothesis section 1-2
4. BUG_SUMMARY.md - Investigation Steps
5. QUICK_REFERENCE.md - Console Debugging section

### For Deep Understanding (60 minutes)
1. INSTRUMENT_SWITCHING_FILES.md - Overview
2. INSTRUMENT_SWITCHING_FILES.md - HarmonySchedulerV2 section
3. INSTRUMENT_SWITCHING_FILES.md - GlobalSampleCache section
4. QUICK_REFERENCE.md - stopAll() Method Behavior
5. BUG_SUMMARY.md - Full document
6. INSTRUMENT_SWITCHING_FILES.md - remaining sections

## Common Tasks

### Task: Add Diagnostic Logging
→ See BUG_SUMMARY.md "Investigation Steps (In Order)"

### Task: Check Cache Separation
→ See QUICK_REFERENCE.md "Console Debugging" section

### Task: Understand Velocity Layers
→ See QUICK_REFERENCE.md "Velocity Layer Ranges" section

### Task: Find a Specific File
→ See INSTRUMENT_SWITCHING_FILES.md or QUICK_REFERENCE.md "File Locations"

### Task: Run Tests
→ See QUICK_REFERENCE.md "Testing Commands" section

### Task: Trace a Method
→ See QUICK_REFERENCE.md "Key Methods to Trace" section

## Bug Severity & Impact

**Severity:** HIGH
- User hears double instruments (two pianos effect)
- Affects all instrument switches on tutorial pages
- Confusing audio output

**Scope:** Limited
- Only affects harmony instrument switching
- Drums/bass unaffected (have separate schedulers)
- Only visible when switching exercises with different instruments

**User Impact:** CRITICAL
- Cannot complete tutorials with multiple instruments properly
- Poor user experience

## Success Criteria

Bug is FIXED when:
```
1. Switch from Grand Piano to Wurlitzer
2. Old Grand Piano sound stops immediately (50ms fadeout)
3. Only Wurlitzer samples heard
4. No "two pianos" effect
5. No clicks or pops during switch
6. Tests pass (see Testing & Verification section)
```

## Support Resources

- CLAUDE.md in project root (project guidelines)
- /docs/ directory (technical documentation)
- /memory-bank/ directory (project context)

## Document Statistics

```
INSTRUMENT_SWITCHING_QUICK_REFERENCE.md:   268 lines
INSTRUMENT_SWITCHING_FILES.md:              230 lines
INSTRUMENT_BUG_SUMMARY.md:                  248 lines
INSTRUMENT_SWITCHING_INDEX.md:              ~280 lines
─────────────────────────────────────────────────────
TOTAL:                                      ~1000 lines
```

All files are in the project root directory and use Markdown format for easy reading and searching.

---

**Start with:** INSTRUMENT_SWITCHING_QUICK_REFERENCE.md
**Then read:** BUG_SUMMARY.md
**Reference:** INSTRUMENT_SWITCHING_FILES.md as needed

