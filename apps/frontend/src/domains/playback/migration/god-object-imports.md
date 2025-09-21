# God Object Import Report

Generated: 2025-09-15T22:26:09.085Z

## SupabaseAssetClient

- **Original Path**: services/storage/SupabaseAssetClient
- **New Path**: services/storage/SupabaseAssetClientFacade
- **Import Count**: 6

### Files using this import:

#### apps/frontend/src/domains/playback/services/storage/__tests__/AdaptiveAudioStreamer.behavior.test.ts

- Line 9: `import { SupabaseAssetClient } from '../SupabaseAssetClient';`

#### apps/frontend/src/domains/playback/services/storage/__tests__/SupabaseAssetClient.test.ts

- Line 2: `import { SupabaseAssetClient, StorageError } from '../SupabaseAssetClient';`

#### apps/frontend/src/domains/playback/services/storage/__tests__/AudioSampleManager.test.ts

- Line 9: `import { SupabaseAssetClient } from '../SupabaseAssetClient';`

#### apps/frontend/src/domains/playback/services/__tests__/AudioPipeline.integration.test.ts

- Line 84: `import { SupabaseAssetClient } from '../storage/SupabaseAssetClient.js';`

#### apps/frontend/src/domains/playback/modules/storage/cdn/CDNOptimizer.ts

- Line 5: `* and performance monitoring. Extracted from SupabaseAssetClient for`

#### apps/frontend/src/shared/infrastructure/storage/client/SupabaseClientManager.ts

- Line 7: `* Extracted from SupabaseAssetClient to provide reusable`

## MidiParserProcessor

- **Original Path**: services/plugins/MidiParserProcessor
- **New Path**: modules/midi/MidiParserProcessor
- **Import Count**: 11

### Files using this import:

#### apps/frontend/src/domains/playback/modules/midi/examples/UsingDynamicMidiLoader.ts

- Line 9: `import { MidiParserProcessor } from '../MidiParserProcessor.refactored.js';`

#### apps/frontend/src/domains/playback/modules/intelligence/MusicalContextAnalyzer.ts

- Line 10: `import { type ParsedMidiData, type ParsedTrack } from '../midi/MidiParserProcessor.js';`

#### apps/frontend/src/domains/playback/modules/exercises/core/ExerciseLoader.ts

- Line 22: `import { MidiParserProcessor } from '../../midi/MidiParserProcessor.js';`

#### apps/frontend/src/domains/playback/services/__tests__/BassInstrumentProcessor.behavior.test.ts

- Line 61: `import { ArticulationType } from '../plugins/MidiParserProcessor';`

#### apps/frontend/src/domains/playback/services/__tests__/MusicalContextAnalyzer.behavior.test.ts

- Line 15: `import type { ParsedMidiData } from '../plugins/MidiParserProcessor';`
- Line 16: `import { TrackType } from '../plugins/MidiParserProcessor';`

#### apps/frontend/src/domains/playback/modules/midi/parser/MidiFileParser.ts

- Line 5: `* Extracted from MidiParserProcessor for better modularity`

#### apps/frontend/src/domains/playback/modules/midi/__tests__/MidiParserProcessor.behavior.test.ts

- Line 21: `} from '../plugins/MidiParserProcessor';`

#### apps/frontend/src/domains/playback/modules/midi/MidiParserProcessor.ts

- Line 47: `} from './MidiParserProcessor.js';`
- Line 50: `export * from './MidiParserProcessor.js';`

#### apps/frontend/src/domains/playback/services/plugins/index.ts

- Line 18: `export { MidiParserProcessor } from '../../modules/midi/MidiParserProcessor.js';`

## MetronomeInstrumentProcessor

- **Original Path**: services/plugins/MetronomeInstrumentProcessor
- **New Path**: modules/instruments/implementations/metronome/MetronomeInstrumentProcessor
- **Import Count**: 9

### Files using this import:

#### apps/frontend/src/domains/playback/services/core/AudioEventRouter.ts

- Line 11: `import { MetronomeInstrumentProcessor } from '../plugins/MetronomeInstrumentProcessor.js';`

#### apps/frontend/src/domains/playback/services/core/PluginManager.ts

- Line 562: `import('../plugins/MetronomeInstrumentProcessor.js'),`

#### apps/frontend/src/domains/playback/services/__tests__/InstrumentLifecycleManager.behavior.test.ts

- Line 17: `import { MetronomeInstrumentProcessor } from '../plugins/MetronomeInstrumentProcessor';`

#### apps/frontend/src/domains/playback/modules/shared/legacy-bridge.ts

- Line 27: `export { MetronomeInstrumentProcessor } from '../instruments/implementations/metronome/MetronomeInstrumentProcessor.js';`
- Line 28: `export type { ClickSoundType } from '../instruments/implementations/metronome/MetronomeInstrumentProcessor.js';`

#### apps/frontend/src/domains/playback/modules/instruments/implementations/metronome/EnhancedMetronomeProcessor.ts

- Line 15: `} from './MetronomeInstrumentProcessor.js';`

#### apps/frontend/src/domains/playback/modules/instruments/implementations/metronome/__tests__/MetronomeInstrumentProcessor.behavior.test.ts

- Line 66: `} from '../plugins/MetronomeInstrumentProcessor';`

#### apps/frontend/src/domains/playback/services/plugins/index.ts

- Line 22: `export { MetronomeInstrumentProcessor } from '../../modules/instruments/implementations/metronome/MetronomeInstrumentProcessor.js';`

#### apps/frontend/src/domains/playback/services/__tests__/MetronomeInstrumentProcessor.behavior.test.ts

- Line 66: `} from '../plugins/MetronomeInstrumentProcessor';`

## SalamanderVelocitySampler

- **Original Path**: services/plugins/SalamanderVelocitySampler
- **New Path**: modules/instruments/implementations/harmony/SalamanderVelocitySampler
- **Import Count**: 4

### Files using this import:

#### apps/frontend/src/domains/playback/modules/instruments/adapters/wam/WamKeyboard.ts

- Line 27: `import { SalamanderVelocitySampler } from '../../implementations/harmony/SalamanderVelocitySampler.js';`

#### apps/frontend/src/domains/playback/services/plugins/__tests__/SalamanderVelocitySampler.test.ts

- Line 8: `import { SalamanderVelocitySampler } from '../../../modules/instruments/implementations/harmony/SalamanderVelocitySampler';`

#### apps/frontend/src/domains/playback/services/plugins/__tests__/ToneAudioRouting.integration.test.ts

- Line 2: `import { SalamanderVelocitySampler } from '../../../modules/instruments/implementations/harmony/SalamanderVelocitySampler';`

#### apps/frontend/src/domains/playback/modules/instruments/implementations/harmony/index.ts

- Line 7: `export { SalamanderVelocitySampler } from './SalamanderVelocitySampler.js';`

## RhodesVelocitySampler

- **Original Path**: services/plugins/RhodesVelocitySampler
- **New Path**: modules/instruments/implementations/harmony/RhodesVelocitySampler
- **Import Count**: 2

### Files using this import:

#### apps/frontend/src/domains/playback/modules/instruments/adapters/wam/WamKeyboard.ts

- Line 28: `import { RhodesVelocitySampler } from '../../implementations/harmony/RhodesVelocitySampler.js';`

#### apps/frontend/src/domains/playback/modules/instruments/implementations/harmony/index.ts

- Line 8: `export { RhodesVelocitySampler, rhodesPiano } from './RhodesVelocitySampler.js';`

## WurlitzerVelocitySampler

- **Original Path**: services/plugins/WurlitzerVelocitySampler
- **New Path**: modules/instruments/implementations/harmony/WurlitzerVelocitySampler
- **Import Count**: 2

### Files using this import:

#### apps/frontend/src/domains/playback/modules/instruments/adapters/wam/WamKeyboard.ts

- Line 29: `import { WurlitzerVelocitySampler } from '../../implementations/harmony/WurlitzerVelocitySampler.js';`

#### apps/frontend/src/domains/playback/modules/instruments/implementations/harmony/index.ts

- Line 9: `export { WurlitzerVelocitySampler } from './WurlitzerVelocitySampler.js';`


## Summary

- **Total God Object Imports**: 34
- **Critical Files to Update**: 14
- **Test Files**: 20

### Critical Files (Non-Test):

- apps/frontend/src/domains/playback/modules/exercises/core/ExerciseLoader.ts
- apps/frontend/src/domains/playback/modules/instruments/adapters/wam/WamKeyboard.ts
- apps/frontend/src/domains/playback/modules/instruments/implementations/harmony/index.ts
- apps/frontend/src/domains/playback/modules/instruments/implementations/metronome/EnhancedMetronomeProcessor.ts
- apps/frontend/src/domains/playback/modules/intelligence/MusicalContextAnalyzer.ts
- apps/frontend/src/domains/playback/modules/midi/MidiParserProcessor.ts
- apps/frontend/src/domains/playback/modules/midi/examples/UsingDynamicMidiLoader.ts
- apps/frontend/src/domains/playback/modules/midi/parser/MidiFileParser.ts
- apps/frontend/src/domains/playback/modules/shared/legacy-bridge.ts
- apps/frontend/src/domains/playback/modules/storage/cdn/CDNOptimizer.ts
- apps/frontend/src/domains/playback/services/core/AudioEventRouter.ts
- apps/frontend/src/domains/playback/services/core/PluginManager.ts
- apps/frontend/src/domains/playback/services/plugins/index.ts
- apps/frontend/src/shared/infrastructure/storage/client/SupabaseClientManager.ts
