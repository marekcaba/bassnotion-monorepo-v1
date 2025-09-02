/**
 * Test script to verify all audio components use the same persistent context
 */

import { getPersistentAudioContext, getAudioContextInfo } from '../domains/playback/utils/audioContext';

export function verifyPersistentContext() {
  console.log('=== Verifying Persistent Audio Context Usage ===');
  
  // Check persistent context
  const persistentContext = getPersistentAudioContext();
  const contextInfo = getAudioContextInfo();
  
  console.log('Persistent Context Info:', contextInfo);
  
  if (!persistentContext) {
    console.error('❌ No persistent context found!');
    return false;
  }
  
  // Check Tone.js context
  const Tone = (window as any).Tone;
  if (Tone && Tone.context) {
    const toneContext = Tone.context._context || 
                       Tone.context._nativeAudioContext || 
                       Tone.context.rawContext;
    
    console.log('Tone.js Context Check:', {
      hasTone: true,
      toneContextSame: toneContext === persistentContext,
      toneContextType: toneContext?.constructor?.name,
      toneState: toneContext?.state
    });
    
    if (toneContext !== persistentContext) {
      console.warn('⚠️ Tone.js is using a different context!');
    }
  }
  
  // Check AudioEngine context
  const AudioEngine = (window as any).__AudioEngine;
  if (AudioEngine && AudioEngine.globalContext) {
    console.log('AudioEngine Context Check:', {
      hasAudioEngine: true,
      engineContextSame: AudioEngine.globalContext === persistentContext,
      engineContextType: AudioEngine.globalContext?.constructor?.name,
      engineState: AudioEngine.globalContext?.state
    });
    
    if (AudioEngine.globalContext !== persistentContext) {
      console.warn('⚠️ AudioEngine is using a different context!');
    }
  }
  
  // Check global core services
  const globalServices = (window as any).__globalCoreServices || (window as any).__coreServices;
  if (globalServices && globalServices.getAudioEngine) {
    const audioEngine = globalServices.getAudioEngine();
    if (audioEngine && audioEngine.getContext) {
      try {
        const serviceContext = audioEngine.getContext();
        console.log('Core Services Context Check:', {
          hasServices: true,
          serviceContextSame: serviceContext === persistentContext,
          serviceContextType: serviceContext?.constructor?.name,
          serviceState: serviceContext?.state
        });
        
        if (serviceContext !== persistentContext) {
          console.warn('⚠️ Core services are using a different context!');
        }
      } catch (e) {
        console.log('Core services not ready:', e);
      }
    }
  }
  
  // Check all contexts on window
  console.log('\nAll Audio Contexts on Window:');
  const windowContexts = [];
  
  if ((window as any).__persistentAudioContext) {
    windowContexts.push({
      name: '__persistentAudioContext',
      context: (window as any).__persistentAudioContext,
      state: (window as any).__persistentAudioContext.state
    });
  }
  
  if (AudioEngine && AudioEngine.globalContext) {
    windowContexts.push({
      name: 'AudioEngine.globalContext',
      context: AudioEngine.globalContext,
      state: AudioEngine.globalContext.state
    });
  }
  
  if (Tone && Tone.context) {
    const toneCtx = Tone.context._context || Tone.context._nativeAudioContext || Tone.context.rawContext;
    if (toneCtx) {
      windowContexts.push({
        name: 'Tone.context',
        context: toneCtx,
        state: toneCtx.state
      });
    }
  }
  
  // Check if all contexts are the same instance
  const uniqueContexts = new Set(windowContexts.map(c => c.context));
  console.log(`Found ${windowContexts.length} contexts, ${uniqueContexts.size} unique`);
  
  windowContexts.forEach((ctx, i) => {
    console.log(`${i + 1}. ${ctx.name}: ${ctx.state} (${ctx.context})`);
  });
  
  if (uniqueContexts.size > 1) {
    console.error('❌ Multiple AudioContext instances detected! This will cause buffer and connection errors.');
    return false;
  }
  
  console.log('✅ All components using the same persistent AudioContext');
  return true;
}

// Attach to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).verifyPersistentContext = verifyPersistentContext;
}