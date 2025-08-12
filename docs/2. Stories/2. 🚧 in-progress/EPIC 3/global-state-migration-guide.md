# Global State Migration Guide
**Story 3.18.3: Global State Elimination**

## Overview

This guide documents the migration from global state patterns to clean dependency injection in the BassNotion playback domain.

## Migration Status

### Phase 1: Feature Flags & Infrastructure ✅
- [x] Feature flag system implemented (`featureFlags.ts`)
- [x] New AudioProvider created with ServiceRegistry
- [x] Migration helper utilities created
- [x] Audit script for verification

### Phase 2: Global State Removal 🚧
- [x] Removed `window.ToneSingleton` from ToneInstanceManager
- [x] Removed `window.ToneInstanceId` patterns
- [x] Deprecated global AudioContext manipulation in toneSetup.ts
- [ ] Remove direct AudioContext creation in:
  - [ ] AudioSampleManager
  - [ ] HybridDrumSampleManager  
  - [ ] ChordInstrumentProcessor

### Phase 3: Direct Tone.js Import Elimination 🚧
Files requiring migration (18 total):
1. [ ] `/services/PluginManager.ts`
2. [ ] `/services/MixingConsole.ts`
3. [ ] `/services/IntelligentTempoController.ts`
4. [ ] `/services/ProfessionalPlaybackController.ts`
5. [ ] `/services/ComprehensiveStateManager.ts`
6. [ ] `/services/TranspositionController.ts`
7. [ ] `/services/QualityTransitionManager.ts`
8. [ ] `/services/plugins/BassProcessor.ts`
9. [ ] `/services/plugins/EnhancedChordProcessor.ts`
10. [ ] `/services/plugins/EnhancedMetronomeProcessor.ts`
11. [ ] `/services/plugins/SyncProcessor.ts`
12. [ ] `/services/plugins/ChordInstrumentProcessor-velocity.ts`
13. [ ] `/services/plugins/examples/organ-synthesis.ts`
14. [ ] `/services/plugins/examples/pad-synthesis.ts`
15. [ ] `/services/UnifiedTransportController/types.ts`
16. [ ] `/types/plugin.ts`
17. [ ] `/utils/tone.ts`
18. [ ] Test files (lower priority)

### Phase 4: Service Deletion 📋
- [ ] Delete ToneInstanceManager.ts
- [ ] Delete AudioContextManager.ts
- [ ] Delete ToneProvider.tsx (after all components migrated)

## Migration Patterns

### Before: Direct Tone Import
```typescript
import * as Tone from 'tone';

class MyService {
  private sampler: Tone.Sampler;
  
  constructor() {
    this.sampler = new Tone.Sampler({...});
  }
}
```

### After: Dependency Injection
```typescript
import { AudioEngine } from '../core/AudioEngine.js';

class MyService {
  private sampler: any;
  
  constructor(private audioEngine: AudioEngine) {
    const Tone = this.audioEngine.getTone();
    this.sampler = new Tone.Sampler({...});
  }
}
```

### Component Migration Pattern

#### Before: Using ToneProvider
```tsx
import { useTone } from '../providers/ToneProvider';

function MyComponent() {
  const { Tone, isReady } = useTone();
  // ...
}
```

#### After: Using AudioProvider
```tsx
import { useAudioEngine } from '../providers/AudioProvider';

function MyComponent() {
  const audioEngine = useAudioEngine();
  const Tone = audioEngine.getTone();
  // ...
}
```

## Rollback Procedures

### Immediate Rollback (< 1 minute)
1. Set environment variable: `NEXT_PUBLIC_ROLLBACK_AUDIO=true`
2. Restart the application
3. All services will use legacy providers

### Full Rollback (< 5 minutes)
1. Restore deleted files from git:
   ```bash
   git checkout HEAD~1 -- apps/frontend/src/domains/playback/services/ToneInstanceManager.ts
   git checkout HEAD~1 -- apps/frontend/src/domains/playback/services/AudioContextManager.ts
   ```
2. Set rollback flag: `NEXT_PUBLIC_ROLLBACK_AUDIO=true`
3. Deploy the reverted code

### Gradual Rollout Control
```bash
# Start with 10% of users
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=10

# Increase gradually
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=25
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=50
NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE=100
```

## Verification

Run the audit script to verify no global state:
```bash
pnpm tsx apps/frontend/src/domains/playback/scripts/auditGlobalState.ts
```

Expected output:
```
✅ PASS: No global state patterns found!
The playback domain is clean of global state pollution.
```

## Performance Monitoring

Monitor these metrics during rollout:
1. **Audio latency**: Should remain < 10ms
2. **Memory usage**: Should decrease (no duplicate contexts)
3. **CPU usage**: Should remain stable
4. **Error rate**: Monitor for AudioContext errors

## Troubleshooting

### Common Issues

1. **"AudioEngine not initialized"**
   - Ensure AudioProvider wraps your component tree
   - Check that services are accessed after initialization

2. **"Cannot read property 'Sampler' of null"**
   - Service is trying to use Tone before AudioEngine is ready
   - Add proper initialization checks

3. **Multiple AudioContext warnings**
   - Check for services creating their own AudioContext
   - All audio should go through AudioEngine

### Debug Helpers

Enable migration monitoring:
```typescript
// In your app initialization
import { logMigrationEvent } from '../config/featureFlags';

logMigrationEvent('app-start', { 
  version: process.env.NEXT_PUBLIC_APP_VERSION 
});
```

## Architecture Benefits

### Before (Anti-Patterns)
- 🚫 Global state pollution
- 🚫 Multiple AudioContext instances
- 🚫 Tight coupling to Tone.js
- 🚫 Hard to test
- 🚫 Memory leaks from globals

### After (Clean Architecture)
- ✅ Zero global state
- ✅ Single AudioContext via AudioEngine
- ✅ Clean dependency injection
- ✅ Easy to test with mocks
- ✅ Proper lifecycle management
- ✅ FAANG-quality architecture