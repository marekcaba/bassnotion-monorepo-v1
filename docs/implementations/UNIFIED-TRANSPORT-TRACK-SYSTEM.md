# BassNotion Unified Transport & Track System Architecture

## Plain English Summary

Think of BassNotion's audio system like a digital orchestra conductor combined with a multi-track recording studio:

**The Conductor (UnifiedTransport)** keeps perfect time and tells everyone when to play. It uses three different "metronomes" to stay accurate - the best one updates every 2.67 milliseconds (faster than you can blink). If one metronome fails, it automatically switches to a backup.

**The Musicians (Track System)** are organized into sections - drums, bass, chords, and metronome. Each section has its own "sheet music" (regions) that tells it what notes to play and when. The sheet music can come from MIDI files, programmed patterns, or audio recordings.

**The Stage Manager (PatternScheduler)** looks ahead by 200 milliseconds to see what's coming up in the music. It prepares the right musicians and tells them exactly when they need to play their notes. This "look-ahead" prevents any stuttering or delays.

**The Sound Engineers (AudioEventRouter & Instrument Processors)** take the musical instructions and turn them into actual sounds. Each instrument has its own specialized sound engineer who knows how to make that instrument sound professional - like adding the right effects to a bass guitar or making drums sound punchy.

**The Recording Studio (AudioEngine & Web Audio API)** is where all the sounds come together. It manages the speakers, handles the mixing, and ensures everything sounds good on your device.

**The Building (React Application)** houses everything. When you first visit the page, the building is set up but quiet. When you click "play" for the first time, it's like turning on the power - the studio comes alive and music can start playing.

The entire system is designed to be rock-solid reliable. If something goes wrong, there are backups for the backups. The timing stays perfect even if your computer gets busy. And it all runs in your web browser while sounding like professional music software.

## Overview

The BassNotion audio system is a professional-grade web audio implementation that provides DAW-quality playback, precise timing, and flexible track management. This document details the complete architecture from page load to audio output.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Core Components](#core-components)
3. [Initialization Flow](#initialization-flow)
4. [Track System](#track-system)
5. [Audio Pipeline](#audio-pipeline)
6. [Service Registry](#service-registry)
7. [React Integration](#react-integration)
8. [Timing & Synchronization](#timing--synchronization)
9. [Complete Flow Diagram](#complete-flow-diagram)

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     React Application                        │
├─────────────────────────────────────────────────────────────┤
│                      AudioProvider                           │
│                   (React Context)                           │
├─────────────────────────────────────────────────────────────┤
│                   GlobalAudioSystem                         │
│                    (Singleton)                              │
├─────────────────────────────────────────────────────────────┤
│                     CoreServices                            │
│              (Service Orchestrator)                         │
├─────────────────────────────────────────────────────────────┤
│ EventBus │ AudioEngine │ UnifiedTransport │ PatternScheduler│
├─────────────────────────────────────────────────────────────┤
│        AudioEventRouter │ ExerciseLoader │ TrackSystem      │
├─────────────────────────────────────────────────────────────┤
│              Instrument Processors (Tone.js)                │
├─────────────────────────────────────────────────────────────┤
│                   Web Audio API                             │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. UnifiedTransport (`/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`)

The heart of the timing system, providing sample-accurate playback control.

```typescript
class UnifiedTransport {
  // Singleton instance
  private static instance: UnifiedTransport | null = null;

  // Core dependencies
  private audioEngine: AudioEngine;
  private eventBus: EventBus;

  // Timing sources (prioritized)
  private audioWorkletNode: AudioWorkletNode | null = null; // Primary (2.67ms latency)
  private timingWorker: Worker | null = null; // Fallback (5-10ms latency)
  private updateTimer: number | null = null; // Last resort (16ms latency)

  // State management
  private state: 'stopped' | 'playing' | 'paused' = 'stopped';
  private musicalPosition: MusicalPosition = {
    bars: 0,
    beats: 0,
    sixteenths: 0,
    ticks: 0,
  };

  // Precision timing
  private lastAudioWorkletFrame: number = 0; // Sample-accurate frame count
  private pauseFrame: number = 0; // Frame position at pause
  private pausedAudioWorkletTime: number = 0; // Time at pause for continuity

  // Drift compensation
  private driftCompensator: KalmanFilter; // Predictive drift correction
  private currentDrift: number = 0;
  private driftHistory: number[] = [];
}
```

**Key Features:**

- **Multi-tier timing strategy**: AudioWorklet → WebWorker → setInterval
- **Sample-accurate pause/resume**: Maintains exact frame position
- **Adaptive drift compensation**: Kalman filter for timing stability
- **Professional transport controls**: Start, stop, pause, seek, loop

### 2. AudioEngine (`/apps/frontend/src/domains/playback/services/core/AudioEngine.ts`)

Manages the Web Audio API context and Tone.js integration.

```typescript
class AudioEngine {
  private audioContext: AudioContext | null = null;
  private toneInstance: typeof Tone | null = null;
  private isInitialized: boolean = false;

  // Initialization with user gesture handling
  async initialize(): Promise<void> {
    // Load Tone.js dynamically
    const Tone = await import('tone');

    // Create/resume AudioContext
    if (!this.audioContext) {
      this.audioContext = new AudioContext({
        latencyHint: 'interactive',
        sampleRate: 48000,
      });
    }

    // Configure Tone.js to use our context
    Tone.setContext(this.audioContext);

    // Apply professional timing settings
    Tone.Transport.PPQ = 960; // High resolution
    Tone.Transport.lookAhead = 0.15; // 150ms lookahead
  }
}
```

### 3. Track System Data Models (`/apps/frontend/src/domains/playback/models/`)

Hierarchical structure for organizing musical content:

```typescript
// Session - Top level container
interface SessionModel {
  id: string;
  name: string;
  tempo: number;
  timeSignature: TimeSignature;
  duration: MusicalPosition;
  tracks: TrackModel[];
}

// Track - Instrument-specific container
interface TrackModel {
  id: string;
  type: 'bass' | 'drums' | 'metronome' | 'harmony' | 'melody';
  name: string;
  regions: RegionModel[];
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
}

// Region - Time-based content container
interface RegionModel {
  id: string;
  startPosition: MusicalPosition;
  duration: MusicalPosition;
  // Content variants (only one will be present)
  midiData?: MidiDataModel; // MIDI file content
  pattern?: PatternModel; // Programmed pattern
  audioClip?: AudioClipModel; // Audio sample
}

// Musical Position - Precise time representation
interface MusicalPosition {
  bars: number; // Measure number (0-based)
  beats: number; // Beat within measure (0-based)
  sixteenths: number; // 16th note within beat (0-3)
  ticks: number; // MIDI ticks (0-959 per quarter note)
}
```

### 4. PatternScheduler (`/apps/frontend/src/domains/playback/services/core/PatternScheduler.ts`)

Converts track regions into scheduled audio events.

```typescript
class PatternScheduler {
  private activeRegions: Map<string, ActiveRegion[]> = new Map();
  private scheduledUntil: number = 0;
  private lookAheadTime: number = 0.2; // 200ms lookahead

  // Main scheduling loop (called by UnifiedTransport)
  scheduleEvents(currentTime: number, untilTime: number): void {
    // For each track
    for (const [trackId, track] of this.tracks) {
      // Find regions that overlap the scheduling window
      const activeRegions = this.getActiveRegions(
        track,
        currentTime,
        untilTime,
      );

      // Generate events from regions
      for (const region of activeRegions) {
        const events = this.generateEventsFromRegion(
          region,
          currentTime,
          untilTime,
        );

        // Send events to AudioEventRouter
        for (const event of events) {
          this.eventBus.emit('audio:trigger', event);
        }
      }
    }
  }
}
```

### 5. AudioEventRouter (`/apps/frontend/src/domains/playback/services/core/AudioEventRouter.ts`)

Routes scheduled events to appropriate instrument processors.

```typescript
class AudioEventRouter {
  private instruments: Map<string, InstrumentProcessor> = new Map();

  constructor(private eventBus: EventBus) {
    // Initialize instrument processors
    this.instruments.set('metronome', new MetronomeInstrumentProcessor());
    this.instruments.set('drums', new DrumInstrumentProcessor());
    this.instruments.set('bass', new BassInstrumentProcessor());
    this.instruments.set('chords', new ChordInstrumentProcessor());

    // Listen for trigger events
    this.eventBus.on('audio:trigger', this.handleTrigger.bind(this));
  }

  private handleTrigger(event: AudioTriggerEvent): void {
    const processor = this.instruments.get(event.instrumentType);
    if (processor) {
      processor.trigger(event);
    }
  }
}
```

## Initialization Flow

### Phase 1: Pre-Initialization (Page Load)

```typescript
// 1. React app mounts AudioProvider
<AudioProvider>
  <App />
</AudioProvider>

// 2. AudioProvider creates GlobalAudioSystem
useEffect(() => {
  const globalSystem = GlobalAudioSystem.getInstance();
  globalSystem.preInitialize();
}, []);

// 3. GlobalAudioSystem creates CoreServices
class GlobalAudioSystem {
  preInitialize() {
    // Create service instances (no audio context yet)
    this.coreServices = new CoreServices();

    // Pre-load Tone.js library
    import('tone');

    // Register services
    this.coreServices.preInitialize();
  }
}

// 4. CoreServices wires dependencies
class CoreServices {
  preInitialize() {
    // Create services in dependency order
    this.eventBus = new EventBus();
    this.audioEngine = new AudioEngine(this.eventBus);

    // Create transport (not started)
    this.unifiedTransport = UnifiedTransport.getInstance(
      this.eventBus,
      this.audioEngine
    );

    // Create other services
    this.patternScheduler = new PatternScheduler(this.eventBus);
    this.audioEventRouter = new AudioEventRouter(this.eventBus);
    this.exerciseLoader = new ExerciseLoader(this.eventBus);
  }
}
```

### Phase 2: Full Initialization (User Gesture)

```typescript
// 1. User clicks play button
<button onClick={handlePlay}>Play</button>

// 2. Handler ensures audio context
const handlePlay = withAudioContext(async () => {
  // This wrapper ensures audio context is created/resumed
  await audioServices.start();
});

// 3. AudioEngine creates/resumes context
async start() {
  if (!this.audioContext) {
    this.audioContext = new AudioContext();
  }

  if (this.audioContext.state === 'suspended') {
    await this.audioContext.resume();
  }

  // Initialize Tone.js with context
  const Tone = await getTone();
  Tone.setContext(this.audioContext);
}

// 4. CoreServices fully initializes all services
async initialize() {
  // Initialize in dependency order
  await this.audioEngine.initialize();
  await this.unifiedTransport.initialize();
  await this.serviceRegistry.initialize();

  // Emit ready event
  this.eventBus.emit('audio:initialized');
}

// 5. UnifiedTransport initializes timing
async initialize() {
  // Try AudioWorklet first (best latency)
  if (this.audioContext.audioWorklet) {
    await this.initializeAudioWorklet();
  } else {
    // Fallback to WebWorker
    await this.initializeWebWorker();
  }

  // Configure transport settings
  this.configureTiming();
}
```

## Audio Pipeline

### Complete Audio Flow

```
Exercise Data (Supabase)
    ↓
ExerciseLoader
    ↓
SessionManager (creates tracks/regions)
    ↓
PatternScheduler (schedules events)
    ↓
AudioEventRouter (routes to instruments)
    ↓
Instrument Processors (generate audio)
    ↓
Tone.js (audio processing)
    ↓
Web Audio API (output)
    ↓
Speakers
```

### Instrument Processors

Each instrument processor handles specific audio generation:

#### DrumInstrumentProcessor

```typescript
class DrumInstrumentProcessor {
  private drumKits: Map<string, DrumKit> = new Map();
  private samplers: Map<string, Tone.Sampler> = new Map();

  async loadKit(kitName: string) {
    // Load drum samples from Supabase
    const samples = {
      C1: 'kick.wav',
      D1: 'snare.wav',
      'F#1': 'hihat.wav',
      // ... more mappings
    };

    const sampler = new Tone.Sampler({
      urls: samples,
      baseUrl: `${SUPABASE_URL}/drums/${kitName}/`,
      onload: () => console.log(`Kit ${kitName} loaded`),
    }).toDestination();

    this.samplers.set(kitName, sampler);
  }

  trigger(event: DrumTriggerEvent) {
    const sampler = this.samplers.get(event.kitName);
    if (sampler) {
      sampler.triggerAttackRelease(
        event.note,
        event.duration,
        event.time,
        event.velocity,
      );
    }
  }
}
```

#### BassInstrumentProcessor

```typescript
class BassInstrumentProcessor {
  private synth: Tone.MonoSynth;
  private effects: {
    compressor: Tone.Compressor;
    eq: Tone.EQ3;
    cabinet: Tone.Convolver;
  };

  constructor() {
    // Create bass synth with effects chain
    this.synth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0.9,
        release: 0.1,
      },
    });

    // Professional bass processing
    this.effects.compressor = new Tone.Compressor(-30, 3);
    this.effects.eq = new Tone.EQ3(2, -2, 0);

    // Connect chain
    this.synth.chain(
      this.effects.compressor,
      this.effects.eq,
      Tone.Destination,
    );
  }
}
```

## Service Registry

The ServiceRegistry manages service lifecycle and dependencies:

```typescript
class ServiceRegistry {
  private services: Map<string, Service> = new Map();
  private initOrder: string[] = [
    'eventBus',
    'audioEngine',
    'unifiedTransport',
    'pluginManager',
    'patternScheduler',
    'audioEventRouter',
    'exerciseLoader',
  ];

  async initialize() {
    // Initialize services in dependency order
    for (const serviceName of this.initOrder) {
      const service = this.services.get(serviceName);
      if (service && !service.isInitialized()) {
        console.log(`ServiceRegistry: Initializing ${serviceName}...`);
        await service.initialize();
        console.log(`ServiceRegistry: ${serviceName} initialized successfully`);
      }
    }
  }
}
```

## React Integration

### AudioProvider Context

```typescript
const AudioContext = React.createContext<AudioContextType | null>(null);

export const AudioProvider: React.FC = ({ children }) => {
  const [audioState, setAudioState] = useState<AudioState>({
    initialized: false,
    contextState: 'suspended'
  });

  useEffect(() => {
    // Get or create global system
    const globalSystem = GlobalAudioSystem.getInstance();

    // Pre-initialize (no audio context)
    globalSystem.preInitialize();

    // Listen for initialization
    const handleInit = () => {
      setAudioState({
        initialized: true,
        contextState: 'running'
      });
    };

    globalSystem.eventBus.on('audio:initialized', handleInit);

    return () => {
      globalSystem.eventBus.off('audio:initialized', handleInit);
    };
  }, []);

  return (
    <AudioContext.Provider value={{ audioState, ...globalSystem }}>
      {children}
    </AudioContext.Provider>
  );
};
```

### React Hooks

```typescript
// Access all audio services
export function useAudioServices() {
  const context = useContext(AudioContext);
  if (!context)
    throw new Error('useAudioServices must be used within AudioProvider');
  return context.coreServices;
}

// Direct transport access
export function useUnifiedTransport() {
  const services = useAudioServices();
  return services.unifiedTransport;
}

// Transport state hook
export function useTransport() {
  const transport = useUnifiedTransport();
  const [state, setState] = useState(transport.getState());

  useEffect(() => {
    const handleUpdate = (event) => setState(event.state);
    transport.eventBus.on('transport:state-changed', handleUpdate);
    return () =>
      transport.eventBus.off('transport:state-changed', handleUpdate);
  }, [transport]);

  return state;
}
```

## Timing & Synchronization

### AudioWorklet Timing Processor

```javascript
// /public/worklets/timing-processor.js
class TimingProcessor extends AudioWorkletProcessor {
  constructor() {
    this.isPlaying = false;
    this.totalFrames = 0;
    this.pauseFrame = 0;
    this.samplesPerUpdate = 128; // 2.67ms @ 48kHz
  }

  process(inputs, outputs) {
    if (this.isPlaying) {
      this.totalFrames += 128;

      // Send timing update every 128 samples
      this.port.postMessage({
        type: 'timing-update',
        playbackFrame: this.totalFrames,
        time: this.totalFrames / sampleRate,
      });
    }

    return true; // Keep processor alive
  }

  handleMessage(event) {
    switch (event.data.type) {
      case 'start':
        this.isPlaying = true;
        if (event.data.fromFrame !== undefined) {
          this.totalFrames = event.data.fromFrame; // Resume from pause
        }
        break;
      case 'pause':
        this.isPlaying = false;
        this.pauseFrame = this.totalFrames;
        break;
      case 'stop':
        this.isPlaying = false;
        this.totalFrames = 0;
        break;
    }
  }
}
```

### Drift Compensation

```typescript
class UnifiedTransport {
  private detectAndCompensateDrift(): void {
    const tone = this.audioEngine.getTone();
    const transportTime = tone.Transport.seconds;

    // Calculate expected vs actual time
    const expectedTime = this.calculateExpectedTime();
    const drift = transportTime - expectedTime;

    // Update Kalman filter
    this.driftCompensator.update(drift);
    const predictedDrift = this.driftCompensator.predict();

    // Apply compensation if drift exceeds threshold
    if (Math.abs(predictedDrift) > 0.001) {
      // 1ms threshold
      tone.Transport.seconds = expectedTime + predictedDrift * 0.5;
    }
  }
}
```

## Complete Flow Diagram

### From User Interaction to Audio Output

```
1. USER INTERACTION
   └─> Play Button Click
       └─> withAudioContext() wrapper
           └─> ensureAudioContext()
               └─> AudioContext.resume()

2. INITIALIZATION CASCADE
   └─> AudioEngine.initialize()
       └─> Load Tone.js
       └─> Configure AudioContext
       └─> Set timing parameters
   └─> UnifiedTransport.initialize()
       └─> Initialize AudioWorklet
       └─> Configure drift compensation
       └─> Set up timing sources
   └─> ServiceRegistry.initialize()
       └─> Initialize all services in order
       └─> Connect event listeners

3. EXERCISE LOADING
   └─> ExerciseLoader.loadExercise(id)
       └─> Fetch from Supabase
       └─> Parse exercise data
   └─> SessionManager.createSession()
       └─> Create track structure
       └─> Load MIDI files
       └─> Create regions
   └─> PatternScheduler.loadSession()
       └─> Index regions by time
       └─> Prepare for scheduling

4. TRANSPORT START
   └─> UnifiedTransport.start()
       └─> Start AudioWorklet timing
       └─> Begin Tone.Transport
       └─> Emit transport:start

5. SCHEDULING LOOP (every 2.67ms via AudioWorklet)
   └─> AudioWorklet sends timing update
       └─> UnifiedTransport.handleTimingUpdate()
           └─> Update musical position
           └─> Check drift and compensate
           └─> PatternScheduler.scheduleEvents()
               └─> Find active regions
               └─> Generate trigger events
               └─> Emit audio:trigger events

6. AUDIO GENERATION
   └─> AudioEventRouter receives trigger
       └─> Route to appropriate processor
           └─> InstrumentProcessor.trigger()
               └─> Tone.js generates audio
                   └─> Web Audio API processing
                       └─> Audio output to speakers

7. CONTINUOUS MONITORING
   └─> Performance metrics collection
   └─> Drift compensation
   └─> Buffer health monitoring
   └─> Event timing verification
```

## Performance Considerations

### Timing Accuracy

- **AudioWorklet**: 2.67ms latency (128 samples @ 48kHz)
- **WebWorker**: 5-10ms latency (fallback)
- **setInterval**: 16ms latency (last resort)

### Memory Management

- Samples loaded on-demand
- Unused regions garbage collected
- Event queues bounded in size
- Circular buffers for timing data

### CPU Optimization

- Lookahead scheduling reduces peak load
- Event batching minimizes function calls
- Efficient data structures (Maps, typed arrays)
- Web Workers offload timing calculations

## Debugging & Monitoring

### Debug Logging

```typescript
// Enable detailed logging
localStorage.setItem('bassnotion:debug', 'true');

// Timing logs
console.log('🎯 Frame tracking update:', frame);
console.log('⏱️ Drift detected:', drift);

// State changes
console.log('▶️ Transport started');
console.log('⏸️ Transport paused at frame:', frame);
```

### Performance Metrics

```typescript
interface TransportMetrics {
  updateRate: number; // Updates per second
  avgLatency: number; // Average scheduling latency
  maxLatency: number; // Peak latency
  missedDeadlines: number; // Scheduling misses
  bufferHealth: number; // 0-100% health
  cpuLoad: number; // Estimated CPU usage
}
```

## Summary

The BassNotion Unified Transport and Track System provides:

1. **Professional-grade timing** with multiple fallback strategies
2. **Flexible track system** supporting MIDI, patterns, and audio
3. **Modular architecture** with clear separation of concerns
4. **React integration** that survives component lifecycles
5. **Browser-compliant** audio context handling
6. **Performance optimized** for real-time audio
7. **Extensible design** for future instrument additions

This architecture ensures reliable, high-quality audio playback in the browser while maintaining the flexibility needed for educational music applications.
