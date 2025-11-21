# QA Testing Guide: Story 4.3 - MIDI-to-Fretboard Conversion

## Overview

This guide provides step-by-step instructions for testing the complete MIDI-to-Fretboard Multi-Anchor Conversion System.

**Story**: [Story 4.3 - MIDI-to-Fretboard Multi-Anchor Conversion System](./stories/story-4.3-midi-to-fretboard-conversion.md)

**Implementation Status**: ✅ Complete (Backend + Frontend)
**Test Coverage**: ✅ 18/18 Backend Tests Passing

---

## Prerequisites

### 1. Environment Setup

Ensure both servers are running:

```bash
pm2 status

# Should show:
# bassnotion-backend  - online (port 3000)
# bassnotion-frontend - online (port 3001)
```

If not running:

```bash
pm2 restart all
```

### 2. Admin Access

You need an admin account to access the exercise creation features.

- **Frontend URL**: `http://localhost:3001`
- **Login**: Navigate to `/login`
- **Admin Panel**: Navigate to `/admin/tutorials` after login

### 3. Test MIDI File

Prepare a simple bass MIDI file for testing:
- Single instrument (bass guitar)
- 4-8 measures
- Standard 4/4 time signature
- BPM: 80-120
- Format: `.mid` or `.midi`

**Recommended Test File**: Any simple bassline MIDI from a DAW or MIDI library.

---

## Test Flow Overview

```
1. Create New Exercise
   ↓
2. Upload MIDI File (basslineMidiUrl populated)
   ↓
3. Save Exercise (get exercise ID)
   ↓
4. Click "Convert MIDI to Fretboard Positions"
   ↓
5. WIZARD OPENS
   ├─ Step 1: Parse MIDI (auto-executes)
   ├─ Step 2: Set Anchor Positions
   ├─ Step 3: Review Generated Notes
   └─ Step 4: Confirm & Save
   ↓
6. Verify exercise.notes[] is populated
   ↓
7. Verify 3D fretboard visualization displays correctly
```

---

## Detailed Test Steps

### Test 1: Create Exercise and Upload MIDI

**Objective**: Verify MIDI file upload and exercise creation workflow.

**Steps**:

1. Navigate to `http://localhost:3001/admin/tutorials`
2. Select any tutorial from the list
3. Click "Add New Exercise" button
4. Fill in exercise details:
   - **Title**: "Test MIDI Conversion"
   - **Description**: "Testing automatic fretboard position generation"
   - **Difficulty**: "intermediate"
   - **BPM**: "100"
   - **Time Signature**: "4/4"
5. Locate the MIDI upload section for "Bass Widget"
6. Upload your test MIDI file
7. Verify upload success (basslineMidiUrl field should be populated)
8. Click "Save" to create the exercise

**Expected Results**:
- ✅ Exercise created successfully
- ✅ MIDI file uploaded to Supabase storage
- ✅ Exercise ID generated
- ✅ "Convert MIDI to Fretboard Positions" button appears

**Failure Cases**:
- ❌ Upload fails → Check Supabase storage bucket permissions
- ❌ Button doesn't appear → Check that `basslineMidiUrl` field is populated and exercise has valid ID

---

### Test 2: Parse MIDI File

**Objective**: Verify MIDI parsing extracts measures and notes correctly.

**Steps**:

1. From the exercise created in Test 1, click "Edit"
2. Click "Convert MIDI to Fretboard Positions" button
3. Wizard modal should open
4. **Step 1: Parse MIDI** should auto-execute

**Expected Results**:
- ✅ Loading spinner appears
- ✅ Parsing completes within 2-5 seconds
- ✅ Summary shows:
  - Total Measures: (number based on your MIDI)
  - Total Notes: (number based on your MIDI)
  - BPM: Detected from MIDI
  - Time Signature: Detected from MIDI
- ✅ "Next" button becomes enabled

**API Endpoint Tested**: `POST /api/v1/exercises/:id/midi/parse`

**Check Backend Logs**:
```bash
pm2 logs bassnotion-backend --lines 50
```

Look for:
```
[AdminExercisesController] Parsing MIDI file
[MidiParserService] Successfully parsed MIDI
```

**Failure Cases**:
- ❌ Parse fails with 404 → MIDI file URL is invalid
- ❌ Parse fails with 400 → MIDI file is corrupted or invalid format
- ❌ Parse timeout → MIDI file too large (>5MB)

---

### Test 3: Set Anchor Positions

**Objective**: Verify anchor selection interface for each measure.

**Steps**:

1. After parsing completes, click "Next"
2. **Step 2: Set Anchor Positions** appears
3. You should see a grid of mini-fretboards (one per measure)
4. For **Measure 1**:
   - Click on the E string (bottom), fret 0 (open)
   - Mini-fretboard should highlight the selected position
5. For **Measure 2**:
   - Click on the E string, fret 3
6. Continue setting anchors for all measures
7. Observe the progress indicator:
   - Should show "X/Y measures complete"
   - Percentage should update (e.g., "50% complete")

**Expected Results**:
- ✅ Each mini-fretboard is interactive and clickable
- ✅ Selected positions are visually highlighted (blue dot)
- ✅ Progress indicator updates correctly
- ✅ "Next" button disabled until ALL measures have anchors
- ✅ "Next" button enabled when all anchors set

**UI Elements to Verify**:
- Mini-fretboard dimensions: 12 frets × 4 strings
- Fret markers visible (dots at 3, 5, 7, 9, 12)
- String labels: E, A, D, G
- Selected position shows note name (e.g., "E1")

**Failure Cases**:
- ❌ Clicks not registering → Check click handler in `MiniFretboard.tsx`
- ❌ Progress not updating → Check `useAnchorSelection` hook

---

### Test 4: Convert MIDI to Fretboard

**Objective**: Verify conversion algorithm generates optimal fretboard positions.

**Steps**:

1. After all anchors are set, click "Next"
2. Loading spinner should appear with text "Converting MIDI to fretboard positions..."
3. Conversion should complete within 3-10 seconds (depends on number of notes)
4. **Step 3: Review Generated Notes** appears

**Expected Results**:
- ✅ Conversion completes successfully
- ✅ Notes table populated with all notes
- ✅ Each note has:
  - Measure number
  - Time (timestamp in seconds)
  - String (1-4)
  - Fret (0-24)
  - Note name (e.g., "E1", "A1")
  - Confidence badge (High/Medium/Low)
  - Alternative positions (if applicable)

**API Endpoint Tested**: `POST /api/v1/exercises/:id/midi/convert`

**Check Backend Logs**:
```bash
pm2 logs bassnotion-backend --lines 50
```

Look for:
```
[AdminExercisesController] Converting MIDI to fretboard
[FretboardMapperService] Successfully converted MIDI
```

**Failure Cases**:
- ❌ Conversion fails → Check anchors array is valid
- ❌ No notes generated → Check MIDI has valid bass notes (pitch 28-48)
- ❌ Algorithm timeout → MIDI has too many notes (>1000)

---

### Test 5: Review and Refine Notes

**Objective**: Verify note editor features and playability metrics.

**Steps**:

1. In the notes table, examine the generated positions
2. **Test Filtering**:
   - Click "Low Confidence" filter → should show only notes with low confidence
   - Click "With Warnings" filter → should show only notes with warnings
   - Click "All Notes" → should show all notes again
3. **Test Search**:
   - Enter a measure number in search box (e.g., "2")
   - Should filter to notes in that measure only
4. **Test Confidence Badges**:
   - High confidence: Green badge
   - Medium confidence: Yellow badge
   - Low confidence: Red badge
5. **Test Alternatives**:
   - Find a note with alternatives (look for dropdown icon)
   - Click dropdown to view alternative positions
   - Each alternative should show: String, Fret, Score, Reason
6. **Test Warnings**:
   - Find a note with warnings (red warning badge)
   - Hover or click to see warning details
   - Common warnings:
     - "Large stretch" (fret span > 5)
     - "Difficult shift" (hand position change)
     - "String crossing"
7. **Review Playability Metrics**:
   - Overall Score: 0-100 (higher is better)
   - Hand Stability: Percentage
   - High Confidence: Percentage
   - Large Stretches: Count
   - Difficult Shifts: Count
   - String Crossings: Count

**Expected Results**:
- ✅ All filters work correctly
- ✅ Search narrows results
- ✅ Confidence badges match expected values
- ✅ Alternatives dropdown shows valid positions
- ✅ Warnings are relevant and clear
- ✅ Playability score makes sense (simple bassline = high score)

**Manual Verification**:
- Pick a few notes and verify they make musical sense
- Check that consecutive notes minimize hand movement
- Verify anchored first notes match your selections from Step 2

---

### Test 6: Confirm and Save

**Objective**: Verify generated notes are saved to exercise.

**Steps**:

1. After reviewing notes, click "Next"
2. **Step 4: Confirm & Save** appears
3. Review the summary:
   - Total notes generated
   - Playability score
   - Any warnings/issues
4. Click "Complete" button
5. Modal should close
6. Exercise form should now show populated `exercise.notes` array

**Expected Results**:
- ✅ Modal closes smoothly
- ✅ Exercise form shows notes field populated
- ✅ Note count matches generated count
- ✅ Each note has: id, timestamp, string, fret, duration, note, color

**Data Verification**:
Check that each generated note was mapped correctly:
```typescript
{
  id: string;           // Unique ID
  timestamp: number;    // Time in seconds
  string: number;       // 1-4
  fret: number;         // 0-24
  duration: number;     // Note duration
  note: string;         // "E1", "A1", etc.
  color: string;        // "#3b82f6" (blue)
  techniques: string[]; // From warnings
}
```

---

### Test 7: Verify 3D Fretboard Visualization

**Objective**: Verify notes display correctly in the 3D fretboard widget.

**Steps**:

1. Save the exercise (if not already saved)
2. Navigate to the tutorial page that contains this exercise
3. Locate the YouTube Widget Page for this tutorial
4. Find the "Bassline Widget" or "Fretboard Card"
5. Select the exercise from the exercise selector
6. Play the exercise

**Expected Results**:
- ✅ 3D fretboard loads successfully
- ✅ Notes appear as colored dots on correct strings and frets
- ✅ Notes light up in sequence during playback
- ✅ Timing matches the original MIDI
- ✅ Hand position guidance appears (shows optimal finger placement)

**Playback Verification**:
- Notes should trigger at correct timestamps
- Visual feedback should match audio
- Fretboard camera should follow hand position

**Failure Cases**:
- ❌ Notes don't appear → Check `exercise.notes` array in DB
- ❌ Wrong positions → Re-run conversion with better anchors
- ❌ Timing off → Check timestamp calculation in conversion

---

## Advanced Testing Scenarios

### Test 8: Multi-String Bass Support

**Objective**: Verify 5-string and 6-string bass support.

**Steps**:

1. Create new exercise with 5-string bass MIDI file
2. During wizard Step 2, use bass type selector (if available)
3. Select "5-String Bass"
4. Set anchors (now you have B string available)
5. Complete conversion

**Expected Results**:
- ✅ 5-string tuning: B0, E1, A1, D2, G2
- ✅ Mini-fretboards show 5 strings
- ✅ Notes can be placed on B string

Repeat for 6-string bass (adds high C string).

---

### Test 9: Edge Cases

#### Empty Measure
1. Upload MIDI with one empty measure (no notes)
2. Verify conversion skips empty measure
3. Notes array should not have entries for that measure

#### Polyphonic MIDI (Multiple Notes at Same Time)
1. Upload MIDI with chords or double-stops
2. Verify parser handles multiple notes at same timestamp
3. Conversion should generate positions for each note

#### Very Fast Bassline
1. Upload MIDI with 16th notes at 180 BPM
2. Verify conversion doesn't create impossible stretches
3. Check playability score is lower (reflects difficulty)

#### Large MIDI File
1. Upload MIDI with 50+ measures
2. Verify parsing doesn't timeout
3. Anchor selection should handle scrolling/pagination

---

## Error Handling Tests

### Test 10: Missing MIDI File

**Steps**:
1. Create exercise without uploading MIDI
2. Verify "Convert MIDI" button does NOT appear

**Expected**: Button hidden if no `basslineMidiUrl`

---

### Test 11: Corrupted MIDI File

**Steps**:
1. Upload a corrupted or non-MIDI file
2. Click "Convert MIDI"
3. Parsing should fail gracefully

**Expected**:
- ✅ Error message appears
- ✅ User can close wizard and retry
- ✅ No crash or blank screen

---

### Test 12: Network Failure

**Steps**:
1. Start wizard
2. Stop backend server: `pm2 stop bassnotion-backend`
3. Try to parse or convert

**Expected**:
- ✅ Error message: "Failed to connect to server"
- ✅ Retry option available
- ✅ No data loss (unsaved anchors preserved)

---

## Performance Benchmarks

### Parsing Performance

| MIDI File Size | Expected Parse Time |
|----------------|---------------------|
| 1-10 measures  | < 1 second          |
| 10-30 measures | 1-3 seconds         |
| 30-60 measures | 3-5 seconds         |
| 60+ measures   | 5-10 seconds        |

### Conversion Performance

| Note Count | Expected Conversion Time |
|------------|--------------------------|
| 1-50 notes | < 1 second               |
| 50-200 notes | 1-3 seconds            |
| 200-500 notes | 3-5 seconds           |
| 500+ notes | 5-10 seconds             |

**Note**: Times may vary based on system performance.

---

## Logging and Debugging

### Backend Logs

**View real-time logs**:
```bash
pm2 logs bassnotion-backend --lines 100
```

**Search for MIDI operations**:
```bash
pm2 logs bassnotion-backend --lines 500 --nostream | grep -i "midi"
```

**Look for errors**:
```bash
pm2 logs bassnotion-backend --lines 500 --nostream | grep -i "error\|fail"
```

### Frontend Logs

**Browser Console**: `F12` → Console tab

**Look for correlation IDs**:
- Every API call has a correlation ID
- Use it to trace requests across frontend/backend

**Example**:
```
[useMidiParsing] Parsing MIDI file { exerciseId: "123", correlationId: "abc-def-456" }
[apiClient] POST /api/v1/exercises/123/midi/parse
```

---

## Known Issues and Workarounds

### Issue 1: MIDI Parser Timeout
**Symptom**: Large MIDI files (>1000 notes) timeout during parsing
**Workaround**: Split MIDI into smaller sections

### Issue 2: Anchor Reset
**Symptom**: Anchors reset when going back to Step 2
**Workaround**: Set all anchors in one pass, don't navigate back

### Issue 3: High Confidence Score Mismatch
**Symptom**: Note marked "high confidence" but looks awkward
**Reason**: Algorithm prioritizes minimal hand movement, may not match human intuition
**Workaround**: Use alternatives dropdown to select better position

---

## Test Completion Checklist

Use this checklist to track your testing progress:

- [ ] Test 1: Create Exercise and Upload MIDI
- [ ] Test 2: Parse MIDI File
- [ ] Test 3: Set Anchor Positions
- [ ] Test 4: Convert MIDI to Fretboard
- [ ] Test 5: Review and Refine Notes
- [ ] Test 6: Confirm and Save
- [ ] Test 7: Verify 3D Fretboard Visualization
- [ ] Test 8: Multi-String Bass Support
- [ ] Test 9: Edge Cases
  - [ ] Empty Measure
  - [ ] Polyphonic MIDI
  - [ ] Very Fast Bassline
  - [ ] Large MIDI File
- [ ] Test 10: Missing MIDI File
- [ ] Test 11: Corrupted MIDI File
- [ ] Test 12: Network Failure

---

## Success Criteria

The implementation is considered successful if:

1. ✅ All 18 backend unit tests pass
2. ✅ Wizard completes end-to-end without errors
3. ✅ Generated positions are musically playable
4. ✅ Playability score reflects actual difficulty
5. ✅ 3D fretboard visualization displays correctly
6. ✅ Performance meets benchmarks
7. ✅ Error handling works for all edge cases

---

## Reporting Issues

If you encounter any bugs during testing:

1. Note the **correlation ID** from logs
2. Copy the **error message** (backend + frontend)
3. Include **steps to reproduce**
4. Attach the **test MIDI file** (if relevant)
5. Include **screenshot** of error state

**Report to**: Create an issue in the project repo or notify the development team.

---

## Next Steps After QA

Once testing is complete and all issues are resolved:

1. Mark Story 4.3 as **"PRODUCTION READY ✅"**
2. Update progress to **100%**
3. Deploy to staging environment
4. Conduct user acceptance testing (UAT) with real users
5. Document any user feedback or feature requests
6. Plan optional enhancements (frontend tests, keyboard nav, etc.)

---

**Last Updated**: 2025-10-20
**Story Status**: Implementation Complete, Ready for QA
**Backend Tests**: 18/18 Passing ✅
**Frontend**: Complete ✅
