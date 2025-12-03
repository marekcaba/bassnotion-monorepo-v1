# Professional Instruments Implementation Guide

## Story 3.16: Professional Audio Platform Infrastructure

### Overview
This guide documents the implementation of 4 professional instruments for the BassNotion platform.

### Instruments

#### Salamander Grand Piano
- **Status**: ✅ IMPLEMENTED
- **Implementation**: Tone.Sampler
- **Details**: Using Tone.js CDN with 30 samples (~2MB total)

**Usage**:
```typescript
// Already implemented in ChordInstrumentProcessor
const sampler = new Tone.Sampler({
  urls: { /* 30 sample URLs */ },
  baseUrl: 'https://tonejs.github.io/audio/salamander/'
});
```

#### Nice Keys Rhodes
- **Status**: ⏳ PENDING
- **Implementation**: Tone.Sampler (future)
- **Details**: Need to download SF2 file and extract samples

**Implementation Plan**:

1. Download Nice Keys Rhodes SF2 from FreePats
2. Extract individual samples using sf2extract tool
3. Convert to web-optimized format (MP3/OGG)
4. Upload to Supabase or serve from CDN
5. Configure Tone.Sampler with sample URLs

**Alternative Synthesis**:
```typescript
// Alternative: Synthesis-based Rhodes sound
const rhodes = new Tone.PolySynth(Tone.FMSynth, {
  harmonicity: 0.5,
  modulationIndex: 1.2,
  oscillator: { type: 'sine' },
  envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 1.2 },
  modulation: { type: 'sine' },
  modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.5 }
});
```

#### Drawbar Organ
- **Status**: 🔧 READY TO IMPLEMENT
- **Implementation**: Tone.js Synthesis
- **Details**: Hammond B3-style organ using additive synthesis

**Synthesis Implementation**:
```typescript
// Hammond-style drawbar organ
const organ = new Tone.PolySynth(Tone.Synth, {
  oscillator: {
    type: 'custom',
    partials: [1, 0, 0.5, 0, 0.33, 0, 0, 0.25, 0.125] // Drawbar settings
  },
  envelope: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.9,
    release: 0.2
  }
});

// Add rotary speaker effect
const rotary = new Tone.Chorus(4, 2.5, 0.5);
const tremolo = new Tone.Tremolo(6, 0.8).start();
organ.connect(rotary).connect(tremolo).toDestination();
```

#### Warm Pad Synthesizer
- **Status**: 🔧 READY TO IMPLEMENT
- **Implementation**: Tone.js Synthesis
- **Details**: Lush analog-style pad sound

**Synthesis Implementation**:
```typescript
// Warm analog pad sound
const warmPad = new Tone.PolySynth(Tone.Synth, {
  oscillator: {
    type: 'sawtooth',
    spread: 30, // Detune for warmth
    count: 3    // Multiple oscillators
  },
  envelope: {
    attack: 0.8,
    decay: 0.5,
    sustain: 0.8,
    release: 2.0
  },
  filter: {
    type: 'lowpass',
    frequency: 800,
    rolloff: -24
  },
  filterEnvelope: {
    attack: 0.5,
    decay: 0.2,
    sustain: 0.5,
    release: 2.0,
    baseFrequency: 200,
    octaves: 4
  }
});

// Add chorus for width
const chorus = new Tone.Chorus(2, 3.5, 0.7);
const reverb = new Tone.Reverb({ decay: 4, wet: 0.3 });
warmPad.connect(chorus).connect(reverb).toDestination();
```

### Integration with ChordInstrumentProcessor

The ChordInstrumentProcessor should support all 4 instruments:

```typescript
private async loadInstrumentSound(instrumentType: string): Promise<void> {
  switch (instrumentType) {
    case 'acoustic_grand_piano':
      await this.loadToneSampler('salamander');
      break;
      
    case 'electric_piano_1':
      // Load Rhodes samples or use synthesis
      await this.loadRhodesSynthesis();
      break;
      
    case 'drawbar_organ':
      await this.loadOrganSynthesis();
      break;
      
    case 'pad_2_warm':
      await this.loadWarmPadSynthesis();
      break;
  }
}
```

### Next Steps

1. **Immediate**: Test Salamander Piano implementation
2. **Short-term**: Implement organ and synth pad using synthesis
3. **Long-term**: Download and integrate real Rhodes samples

### Performance Considerations

- Salamander Piano: ~2MB download, 30 samples
- Synthesis instruments: Minimal download, CPU-based generation
- Target latency: <10ms for all instruments
- Memory usage: Monitor and optimize sample loading
