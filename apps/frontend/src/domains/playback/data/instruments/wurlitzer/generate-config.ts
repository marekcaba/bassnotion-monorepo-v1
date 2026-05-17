/**
 * Script to generate complete Wurlitzer configuration with all 64 notes
 * Run with: npx ts-node generate-config.ts
 */

// All notes from A0 to C6
const allNotes = [
  'A0',
  'A#0',
  'B0',
  'C1',
  'C#1',
  'D1',
  'D#1',
  'E1',
  'F1',
  'F#1',
  'G1',
  'G#1',
  'A1',
  'A#1',
  'B1',
  'C2',
  'C#2',
  'D2',
  'D#2',
  'E2',
  'F2',
  'F#2',
  'G2',
  'G#2',
  'A2',
  'A#2',
  'B2',
  'C3',
  'C#3',
  'D3',
  'D#3',
  'E3',
  'F3',
  'F#3',
  'G3',
  'G#3',
  'A3',
  'A#3',
  'B3',
  'C4',
  'C#4',
  'D4',
  'D#4',
  'E4',
  'F4',
  'F#4',
  'G4',
  'G#4',
  'A4',
  'A#4',
  'B4',
  'C5',
  'C#5',
  'D5',
  'D#5',
  'E5',
  'F5',
  'F#5',
  'G5',
  'G#5',
  'A5',
  'A#5',
  'B5',
  'C6',
];

// Notes that have only 3 velocity layers (v1, v2, v3)
const threeLayerNotes = [
  'C6',
  'B5',
  'A#5',
  'A5',
  'G#5',
  'G5',
  'F#5',
  'F5',
  'E5',
  'D#5',
  'D5',
  'C#5',
  'C5',
  'B4',
  'A#4',
  'G#4',
  'G4',
  'F4',
  'D4',
  'C3',
];

// Notes that have 4 velocity layers (v1, v2, v3, v4)
const fourLayerNotes = [
  'A4',
  'F#4',
  'E4',
  'C#4',
  'C4',
  'B3',
  'A#3',
  'G#3',
  'G3',
  'F#3',
  'E3',
  'D#3',
  'F#2',
  'F2',
  'E2',
  'D#2',
  'D2',
  'C#2',
  'A#1',
  'A1',
  'D#1',
  'D1',
  'E1',
  'F1',
  'G#1',
  'A1',
  'A#1',
  'C#1',
  'B0',
];

// Notes that have 5 velocity layers (v1, v2, v3, v4, v5)
const fiveLayerNotes = [
  'D#4',
  'A3',
  'F3',
  'D3',
  'C#3',
  'B2',
  'A#2',
  'A2',
  'G#2',
  'G2',
  'C2',
  'B1',
  'G#1',
  'G1',
  'F#1',
  'C1',
  'A#0',
  'A0',
];

function generateVelocityRanges(layerCount: number) {
  if (layerCount === 3) {
    // Equal split for 3 layers
    return [
      { min: 0, max: 42, layer: 'v1' },
      { min: 43, max: 85, layer: 'v2' },
      { min: 86, max: 127, layer: 'v3' },
    ];
  } else if (layerCount === 4) {
    // Equal split for 4 layers
    return [
      { min: 0, max: 31, layer: 'v1' },
      { min: 32, max: 63, layer: 'v2' },
      { min: 64, max: 95, layer: 'v3' },
      { min: 96, max: 127, layer: 'v4' },
    ];
  } else {
    // 5 layers (default)
    return [
      { min: 0, max: 25, layer: 'v1' },
      { min: 26, max: 51, layer: 'v2' },
      { min: 52, max: 77, layer: 'v3' },
      { min: 78, max: 102, layer: 'v4' },
      { min: 103, max: 127, layer: 'v5' },
    ];
  }
}

function getLayerCount(note: string): number {
  if (threeLayerNotes.includes(note)) return 3;
  if (fourLayerNotes.includes(note)) return 4;
  return 5;
}

const perNoteVelocityRanges: Record<
  string,
  Array<{ min: number; max: number; layer: string }>
> = {};

allNotes.forEach((note) => {
  const layerCount = getLayerCount(note);
  perNoteVelocityRanges[note] = generateVelocityRanges(layerCount);
});

const config = {
  name: 'Wurlitzer Electric Piano',
  version: '2.0.0',
  author: 'Bassicology Team',
  description:
    'Classic Wurlitzer 200A electric piano with per-note velocity layers (OGG format)',

  storage: {
    baseUrl:
      'https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples',
    bucketPath: 'Keyboards/wurlitzer',
  },

  globalVelocityRanges: [
    { min: 0, max: 25, layer: 'v1' },
    { min: 26, max: 51, layer: 'v2' },
    { min: 52, max: 77, layer: 'v3' },
    { min: 78, max: 102, layer: 'v4' },
    { min: 103, max: 127, layer: 'v5' },
  ],

  perNoteVelocityRanges,

  sampleMapping: Object.fromEntries(
    allNotes.map((note) => [note, `${note}_v{layer}.ogg`]),
  ),

  defaultLayers: ['v2', 'v3'],

  samplerConfig: {
    attack: 0.001,
    release: 0.4,
    curve: 'exponential',
    volume: 0,
  },

  optimization: {
    preloadPriority: ['v2', 'v3'],
    memoryLimit: 100,
    streamingEnabled: false,
    compressionFormat: 'ogg',
  },
};

console.log(JSON.stringify(config, null, 2));
