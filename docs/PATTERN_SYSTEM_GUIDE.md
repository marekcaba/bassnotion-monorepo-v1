# Pattern System Guide

## Overview

The pattern system allows users to select different drum and harmony patterns for their practice sessions. Patterns are stored as MIDI files in a dedicated Supabase storage bucket.

## Storage Structure

Patterns are stored in the `patterns` bucket with the following structure:

```
patterns/
├── drums/
│   ├── basic-rock-beat.mid
│   ├── jazz-swing.mid
│   ├── funk-groove.mid
│   ├── latin-salsa.mid
│   ├── hip-hop-beat.mid
│   └── reggae-one-drop.mid
└── harmony/
    ├── simple-chords.mid
    ├── jazz-voicings.mid
    ├── power-chords.mid
    ├── blues-12-bar.mid
    ├── neo-soul.mid
    └── bossa-nova.mid
```

## Uploading Patterns

### Via Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to Storage → Buckets
3. Click on the `patterns` bucket (it should be public)
4. Create folders: `drums` and `harmony`
5. Upload MIDI files to the appropriate folder

### Via API (Admin Only)

```bash
# Upload a drum pattern
curl -X POST http://localhost:3000/api/v1/admin/patterns/upload \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "file=@drum-pattern.mid" \
  -F "type=drums" \
  -F "name=Rock Beat" \
  -F "slug=rock-beat" \
  -F "genre=rock" \
  -F "timeSignature=4/4" \
  -F "bars=4"
```

## Pattern Metadata

Each pattern in the database contains:

- **name**: Display name (e.g., "Rock Beat")
- **slug**: URL-safe identifier (e.g., "rock-beat")
- **type**: Either "drums" or "harmony"
- **genre**: Musical genre (rock, jazz, funk, etc.)
- **timeSignature**: Time signature (e.g., "4/4", "6/8")
- **bars**: Pattern length in bars
- **midiFileUrl**: Full URL to the MIDI file
- **midiFilePath**: Path in the bucket (e.g., "drums/rock-beat.mid")
- **tags**: Searchable tags

## Using Patterns in the App

### For Users

1. Open any tutorial page
2. Expand the Drummer or Harmony widget
3. Click the purple music icon button
4. Select from available patterns
5. Pattern changes apply immediately

### For Developers

```typescript
// Pattern data structure
interface Pattern {
  id: string;
  name: string;
  midiFileUrl: string;  // Direct URL to MIDI file
  genre?: string;
  // ... other metadata
}

// Loading a pattern
const loadPattern = async (pattern: Pattern) => {
  // Fetch the MIDI file
  const response = await fetch(pattern.midiFileUrl);
  const midiData = await response.arrayBuffer();

  // Parse MIDI data (using @tonejs/midi or similar)
  const midi = new Midi(midiData);

  // Extract events for playback
  const events = midi.tracks[0].notes;

  return events;
};
```

## Default Patterns

The system comes with these default patterns:

### Drum Patterns
- **Basic Rock Beat**: Standard 4/4 rock pattern
- **Jazz Swing**: Swing feel with ride cymbal
- **Funk Groove**: Syncopated funk pattern
- **Latin Salsa**: Latin percussion pattern
- **Hip Hop Beat**: Urban groove
- **Reggae One Drop**: Classic reggae pattern

### Harmony Patterns
- **Simple Chords**: Basic triads (C-Am-F-G)
- **Jazz Voicings**: 7th chord voicings
- **Power Chords**: Rock power chords
- **Blues 12-Bar**: Traditional blues progression
- **Neo Soul**: Modern R&B chords
- **Bossa Nova**: Brazilian jazz chords

## API Endpoints

### Public Endpoints
- `GET /api/v1/patterns` - List all patterns
- `GET /api/v1/patterns/:id` - Get pattern by ID
- `GET /api/v1/patterns/tutorial/:tutorialId` - Get patterns for a tutorial
- `POST /api/v1/patterns/tutorial/:tutorialId/select` - Save user selection

### Admin Endpoints
- `POST /api/v1/admin/patterns/upload` - Upload new pattern
- `GET /api/v1/admin/patterns/files` - List all files in bucket
- `DELETE /api/v1/admin/patterns/:id` - Delete a pattern

## MIDI File Requirements

- **Format**: Standard MIDI (.mid) files
- **Size**: Maximum 1MB per file
- **Content**:
  - Drum patterns: Use General MIDI drum mapping
  - Harmony patterns: Include chord changes as MIDI notes
- **Length**: Typically 1-4 bars, loops automatically

## Troubleshooting

### Pattern not playing?
1. Check if MIDI file exists in the bucket
2. Verify the file URL is accessible
3. Check browser console for loading errors

### Pattern not showing in list?
1. Ensure pattern is marked as `is_active = true` in database
2. Check if tutorial allows pattern switching
3. Verify user has permission to see pattern

### Upload failing?
1. File must be .mid format
2. File size under 1MB
3. Admin authentication required
4. Bucket must have public access enabled

## Future Enhancements

- MIDI parsing and visualization
- Pattern editor UI
- AI-generated pattern variations
- Pattern mixing (combine drums from one, harmony from another)
- User-uploaded patterns
- Pattern recommendations based on skill level