#!/bin/bash
# Auto-generated migration script
# Phase 6.1.2: Update to use new modular imports

set -e

echo "🔄 Starting god object import migration..."


# Migrate SupabaseAssetClient imports
echo "Migrating SupabaseAssetClient imports..."

# TODO: Update test file manually: apps/frontend/src/domains/playback/services/storage/__tests__/AdaptiveAudioStreamer.behavior.test.ts
# TODO: Update test file manually: apps/frontend/src/domains/playback/services/storage/__tests__/SupabaseAssetClient.test.ts
# TODO: Update test file manually: apps/frontend/src/domains/playback/services/storage/__tests__/AudioSampleManager.test.ts
# TODO: Update test file manually: apps/frontend/src/domains/playback/services/__tests__/AudioPipeline.integration.test.ts

# Migrate MidiParserProcessor imports
echo "Migrating MidiParserProcessor imports..."

sed -i.bak 's|services/plugins/MidiParserProcessor|modules/midi/MidiParserProcessor|g' "apps/frontend/src/domains/playback/modules/midi/examples/UsingDynamicMidiLoader.ts"
sed -i.bak 's|services/plugins/MidiParserProcessor|modules/midi/MidiParserProcessor|g' "apps/frontend/src/domains/playback/modules/intelligence/MusicalContextAnalyzer.ts"
sed -i.bak 's|services/plugins/MidiParserProcessor|modules/midi/MidiParserProcessor|g' "apps/frontend/src/domains/playback/modules/exercises/core/ExerciseLoader.ts"
# TODO: Update test file manually: apps/frontend/src/domains/playback/services/__tests__/BassInstrumentProcessor.behavior.test.ts
# TODO: Update test file manually: apps/frontend/src/domains/playback/services/__tests__/MusicalContextAnalyzer.behavior.test.ts
# TODO: Update test file manually: apps/frontend/src/domains/playback/modules/midi/__tests__/MidiParserProcessor.behavior.test.ts
sed -i.bak 's|services/plugins/MidiParserProcessor|modules/midi/MidiParserProcessor|g' "apps/frontend/src/domains/playback/modules/midi/MidiParserProcessor.ts"
sed -i.bak 's|services/plugins/MidiParserProcessor|modules/midi/MidiParserProcessor|g' "apps/frontend/src/domains/playback/modules/midi/MidiParserProcessor.ts"
sed -i.bak 's|services/plugins/MidiParserProcessor|modules/midi/MidiParserProcessor|g' "apps/frontend/src/domains/playback/services/plugins/index.ts"

# Migrate MetronomeInstrumentProcessor imports
echo "Migrating MetronomeInstrumentProcessor imports..."

sed -i.bak 's|services/plugins/MetronomeInstrumentProcessor|modules/instruments/implementations/metronome/MetronomeInstrumentProcessor|g' "apps/frontend/src/domains/playback/services/core/AudioEventRouter.ts"
# TODO: Update test file manually: apps/frontend/src/domains/playback/services/__tests__/InstrumentLifecycleManager.behavior.test.ts
sed -i.bak 's|services/plugins/MetronomeInstrumentProcessor|modules/instruments/implementations/metronome/MetronomeInstrumentProcessor|g' "apps/frontend/src/domains/playback/modules/shared/legacy-bridge.ts"
sed -i.bak 's|services/plugins/MetronomeInstrumentProcessor|modules/instruments/implementations/metronome/MetronomeInstrumentProcessor|g' "apps/frontend/src/domains/playback/modules/shared/legacy-bridge.ts"
sed -i.bak 's|services/plugins/MetronomeInstrumentProcessor|modules/instruments/implementations/metronome/MetronomeInstrumentProcessor|g' "apps/frontend/src/domains/playback/modules/instruments/implementations/metronome/EnhancedMetronomeProcessor.ts"
# TODO: Update test file manually: apps/frontend/src/domains/playback/modules/instruments/implementations/metronome/__tests__/MetronomeInstrumentProcessor.behavior.test.ts
sed -i.bak 's|services/plugins/MetronomeInstrumentProcessor|modules/instruments/implementations/metronome/MetronomeInstrumentProcessor|g' "apps/frontend/src/domains/playback/services/plugins/index.ts"
# TODO: Update test file manually: apps/frontend/src/domains/playback/services/__tests__/MetronomeInstrumentProcessor.behavior.test.ts

# Migrate SalamanderVelocitySampler imports
echo "Migrating SalamanderVelocitySampler imports..."

sed -i.bak 's|services/plugins/SalamanderVelocitySampler|modules/instruments/implementations/harmony/SalamanderVelocitySampler|g' "apps/frontend/src/domains/playback/modules/instruments/adapters/wam/WamKeyboard.ts"
# TODO: Update test file manually: apps/frontend/src/domains/playback/services/plugins/__tests__/SalamanderVelocitySampler.test.ts
# TODO: Update test file manually: apps/frontend/src/domains/playback/services/plugins/__tests__/ToneAudioRouting.integration.test.ts
sed -i.bak 's|services/plugins/SalamanderVelocitySampler|modules/instruments/implementations/harmony/SalamanderVelocitySampler|g' "apps/frontend/src/domains/playback/modules/instruments/implementations/harmony/index.ts"

# Migrate RhodesVelocitySampler imports
echo "Migrating RhodesVelocitySampler imports..."

sed -i.bak 's|services/plugins/RhodesVelocitySampler|modules/instruments/implementations/harmony/RhodesVelocitySampler|g' "apps/frontend/src/domains/playback/modules/instruments/adapters/wam/WamKeyboard.ts"
sed -i.bak 's|services/plugins/RhodesVelocitySampler|modules/instruments/implementations/harmony/RhodesVelocitySampler|g' "apps/frontend/src/domains/playback/modules/instruments/implementations/harmony/index.ts"

# Migrate WurlitzerVelocitySampler imports
echo "Migrating WurlitzerVelocitySampler imports..."

sed -i.bak 's|services/plugins/WurlitzerVelocitySampler|modules/instruments/implementations/harmony/WurlitzerVelocitySampler|g' "apps/frontend/src/domains/playback/modules/instruments/adapters/wam/WamKeyboard.ts"
sed -i.bak 's|services/plugins/WurlitzerVelocitySampler|modules/instruments/implementations/harmony/WurlitzerVelocitySampler|g' "apps/frontend/src/domains/playback/modules/instruments/implementations/harmony/index.ts"

echo "✅ Migration complete!"
echo "⚠️  Please review the changes and run tests before committing"
