/**
 * ExerciseLoader - Production MIDI Pipeline
 *
 * This file now re-exports from the modular implementation.
 * The original functionality has been moved to modules/exercises/core/ExerciseLoader.ts
 *
 * Note: The module version no longer implements the Service interface from ServiceRegistry
 * as it's now a standalone module. For Service interface compatibility, use the
 * wrapper classes in the services layer.
 *
 * @deprecated Use imports from '@/domains/playback/modules/exercises' directly
 */

export {
  ExerciseLoader,
  type ExerciseLoaderConfig,
  type LoadResult,
} from '../../modules/exercises/index.js';

// For backward compatibility with Service interface
import { ExerciseLoader as ModuleExerciseLoader } from '../../modules/exercises/index.js';
import type {
  Service,
  ServiceConfig,
  HealthCheckResult,
} from './ServiceRegistry.js';

/**
 * Service wrapper for ExerciseLoader to maintain backward compatibility
 * with ServiceRegistry
 */
export class ExerciseLoaderService implements Service {
  private loader: ModuleExerciseLoader;

  constructor(config: ServiceConfig) {
    this.loader = ModuleExerciseLoader.getInstance(config);
  }

  async initialize(): Promise<void> {
    await this.loader.initialize();
  }

  async start(): Promise<void> {
    // Module version doesn't need start
  }

  async stop(): Promise<void> {
    this.loader.clearCache();
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async dispose(): Promise<void> {
    this.loader.destroy();
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: 'healthy',
      message: 'ExerciseLoader is operating normally',
      metrics: {
        cacheSize: this.loader.getCacheSize(),
      },
    };
  }

  // Delegate all other methods to the module loader
  getLoader(): ModuleExerciseLoader {
    return this.loader;
  }
}
