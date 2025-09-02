/**
 * Optimized AudioEngine with selective Tone.js imports
 * Reduces bundle size and initialization time
 */

export class OptimizedToneLoader {
  private static loadedModules = new Map<string, any>();

  /**
   * Load only required Tone.js modules
   */
  static async loadMinimalTone() {
    // Instead of importing entire Tone.js, import only what's needed
    const [{ Transport }, { Context }, { Sampler }, { start }] =
      await Promise.all([
        import('tone/build/esm/core/clock/Transport'),
        import('tone/build/esm/core/context/Context'),
        import('tone/build/esm/instrument/Sampler'),
        import('tone/build/esm/core/Global'),
      ]);

    return {
      Transport,
      Context,
      Sampler,
      start,
    };
  }

  /**
   * Lazy load additional modules as needed
   */
  static async loadModule(moduleName: string) {
    if (this.loadedModules.has(moduleName)) {
      return this.loadedModules.get(moduleName);
    }

    const moduleMap: Record<string, () => Promise<any>> = {
      Reverb: () => import('tone/build/esm/effect/Reverb'),
      Filter: () => import('tone/build/esm/component/Filter'),
      Compressor: () => import('tone/build/esm/component/Compressor'),
      // Add more as needed
    };

    if (moduleMap[moduleName]) {
      const module = await moduleMap[moduleName]();
      this.loadedModules.set(moduleName, module);
      return module;
    }

    throw new Error(`Unknown Tone.js module: ${moduleName}`);
  }
}
