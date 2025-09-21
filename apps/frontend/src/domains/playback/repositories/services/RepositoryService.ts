/**
 * Repository Service
 *
 * Wraps repositories as services for DI integration
 */

import type {
  Service,
  ServiceConfig,
  HealthCheckResult,
} from '../../services/core/ServiceRegistry.js';
import { createPlaybackRepositories } from '../index.js';

/**
 * Wraps a repository as a service
 */
export class RepositoryService implements Service {
  private repositories: ReturnType<typeof createPlaybackRepositories>;
  private isInitialized = false;

  constructor() {
    this.repositories = createPlaybackRepositories();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Repositories don't need initialization, they use localStorage
    this.isInitialized = true;
  }

  async start(): Promise<void> {
    // No-op for repositories
  }

  async stop(): Promise<void> {
    // Clear any caches if needed
    if ('clearCache' in this.repositories.track) {
      this.repositories.track.clearCache();
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async dispose(): Promise<void> {
    // Clear caches and cleanup
    if ('clearCache' in this.repositories.track) {
      this.repositories.track.clearCache();
    }
    this.isInitialized = false;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      // Quick health check - try to access localStorage
      const testKey = '_health_check_';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);

      return {
        status: 'healthy',
        message: 'Repository service is operational',
        details: {
          initialized: this.isInitialized,
          repositoriesAvailable: Object.keys(this.repositories),
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'localStorage is not available',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: Date.now(),
      };
    }
  }

  getConfig(): ServiceConfig {
    return {
      repositoryTypes: Object.keys(this.repositories),
      storageType: 'localStorage',
    };
  }

  async updateConfig(_config: Partial<ServiceConfig>): Promise<void> {
    // No dynamic config for repositories
  }

  // Expose repositories
  getTrackRepository() {
    return this.repositories.track;
  }

  getPluginPresetRepository() {
    return this.repositories.pluginPreset;
  }

  getTransportRepository() {
    return this.repositories.transport;
  }
}
