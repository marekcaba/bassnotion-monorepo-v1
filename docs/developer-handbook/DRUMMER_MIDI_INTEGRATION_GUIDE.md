# Drummer MIDI Conversion System - Integration Guide

## What We've Built ✅

### 1. Backend (Complete)

- ✅ **Database**: `drum_pattern` JSONB column in exercises table
- ✅ **DrumMapperService**: Converts MIDI → Structured drum hits
- ✅ **API Endpoint**: `POST /api/v1/midi/convert-drums`
- ✅ **Types**: DrumHit, DrumType, stats, validation

### 2. Frontend (Complete)

- ✅ **Shared Types**: `@bassnotion/contracts` exports DrumHit, DrumType, etc.
- ✅ **DrumPatternEditor**: Modal for reviewing/editing converted drum pattern
- ✅ **Colors & Display Names**: Visual drum representation

## What's Left - Integration Steps

### Step 1: Add State to ExerciseFormModal

**File**: `apps/frontend/src/domains/admin/components/ExerciseFormModal.tsx`

**Add after line 47** (after existing state):

```typescript
// Drum pattern state (similar to bass notes)
const [drumPattern, setDrumPattern] = useState<DrumHit[]>([]);
const [drumPatternStats, setDrumPatternStats] =
  useState<DrumPatternStats | null>(null);
const [drumPatternValidation, setDrumPatternValidation] =
  useState<DrumPatternValidation | null>(null);
const [showDrumEditor, setShowDrumEditor] = useState(false);
const [isConvertingDrums, setIsConvertingDrums] = useState(false);
```

### Step 2: Add Drum Conversion Function

**Add after line 271** (after `uploadMidiFile` function):

```typescript
/**
 * Convert drummer MIDI to drum pattern
 * Called automatically after drummer MIDI upload
 */
const convertDrummerMidi = async (drummerMidiUrl: string) => {
  try {
    setIsConvertingDrums(true);
    logger.info('Converting drummer MIDI to drum pattern', {
      drummerMidiUrl,
      correlationId,
    });

    // Get auth session for backend API call
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('You must be logged in');
    }

    // Call drum conversion endpoint
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/midi/convert-drums`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          'X-Correlation-ID': correlationId,
        },
        credentials: 'include',
        body: JSON.stringify({
          exerciseId: exercise?.id || 'new',
          drummerMidiUrl,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: 'Conversion failed' }));
      throw new Error(errorData.message || 'Failed to convert drum MIDI');
    }

    const result = await response.json();

    logger.info('Drummer MIDI converted successfully', {
      totalHits: result.stats.totalHits,
      unknownCount: result.stats.unknownCount,
      correlationId,
    });

    // Store converted drum pattern
    setDrumPattern(result.drumPattern);
    setDrumPatternStats(result.stats);
    setDrumPatternValidation(result.validation);

    // Show editor for review
    setShowDrumEditor(true);
  } catch (error) {
    console.error('Drum conversion error:', error);
    logger.error('Failed to convert drummer MIDI', error as Error, {
      correlationId,
    });
    setErrors((prev) => ({
      ...prev,
      drummer: `Failed to convert drum MIDI: ${(error as Error).message}`,
    }));
  } finally {
    setIsConvertingDrums(false);
  }
};
```

### Step 3: Trigger Conversion After Upload

**Modify the `uploadMidiFile` function** (around line 258):

**Before:**

```typescript
return temporaryUrl;
```

**After:**

```typescript
// Auto-trigger drum conversion for drummer MIDI
if (type === 'drummer' && temporaryUrl) {
  await convertDrummerMidi(temporaryUrl);
}

return temporaryUrl;
```

### Step 4: Save Drum Pattern on Submit

**Modify `handleSubmit`** (around line 320):

**Add drum_pattern to the exercise data:**

```typescript
const exerciseData = {
  // ... existing fields
  ...midiUrls,
  ...uploadedUrls,
  // Add converted drum pattern
  drum_pattern: drumPattern, // ← NEW
  // Add temp MIDI paths for backend migration
  temp_bassline_midi_path: tempMidiPaths.bassline,
  temp_drummer_midi_path: tempMidiPaths.drummer,
  // ...
};
```

### Step 5: Add DrumPatternEditor to Render

**Add before the closing `</Dialog>`** (around line 900):

```tsx
{
  /* Drum Pattern Editor Modal */
}
{
  showDrumEditor && drumPatternStats && drumPatternValidation && (
    <DrumPatternEditor
      isOpen={showDrumEditor}
      onClose={() => setShowDrumEditor(false)}
      drumPattern={drumPattern}
      stats={drumPatternStats}
      validation={drumPatternValidation}
      onSave={(updatedPattern) => {
        setDrumPattern(updatedPattern);
        setShowDrumEditor(false);
      }}
    />
  );
}
```

### Step 6: Add Import Statements

**Add to the top of ExerciseFormModal.tsx:**

```typescript
import { DrumPatternEditor } from './DrumPatternEditor';
import type {
  DrumHit,
  DrumPatternStats,
  DrumPatternValidation,
} from '@bassnotion/contracts';
```

### Step 7: Add Visual Indicator

**In the drummer MIDI upload section** (around line 641), add a status indicator:

```tsx
{
  isConvertingDrums && (
    <div className="text-sm text-blue-600 flex items-center gap-2">
      <Wand2 className="h-4 w-4 animate-spin" />
      Converting drum MIDI...
    </div>
  );
}

{
  drumPattern.length > 0 && !isConvertingDrums && (
    <div className="text-sm text-green-600 flex items-center gap-2">
      <CheckCircle2 className="h-4 w-4" />
      {drumPattern.length} drum hits converted
      <Button variant="link" size="sm" onClick={() => setShowDrumEditor(true)}>
        Review Pattern
      </Button>
    </div>
  );
}
```

## Testing Workflow

1. **Upload Drummer MIDI**
   - Select a MIDI file in admin exercise editor
   - File uploads to temp storage
   - Auto-converts to drum pattern
   - DrumPatternEditor modal opens

2. **Review & Edit**
   - Admin reviews auto-converted drum hits
   - Adjusts drum assignments if needed (e.g., "unknown" → "kick")
   - Clicks "Save Drum Pattern"

3. **Save Exercise**
   - Click "Save" in exercise form
   - Both `drummer_midi_url` AND `drum_pattern` saved to database

4. **Playback**
   - Frontend loads pre-converted `drum_pattern` (fast)
   - Falls back to MIDI URL if needed

## File Checklist

- ✅ `libs/contracts/src/types/drum-pattern.ts` - Types
- ✅ `libs/contracts/src/index.ts` - Exports
- ✅ `apps/backend/src/domains/exercises/services/drum-mapper.service.ts` - Conversion logic
- ✅ `apps/backend/src/domains/exercises/dto/convert-drum-midi.dto.ts` - API types
- ✅ `apps/backend/src/domains/exercises/midi.controller.ts` - Endpoint
- ✅ `apps/backend/src/domains/exercises/exercises.module.ts` - Registration
- ✅ `apps/frontend/src/domains/admin/components/DrumPatternEditor.tsx` - Editor modal
- ⏳ `apps/frontend/src/domains/admin/components/ExerciseFormModal.tsx` - Integration (follow steps above)

## Benefits

1. **Fast Playback**: Pre-converted drum pattern = instant playback
2. **Admin Control**: Review/adjust auto-conversion before saving
3. **Queryable**: Can search exercises by drum patterns in future
4. **Consistent**: Matches bass fretboard conversion workflow
5. **FAANG-Level**: Parse once at upload, play millions of times

## Next Steps After Integration

1. Update Exercise entity to include `drumPattern` field
2. Update GlobalControls to use pre-converted `drum_pattern` instead of runtime MIDI parsing
3. Add drum pattern visualization in exercise list
4. Enable search by drum pattern

---

**Status**: Backend complete ✅ | Frontend ready for integration ⏳
