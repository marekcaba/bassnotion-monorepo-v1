/**
 * Diagnostic script to trace the complete audio flow
 * from HarmonyWidget mounting to audio output
 */

export function diagnoseAudioFlow() {
  console.log('\n=== AUDIO FLOW DIAGNOSTIC ===\n');

  // 1. Check Persistent Context
  console.log('1. PERSISTENT CONTEXT CHECK:');
  const persistentContext = (window as any).__persistentAudioContext;
  console.log('   - Has persistent context:', !!persistentContext);
  if (persistentContext) {
    console.log('   - State:', persistentContext.state);
    console.log('   - Sample rate:', persistentContext.sampleRate);
    console.log('   - Current time:', persistentContext.currentTime);
  }

  // 2. Check Tone.js Context
  console.log('\n2. TONE.JS CONTEXT CHECK:');
  const Tone = (window as any).Tone;
  if (Tone && Tone.context) {
    const toneCtx =
      Tone.context._context ||
      Tone.context._nativeAudioContext ||
      Tone.context.rawContext;
    console.log('   - Has Tone.js:', true);
    console.log(
      '   - Tone context same as persistent:',
      toneCtx === persistentContext,
    );
    console.log('   - Tone context state:', Tone.context.state);
    console.log(
      '   - Tone Destination volume:',
      Tone.Destination?.volume?.value,
    );
    console.log('   - Tone Destination muted:', Tone.Destination?.mute);
  }

  // 3. Check WAM Plugin Singleton
  console.log('\n3. WAM PLUGIN SINGLETON:');
  const wamSingleton = (window as any).wamPluginSingleton;
  if (wamSingleton) {
    const pluginInfo = wamSingleton.getPluginInfo();
    console.log('   - Plugin info:', pluginInfo);
  }

  // 4. Check GlobalSampleCache
  console.log('\n4. GLOBAL SAMPLE CACHE:');
  const GlobalSampleCache =
    (window as any).GlobalSampleCache ||
    require('@/domains/playback/services/storage/GlobalSampleCache')
      .GlobalSampleCache;
  if (GlobalSampleCache) {
    const stats = GlobalSampleCache.getStats();
    console.log('   - Cache stats:', stats);
    const instrumentNames = GlobalSampleCache.getCachedInstrumentNames();
    console.log('   - Cached instruments:', instrumentNames);

    // Check for pre-loaded harmony
    const preloaded =
      GlobalSampleCache.getCachedInstrument('harmony-preloaded');
    console.log('   - Has pre-loaded harmony:', !!preloaded);
    if (preloaded && preloaded.audioNode) {
      console.log('   - Pre-loaded context:', preloaded.audioNode.context);
      console.log(
        '   - Pre-loaded connected:',
        preloaded.audioNode.isConnected,
      );
    }
  }

  // 5. Check Audio Flow Path
  console.log('\n5. AUDIO FLOW PATH:');
  console.log('   HarmonyWidget -> useTrack() hook');
  console.log('   -> wamPluginSingleton.getOrCreateKeyboardPlugin(context)');
  console.log('   -> WamKeyboard.createInstance(context)');
  console.log('   -> WamKeyboardNode.initialize()');
  console.log('   -> WamKeyboardNode.loadInstrument(SALAMANDER_PIANO)');
  console.log('   -> new SalamanderVelocitySampler()');
  console.log('   -> sampler.initialize() -> loads Tone.Sampler instances');
  console.log('   -> sampler.connect(gainNode)');
  console.log('   -> gainNode.connect(context.destination)');

  // 6. Test Audio Chain
  console.log('\n6. AUDIO CHAIN TEST:');

  // Find a harmony widget plugin
  let harmonyPlugin = null;

  // Check via singleton
  if (wamSingleton) {
    const pluginInfo = wamSingleton.plugins?.get('wam-keyboard');
    if (pluginInfo) {
      harmonyPlugin = pluginInfo.plugin;
      console.log('   - Found plugin via singleton');
    }
  }

  // Check global cache
  if (!harmonyPlugin && GlobalSampleCache) {
    harmonyPlugin =
      GlobalSampleCache.getCachedInstrument('wam-keyboard-singleton') ||
      GlobalSampleCache.getCachedInstrument('harmony-preloaded');
    if (harmonyPlugin) {
      console.log('   - Found plugin via GlobalSampleCache');
    }
  }

  if (harmonyPlugin && harmonyPlugin.audioNode) {
    const audioNode = harmonyPlugin.audioNode;
    console.log('\n   AUDIO NODE STATUS:');
    console.log('   - Has audio node:', true);
    console.log('   - Is connected:', audioNode.isConnected);
    console.log('   - Gain value:', audioNode.gainNode?.gain?.value);
    console.log('   - Has active sampler:', !!audioNode.activeSampler);
    console.log('   - Context state:', audioNode.context?.state);

    if (audioNode.activeSampler) {
      const sampler = audioNode.activeSampler;
      console.log('\n   ACTIVE SAMPLER STATUS:');
      console.log('   - Type:', sampler.constructor?.name);
      console.log(
        '   - Has getStatus:',
        typeof sampler.getStatus === 'function',
      );

      if (sampler.getStatus) {
        const status = sampler.getStatus();
        console.log('   - Status:', status);
      }

      // Check sampler connection
      console.log('   - Sampler destination:', sampler.destination);
      console.log(
        '   - Connected to gain:',
        sampler.destination === audioNode.gainNode,
      );
    }
  } else {
    console.log('   ❌ No harmony plugin found for testing');
  }

  // 7. Recommendations
  console.log('\n7. DIAGNOSTIC SUMMARY:');

  const issues = [];

  if (!persistentContext) {
    issues.push('No persistent audio context found');
  }

  if (Tone && persistentContext) {
    const toneCtx =
      Tone.context._context ||
      Tone.context._nativeAudioContext ||
      Tone.context.rawContext;
    if (toneCtx !== persistentContext) {
      issues.push('Tone.js using different context than persistent');
    }
  }

  if (
    harmonyPlugin &&
    harmonyPlugin.audioNode &&
    !harmonyPlugin.audioNode.isConnected
  ) {
    issues.push('Harmony plugin audio node not connected');
  }

  if (issues.length === 0) {
    console.log('   ✅ Audio flow appears to be correctly configured');
  } else {
    console.log('   ❌ Issues found:');
    issues.forEach((issue) => console.log(`      - ${issue}`));
  }

  console.log('\n=== END DIAGNOSTIC ===\n');
}

// Attach to window for console access
if (typeof window !== 'undefined') {
  (window as any).diagnoseAudioFlow = diagnoseAudioFlow;
}
