# Widget Development Guide

## 5-Minute Widget Setup

This guide demonstrates how to create a new audio widget in BassNotion using the professional React hooks provided by the new architecture.

### Prerequisites

1. Ensure your app is wrapped with the `AudioProvider`:
```tsx
import { AudioProvider } from '@/domains/playback/providers/AudioProvider';

function App() {
  return (
    <AudioProvider>
      {/* Your app content */}
    </AudioProvider>
  );
}
```

### Step 1: Create Your Widget Component

```tsx
import React from 'react';
import { useAudio, useTransport } from '@/domains/playback/hooks';

export function MyNewWidget() {
  // Get audio services - no direct Tone.js usage needed!
  const { isReady, createSampler } = useAudio();
  const { isPlaying, start, stop, tempo } = useTransport();

  // Your widget logic here
  const handlePlay = async () => {
    if (isPlaying) {
      await stop();
    } else {
      await start();
    }
  };

  if (!isReady) {
    return <div>Loading audio...</div>;
  }

  return (
    <div className="my-widget">
      <h3>My Audio Widget</h3>
      <button onClick={handlePlay}>
        {isPlaying ? 'Stop' : 'Play'}
      </button>
      <p>Tempo: {tempo} BPM</p>
    </div>
  );
}
```

### Step 2: Add Audio Functionality

```tsx
import React, { useEffect, useRef } from 'react';
import { useAudio, useTransport } from '@/domains/playback/hooks';

export function PianoWidget() {
  const { isReady, createSampler } = useAudio();
  const { isPlaying } = useTransport();
  const samplerRef = useRef(null);

  // Initialize sampler when ready
  useEffect(() => {
    const initSampler = async () => {
      if (!isReady) return;

      try {
        const sampler = await createSampler({
          urls: {
            C4: 'C4.mp3',
            'D#4': 'Ds4.mp3',
            'F#4': 'Fs4.mp3',
            A4: 'A4.mp3',
          },
          baseUrl: '/samples/piano/',
        });
        
        samplerRef.current = sampler;
      } catch (error) {
        console.error('Failed to create sampler:', error);
      }
    };

    initSampler();

    // Cleanup
    return () => {
      if (samplerRef.current) {
        samplerRef.current.dispose();
      }
    };
  }, [isReady, createSampler]);

  const playNote = (note: string) => {
    if (samplerRef.current) {
      samplerRef.current.triggerAttackRelease(note, '8n');
    }
  };

  return (
    <div className="piano-widget">
      <button onClick={() => playNote('C4')}>C</button>
      <button onClick={() => playNote('D4')}>D</button>
      <button onClick={() => playNote('E4')}>E</button>
    </div>
  );
}
```

### Step 3: Use Plugins

```tsx
import { usePlugins } from '@/domains/playback/hooks';

export function EffectsWidget() {
  const { getPlugin, activatePlugin } = usePlugins();
  
  const addReverb = async () => {
    // Get reverb plugin
    const reverb = getPlugin('reverb');
    if (reverb) {
      await activatePlugin('reverb');
    }
  };

  return (
    <button onClick={addReverb}>Add Reverb</button>
  );
}
```

## Hook API Reference

### useAudio()

Provides access to the audio engine for creating samplers and accessing Tone.js.

```tsx
const {
  isReady,           // boolean - Audio engine initialized
  isInitializing,    // boolean - Currently initializing
  error,             // Error | null - Initialization error
  createSampler,     // Function - Create a new sampler
  getTone,           // Function - Get Tone.js instance
  audioContext,      // AudioContext | null
  initialize,        // Function - Manual initialization
} = useAudio();
```

### useTransport()

Controls playback and transport state.

```tsx
const {
  isPlaying,         // boolean
  isPaused,          // boolean
  isStopped,         // boolean
  tempo,             // number - Current BPM
  timeSignature,     // TimeSignature
  position,          // TransportPosition
  start,             // Function - Start playback
  stop,              // Function - Stop playback
  pause,             // Function - Pause playback
  setTempo,          // Function - Set BPM
  setTimeSignature,  // Function - Set time signature
  seekTo,            // Function - Seek to position
  setLoop,           // Function - Set loop points
  isLoopEnabled,     // boolean
} = useTransport();
```

### usePlugins()

Manages audio plugins and effects.

```tsx
const {
  isReady,                // boolean
  error,                  // Error | null
  getPlugin,              // Function - Get plugin by ID
  getAllPlugins,          // Function - Get all plugins
  getPluginsByCapability, // Function - Filter by capability
  activatePlugin,         // Function - Activate plugin
  deactivatePlugin,       // Function - Deactivate plugin
  getPluginState,         // Function - Get plugin state
  registerPlugin,         // Function - Register new plugin
} = usePlugins();
```

## Best Practices

### 1. Always Check isReady

```tsx
const { isReady } = useAudio();

if (!isReady) {
  return <LoadingSpinner />;
}
```

### 2. Clean Up Resources

```tsx
useEffect(() => {
  let sampler;
  
  const init = async () => {
    sampler = await createSampler(config);
  };
  
  init();
  
  return () => {
    if (sampler) {
      sampler.dispose();
    }
  };
}, []);
```

### 3. Handle Errors Gracefully

```tsx
const { error } = useAudio();

if (error) {
  return <ErrorMessage error={error} />;
}
```

### 4. Use SyncedWidget for Complex Widgets

For widgets that need synchronization with other widgets:

```tsx
import { SyncedWidget } from '@/domains/widgets/components/base';

export function MySyncedWidget() {
  return (
    <SyncedWidget
      widgetId="my-widget"
      widgetName="My Widget"
    >
      {(syncProps) => (
        <div>
          <p>Is Playing: {syncProps.isPlaying}</p>
          <p>Tempo: {syncProps.tempo}</p>
        </div>
      )}
    </SyncedWidget>
  );
}
```

## Example Widgets

### Simple Drum Pad

```tsx
export function DrumPad() {
  const { isReady, createSampler } = useAudio();
  const [sampler, setSampler] = useState(null);

  useEffect(() => {
    if (!isReady) return;

    const init = async () => {
      const drums = await createSampler({
        urls: {
          C2: 'kick.mp3',
          D2: 'snare.mp3',
          E2: 'hihat.mp3',
        },
        baseUrl: '/samples/drums/',
      });
      setSampler(drums);
    };

    init();
  }, [isReady]);

  const playDrum = (note: string) => {
    if (sampler) {
      sampler.triggerAttackRelease(note, '16n');
    }
  };

  return (
    <div className="drum-pad">
      <button onClick={() => playDrum('C2')}>Kick</button>
      <button onClick={() => playDrum('D2')}>Snare</button>
      <button onClick={() => playDrum('E2')}>Hi-Hat</button>
    </div>
  );
}
```

### Transport Control

```tsx
export function TransportControl() {
  const { 
    isPlaying, 
    tempo, 
    start, 
    stop, 
    setTempo 
  } = useTransport();

  return (
    <div className="transport-control">
      <button onClick={isPlaying ? stop : start}>
        {isPlaying ? '⏸️' : '▶️'}
      </button>
      
      <input
        type="range"
        min="60"
        max="200"
        value={tempo}
        onChange={(e) => setTempo(Number(e.target.value))}
      />
      <span>{tempo} BPM</span>
    </div>
  );
}
```

## Troubleshooting

### "AudioEngine not available"
- Ensure your component is wrapped with `AudioProvider`
- Check that audio services are initialized

### "Audio not ready"
- Audio initialization happens asynchronously
- Always check `isReady` before audio operations

### Transport not syncing
- Verify you're using the shared transport from `useTransport()`
- Don't create separate Tone.Transport instances

### Memory leaks
- Always dispose of samplers and audio nodes in cleanup
- Use the cleanup function in useEffect

## Migration from Old Pattern

### Before (Old Pattern)
```tsx
import { useTone } from '@/domains/playback/providers/ToneProvider';

function OldWidget() {
  const { Tone, isReady } = useTone();
  
  // Direct Tone.js usage
  const sampler = new Tone.Sampler(...);
}
```

### After (New Pattern)
```tsx
import { useAudio } from '@/domains/playback/hooks';

function NewWidget() {
  const { isReady, createSampler } = useAudio();
  
  // Clean hook usage - no direct Tone.js
  const sampler = await createSampler(...);
}
```

## Summary

With the new professional React hooks:
- ✅ No direct Tone.js usage needed
- ✅ Type-safe audio operations
- ✅ Built-in error handling
- ✅ Automatic cleanup
- ✅ Consistent API across all widgets

You can now create powerful audio widgets in just 5 minutes without worrying about the complexities of audio initialization, context management, or Tone.js internals!