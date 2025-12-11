# Drum Kit Architecture - FAANG-Style Design

## Problem Statement

Drum kits from various sources (Hydrogen, user uploads, commercial packs) have inconsistent naming conventions. The platform needs to reliably identify drum types for the drummer widget.

## Solution: Manifest-Based Drum Kit System

### 1. Standardized Drum Types

```typescript
enum DrumType {
  // Core drums
  KICK = 'kick',
  SNARE = 'snare',
  HIHAT_CLOSED = 'hihat-closed',
  HIHAT_OPEN = 'hihat-open',

  // Toms
  TOM_HIGH = 'tom-high',
  TOM_MID = 'tom-mid',
  TOM_LOW = 'tom-low',
  TOM_FLOOR = 'tom-floor',

  // Cymbals
  CRASH = 'crash',
  CRASH_2 = 'crash-2',
  RIDE = 'ride',
  RIDE_BELL = 'ride-bell',
  SPLASH = 'splash',
  CHINA = 'china',

  // Percussion
  COWBELL = 'cowbell',
  CLAP = 'clap',
  TAMBOURINE = 'tambourine',
  SHAKER = 'shaker',

  // Electronic
  SYNTH = 'synth',
  FX = 'fx',

  // Special
  RIMSHOT = 'rimshot',
  SIDESTICK = 'sidestick',
  PEDAL_HIHAT = 'pedal-hihat',
}
```

### 2. Kit Manifest Structure

Each drum kit includes a `manifest.json`:

```json
{
  "id": "classic-808",
  "name": "Classic TR-808",
  "version": "1.0",
  "format": "mp3",
  "mapping": {
    "kick": [
      { "file": "bd-01.mp3", "velocity": 1, "variation": "default" },
      { "file": "bd-02.mp3", "velocity": 2, "variation": "default" },
      { "file": "bd-03.mp3", "velocity": 3, "variation": "default" }
    ],
    "snare": [
      { "file": "sd-01.mp3", "velocity": 1, "variation": "default" },
      { "file": "sd-02.mp3", "velocity": 2, "variation": "default" }
    ],
    "hihat-closed": [
      { "file": "hh-closed.mp3", "velocity": 1, "variation": "default" }
    ],
    "hihat-open": [
      { "file": "hh-open.mp3", "velocity": 1, "variation": "default" }
    ]
  },
  "metadata": {
    "style": "electronic",
    "era": "1980s",
    "characteristics": ["punchy", "analog", "classic"]
  }
}
```

### 3. Smart Mapping Algorithm

For existing kits without manifests, use pattern matching:

```typescript
const DRUM_PATTERNS = {
  kick: [
    /kick/i,
    /bd/i,
    /bass\s?drum/i,
    /bassdrum/i,
    /kik/i,
    /kk/i,
    /b\.?d\.?/i,
  ],
  snare: [/snare/i, /sd/i, /sn/i, /snr/i, /s\.?d\.?/i, /snaredrum/i],
  hihat_closed: [
    /hi[\s-]?hat.*clos/i,
    /hh.*clos/i,
    /closed.*hh/i,
    /ch/i,
    /hhc/i,
    /hat.*cl/i,
  ],
  hihat_open: [
    /hi[\s-]?hat.*open/i,
    /hh.*open/i,
    /open.*hh/i,
    /oh/i,
    /hho/i,
    /hat.*op/i,
  ],
  crash: [/crash/i, /crsh/i, /cr/i],
  ride: [/ride/i, /rd/i],
  tom_high: [/tom.*high/i, /high.*tom/i, /tom.*1/i, /ht/i],
  tom_mid: [/tom.*mid/i, /mid.*tom/i, /tom.*2/i, /mt/i],
  tom_low: [/tom.*low/i, /low.*tom/i, /tom.*3/i, /lt/i, /floor.*tom/i, /ft/i],
};
```

### 4. Performance Optimization

```typescript
// Pre-compute and cache mappings
class DrumKitLoader {
  private cache = new Map<string, ProcessedKit>();

  async loadKit(kitId: string): Promise<ProcessedKit> {
    // Check cache first
    if (this.cache.has(kitId)) {
      return this.cache.get(kitId)!;
    }

    // Load manifest or generate mapping
    const manifest = await this.loadManifest(kitId);
    const processed = manifest
      ? this.processManifest(manifest)
      : await this.generateMapping(kitId);

    this.cache.set(kitId, processed);
    return processed;
  }
}
```

### 5. Fallback Strategy

For unmatched samples:

1. Use machine learning audio classification
2. Analyze frequency spectrum
3. Default to "percussion" category
4. Allow manual override

### 6. Migration Path

1. **Phase 1**: Generate manifests for existing kits
2. **Phase 2**: Update DrumInstrumentProcessor to use manifests
3. **Phase 3**: Add manifest editor for user uploads
4. **Phase 4**: Implement ML-based classification

## Benefits

1. **Consistency**: Same drum types across all kits
2. **Performance**: O(1) lookups with pre-computed mappings
3. **Flexibility**: Supports multiple samples per drum type
4. **Extensibility**: Easy to add new drum types
5. **User Experience**: Seamless kit switching
6. **Developer Experience**: Clear, typed API

## Implementation Priority

1. Create manifest generator script
2. Generate manifests for all 19 Hydrogen kits
3. Update DrumInstrumentProcessor
4. Add runtime fallback mapping
5. Build UI for manual mapping corrections
