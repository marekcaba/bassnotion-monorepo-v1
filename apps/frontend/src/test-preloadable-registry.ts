/**
 * Test script for PreloadableInstrumentRegistry
 * Run this in browser console to verify preloading is working
 */

// Get the registry
const registry = (window as any).__preloadableRegistry;
if (!registry) {
  console.log('❌ PreloadableInstrumentRegistry not found in window');
} else {
  console.log('✅ PreloadableInstrumentRegistry found!');
  console.log('Status:', registry.getStatus());
  console.log('All configs:', registry.getAllConfigs());
}

// Check if instruments are registered
const coreServices = (window as any).__globalCoreServices || (window as any).__coreServices;
if (coreServices) {
  const audioEventRouter = coreServices.getAudioEventRouter?.();
  if (audioEventRouter) {
    console.log('AudioEventRouter status:', audioEventRouter.getStatus());
  }

  const instrumentRegistry = coreServices.getInstrumentRegistry?.();
  if (instrumentRegistry) {
    console.log('InstrumentRegistry types:', instrumentRegistry.getRegisteredTypes());
  }
}

export {};