# BassNotion Coding Standards 📏

Follow these standards to keep our codebase clean, consistent, and debuggable.

## 🎯 Golden Rules

1. **Always use pnpm** (never npm or yarn)
2. **Always add correlation IDs** to API calls
3. **Always use structured logging** (never plain console.log)
4. **Always wrap page components in fragments** `<>...</>`
5. **Always memoize callbacks** passed as props

## 📁 File Organization

### Naming Conventions
```
✅ GOOD:
- components/AudioPlayer.tsx      # PascalCase for components
- hooks/useAudioPlayer.ts         # camelCase with 'use' prefix
- utils/formatDuration.ts         # camelCase for utilities
- types/audio.types.ts           # .types.ts for type files
- services/AudioService.ts       # PascalCase for services

❌ BAD:
- components/audio-player.tsx    # Don't use kebab-case
- hooks/AudioPlayer.ts          # Hooks must start with 'use'
- utils/FormatDuration.ts       # Utils should be camelCase
```

### Import Order
```typescript
// 1. External imports
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Absolute imports from @/
import { apiClient } from '@/shared/api/client';
import { Button } from '@/shared/components/ui/button';

// 3. Relative imports with .js extension
import { AudioEngine } from './AudioEngine.js';
import type { AudioConfig } from './types.js';
```

## 🔍 Debugging Standards

### Every Component Must Have
```typescript
export function MyComponent() {
  // 1. Correlation tracking
  const { correlationId, logger } = useCorrelation('MyComponent');
  
  // 2. Debug logging for audio components
  const debug = useAudioDebug('MyComponent');
  
  // 3. Log component lifecycle
  useEffect(() => {
    logger.info('Component mounted');
    return () => logger.info('Component unmounted');
  }, []);
  
  // Your component logic...
}
```

### API Calls Pattern
```typescript
// ✅ GOOD: With correlation and error handling
async function fetchData() {
  const { correlationId, logger } = useCorrelation('DataFetcher');
  
  try {
    logger.info('Fetching data');
    const result = await apiClient.get('/api/data', { correlationId });
    logger.info('Data fetched successfully', { count: result.length });
    return result;
  } catch (error) {
    logger.error('Failed to fetch data', error);
    throw error;
  }
}

// ❌ BAD: No correlation or logging
async function fetchData() {
  return await fetch('/api/data').then(r => r.json());
}
```

## ⚛️ React Best Practices

### Prevent Infinite Loops
```typescript
// ❌ BAD: Infinite re-render
useEffect(() => {
  setData(newData);
}); // Missing dependency array!

// ✅ GOOD: Controlled updates
useEffect(() => {
  setData(newData);
}, [newData.id]); // Only update when ID changes
```

### Memoize Expensive Operations
```typescript
// ❌ BAD: Recalculates every render
const expensiveResult = calculateComplexThing(data);

// ✅ GOOD: Only recalculates when data changes
const expensiveResult = useMemo(() => 
  calculateComplexThing(data), 
  [data]
);
```

### Memoize Callbacks
```typescript
// ❌ BAD: New function every render
<ChildComponent onUpdate={() => handleUpdate(id)} />

// ✅ GOOD: Stable function reference
const handleUpdateCallback = useCallback(() => {
  handleUpdate(id);
}, [id]);
<ChildComponent onUpdate={handleUpdateCallback} />
```

## 🎵 Audio Code Standards

### Audio Component Pattern
```typescript
export function AudioWidget() {
  const { correlationId, logger } = useCorrelation('AudioWidget');
  const debug = useAudioDebug('AudioWidget');
  
  // Log all audio state changes
  const play = useCallback(async () => {
    debug.log('play-start', { time: Date.now() });
    
    try {
      await audioEngine.play();
      debug.log('play-success');
    } catch (error) {
      debug.log('play-error', { error: error.message });
      logger.error('Playback failed', error);
    }
  }, []);
  
  return <button onClick={play}>Play</button>;
}
```

### Sample Loading Pattern
```typescript
async function loadSample(url: string): Promise<AudioBuffer> {
  const { logger } = useCorrelation('SampleLoader');
  
  logger.info('Loading sample', { url });
  
  try {
    // Always check cache first
    const cached = sampleCache.get(url);
    if (cached) {
      logger.info('Using cached sample', { url });
      return cached;
    }
    
    // Load and cache
    const buffer = await fetchAndDecode(url);
    sampleCache.set(url, buffer);
    
    logger.info('Sample loaded', { url, size: buffer.length });
    return buffer;
    
  } catch (error) {
    logger.error('Failed to load sample', error, { url });
    throw new Error(`Cannot load sample: ${url}`);
  }
}
```

## 🧪 Testing Standards

### Test File Naming
```
✅ GOOD:
- Component.test.tsx
- useHook.test.ts
- service.test.ts

❌ BAD:
- Component.spec.tsx  # Use .test.tsx
- test_component.tsx  # Wrong pattern
```

### Test Structure
```typescript
describe('ComponentName', () => {
  // Setup
  const mockProps = {
    id: '123',
    onUpdate: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // Group related tests
  describe('when playing audio', () => {
    it('should log play event', async () => {
      // Arrange
      const { getByRole } = render(<Component {...mockProps} />);
      
      // Act
      fireEvent.click(getByRole('button'));
      
      // Assert
      expect(mockProps.onUpdate).toHaveBeenCalled();
    });
  });
});
```

## 💾 State Management

### Zustand Store Pattern
```typescript
// ✅ GOOD: Typed, with logging
interface AudioStore {
  isPlaying: boolean;
  volume: number;
  setPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
}

export const useAudioStore = create<AudioStore>((set) => ({
  isPlaying: false,
  volume: 0.8,
  
  setPlaying: (playing) => {
    logAudioEvent('AudioStore', 'setPlaying', { playing });
    set({ isPlaying: playing });
  },
  
  setVolume: (volume) => {
    logAudioEvent('AudioStore', 'setVolume', { volume });
    set({ volume });
  }
}));
```

## 📝 Documentation Standards

### Component Documentation
```typescript
/**
 * AudioPlayer - Main audio playback component
 * 
 * @example
 * <AudioPlayer
 *   trackId="123"
 *   onPlaybackEnd={() => console.log('finished')}
 * />
 */
interface AudioPlayerProps {
  /** Unique track identifier */
  trackId: string;
  /** Callback fired when playback completes */
  onPlaybackEnd?: () => void;
}

export function AudioPlayer({ trackId, onPlaybackEnd }: AudioPlayerProps) {
  // Implementation...
}
```

### Function Documentation
```typescript
/**
 * Loads and decodes an audio sample from URL
 * 
 * @param url - The URL of the audio file
 * @returns Decoded AudioBuffer ready for playback
 * @throws Error if loading fails or format unsupported
 * 
 * @example
 * const buffer = await loadSample('/samples/kick.mp3');
 */
async function loadSample(url: string): Promise<AudioBuffer> {
  // Implementation...
}
```

## 🚫 What NOT to Do

### Never Do These
```typescript
// ❌ Direct console.log
console.log('Something happened');

// ❌ Catch without logging
try {
  await riskyOperation();
} catch (error) {
  // Silent failure!
}

// ❌ Modify state during render
function Component() {
  if (someCondition) {
    setState(newValue); // NEVER!
  }
  return <div>...</div>;
}

// ❌ Forget cleanup
useEffect(() => {
  const timer = setInterval(() => {}, 1000);
  // Missing: return () => clearInterval(timer);
}, []);
```

## ✅ Code Review Checklist

Before submitting a PR, check:

- [ ] All API calls have correlation IDs
- [ ] Used structured logging (no console.log)
- [ ] Audio operations have debug logging
- [ ] Callbacks are memoized
- [ ] useEffects have dependency arrays
- [ ] No state updates during render
- [ ] Cleanup in useEffect returns
- [ ] Error handling with logging
- [ ] Types are properly defined
- [ ] Tests are included

## 🎨 Formatting

We use Prettier with these settings:
```json
{
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "semi": true,
  "printWidth": 80
}
```

Run before committing:
```bash
pnpm lint:fix
```

---

Remember: **Consistency > Personal Preference**

When in doubt, follow existing patterns in the codebase.

*Last updated: August 30, 2025*