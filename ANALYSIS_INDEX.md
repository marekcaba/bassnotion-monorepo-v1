# CurrentTime Flow Analysis - Complete Index

This is a comprehensive analysis of how `currentTime` flows from the transport through to both `useMeasureOpacity` (measure-based opacity/highlighting) and `nextNoteToPlay` (yellow ring indicator), identifying a critical discrepancy.

## Quick Summary

**Problem**: The **yellow ring (nextNoteToPlay)** does NOT have the FIRST-BEAT FIX v3 that was applied to **measure-based highlighting**, causing them to potentially show different measures at playback start.

**Severity**: Medium - Every play action, ~10-20% of the time (worse without countdown)

**Solution**: Apply the same fix to `nextNoteToPlay` that's already in `useMeasureOpacity`

---

## Documents in Order of Reading

### 1. CURRENTTIME_FLOW_SUMMARY.md ← START HERE
**Length**: ~15 min read | **Level**: Executive Summary

A one-page executive summary covering:
- The problem in one sentence
- Quick facts table
- Root causes (3 main issues)
- Where the code is
- How to verify the bug
- Solutions ranked by priority
- Testing plan

**Read this first to understand what's wrong.**

---

### 2. CURRENTTIME_FLOW_ANALYSIS.md
**Length**: ~30 min read | **Level**: Technical Deep Dive

The complete technical analysis covering:
- The complete flow from entry point to output
- Stage 1: Time Interpolation (useAnimationTime)
- Stage 2: First-Beat Fix v3 (rawCurrentTime)
- Flow divergence (Path A vs Path B)
- Countdown time handling inconsistency
- All time sources explained
- Summary table of discrepancies
- Root causes with examples
- Recommended fixes (3 options)
- Testing verification steps
- Affected files list

**Read this to understand the full picture.**

---

### 3. CURRENTTIME_FLOW_DIAGRAM.md
**Length**: ~20 min read | **Level**: Visual Reference

Visual diagrams and detailed examples covering:
- The two paths flowchart (Measure Opacity vs Yellow Ring)
- Time value examples over time (with specific numbers)
- The bug scenario (when fix works but yellow ring doesn't)
- The reset condition bug (detailed timeline)
- Dependency graph (what depends on what)
- Summary table comparing both paths

**Read this if you're a visual learner.**

---

### 4. VERIFICATION_CHECKLIST.md
**Length**: ~15 min read | **Level**: Practical Guide

Step-by-step checklist to verify if the bug exists:
- Quick check procedure (3 steps)
- Three key symptoms to look for
- Code-level verification (4 checks)
- Time flow verification (3 test cases)
- Detailed timing verification techniques
- Two-system check (is the fix applied?)
- Fix priority ranking
- Sign-off checklist

**Use this to confirm the issues exist in your environment.**

---

### 5. CODE_LOCATIONS_REFERENCE.md
**Length**: ~25 min read | **Level**: Reference Manual

Complete reference of all relevant code:
- Primary files (4 files):
  - useFretboardExercise.ts (with all line numbers)
  - useMeasureOpacity.ts (with all line numbers)
  - FretboardGrid.tsx (with all line numbers)
  - FretboardCard.tsx (with all line numbers)
- Time variable mapping
- Dependencies and data flow
- Key constants and thresholds
- Debug logging points
- How to enable debug mode
- Summary table

**Use this as a reference while coding.**

---

## Quick Navigation by Question

### "What's the problem?"
→ CURRENTTIME_FLOW_SUMMARY.md (first 2 sections)

### "How do I prove it exists?"
→ VERIFICATION_CHECKLIST.md (Quick Check section)

### "Where exactly is the bug in the code?"
→ CODE_LOCATIONS_REFERENCE.md (Primary Files section)

### "How should I fix it?"
→ CURRENTTIME_FLOW_SUMMARY.md (Solutions section)

### "I want the full technical details"
→ CURRENTTIME_FLOW_ANALYSIS.md (all sections)

### "Show me a visual diagram"
→ CURRENTTIME_FLOW_DIAGRAM.md (all sections)

### "How do I test my fix?"
→ CURRENTTIME_FLOW_SUMMARY.md (Testing Plan) + VERIFICATION_CHECKLIST.md

---

## Key Findings Summary

### The Issue
- `useMeasureOpacity` has FIRST-BEAT FIX v3 (lines 144-170)
- `nextNoteToPlay` does NOT have the fix
- Both receive `exerciseTime` from same source
- But they have separate state machines that can drift

### Why It Matters
- Yellow ring jumps to wrong note on playback start
- Discrepancy: dots show measure 1 (green), ring on measure 2-3 (orange)
- Visual jerk/snap as ring catches up after ~100ms
- Affects every play action, worse in certain scenarios

### The Fix
- Add same FIRST-BEAT FIX pattern to `nextNoteToPlay`
- Fix broken reset condition in `useMeasureOpacity`
- Consider extracting to shared hook for consistency

### Effort & Risk
- Priority 1 Fix: ~20 lines, ~30 minutes, low risk
- Priority 2 Fix: ~5-10 lines, ~15 minutes, low risk
- Total: ~30 lines of code, ~45 minutes to implement+test

---

## File Organization

All analysis documents are in the repository root:

```
bassnotion-monorepo-v1/
├── ANALYSIS_INDEX.md                    ← You are here
├── CURRENTTIME_FLOW_SUMMARY.md          ← Start here
├── CURRENTTIME_FLOW_ANALYSIS.md         ← Full technical details
├── CURRENTTIME_FLOW_DIAGRAM.md          ← Visual diagrams
├── VERIFICATION_CHECKLIST.md            ← How to verify
├── CODE_LOCATIONS_REFERENCE.md          ← Code reference
│
├── apps/
│   └── frontend/src/domains/
│       └── widgets/components/YouTubeWidgetPage/FretboardCard/
│           ├── FretboardCard.tsx
│           ├── hooks/
│           │   ├── useFretboardExercise.ts      ← Main hook
│           │   └── useMeasureOpacity.ts         ← Measure opacity hook
│           └── components/
│               └── FretboardGrid.tsx             ← Yellow ring rendering
```

---

## Symbols Used

- ✅ = Working correctly or present
- ❌ = Missing or broken
- ⚠️ = Issue/warning/potential problem
- 🎯 = FIRST-BEAT FIX marker
- 🤯 = Symptom/noticeable effect

---

## How to Use These Documents

### For Quick Understanding (15 minutes)
1. Read CURRENTTIME_FLOW_SUMMARY.md
2. Skim the tables and code locations in CODE_LOCATIONS_REFERENCE.md

### For Implementation (45 minutes)
1. Read CURRENTTIME_FLOW_SUMMARY.md (Solutions section)
2. Check CODE_LOCATIONS_REFERENCE.md for exact line numbers
3. Use CURRENTTIME_FLOW_ANALYSIS.md (Recommended Fixes section) for code examples

### For Verification (20 minutes)
1. Read VERIFICATION_CHECKLIST.md
2. Enable debug logging: `window.__DEBUG_FRETBOARD__ = true`
3. Run through the test cases

### For Deep Understanding (90 minutes)
1. Read all documents in order
2. Review actual code files with line numbers
3. Trace through the data flow yourself
4. Run verification tests

---

## Related Issues in Codebase

These documents address issues with:
- `useMeasureOpacity` reset condition (line 167 - wrong variable)
- `nextNoteToPlay` missing FIRST-BEAT FIX (lines 856-1023)
- Inconsistent time sources between two systems
- Heavy re-computation in nextNoteToPlay (every RAF frame)

These might also relate to:
- Fretboard ring visual glitches at playback start
- Measure indicator misalignment with ring
- Ring appearing on wrong note initially
- Yellow ring delay at exercise start

---

## Next Actions

### Immediate (Confirm Issue)
- [ ] Read CURRENTTIME_FLOW_SUMMARY.md
- [ ] Follow VERIFICATION_CHECKLIST.md quick check procedure
- [ ] Enable `window.__DEBUG_FRETBOARD__ = true` and observe logs

### Short-term (Plan Fix)
- [ ] Read CURRENTTIME_FLOW_ANALYSIS.md (Recommended Fixes section)
- [ ] Reference CODE_LOCATIONS_REFERENCE.md for exact locations
- [ ] Plan which priority fix to implement first

### Medium-term (Implement)
- [ ] Implement Priority 1 fix (add FIRST-BEAT FIX to nextNoteToPlay)
- [ ] Implement Priority 2 fix (fix reset condition)
- [ ] Run tests from VERIFICATION_CHECKLIST.md
- [ ] Manual testing with visual inspection

### Long-term (Optimize)
- [ ] Consider Priority 3 (shared hook)
- [ ] Consider Priority 4 (optimization)
- [ ] Add to development documentation

---

## Contact & Questions

If you have questions about this analysis:
- Check the relevant document (see Quick Navigation above)
- Review CODE_LOCATIONS_REFERENCE.md for specific line numbers
- Re-read the diagram that matches your scenario
- Run the verification checklist to confirm behavior

---

## Version Info

- **Analysis Date**: 2025-12-28
- **Project**: BassNotion Monorepo v1
- **Branch**: feature/drum-pattern-editor
- **Scope**: Fretboard Exercise Feature (EPIC 3 Widget Synchronization)

---

**Start with CURRENTTIME_FLOW_SUMMARY.md for a quick overview, or jump to a specific document using the Quick Navigation section above.**
