/**
 * Register Repositories with ServiceRegistry
 *
 * Integrates the repository pattern with the existing DI system
 */

import { serviceRegistry } from '../../services/core/ServiceRegistry.js';
import { RepositoryService } from './RepositoryService.js';
import { createStructuredLogger } from '../../modules/shared/index.js';

const logger = createStructuredLogger('RepositoryRegistration');

/**
 * Register all playback repositories with the service registry
 */
export async function registerPlaybackRepositories(): Promise<void> {
  try {
    // Check if repositories are already registered
    try {
      const existing = serviceRegistry.get('repositoryService');
      if (existing) {
        logger.info('Repository service already registered');
        return;
      }
    } catch {
      // Not registered yet, continue
    }

    // Create and register repository service
    const repositoryService = new RepositoryService();

    // Register the main repository service
    serviceRegistry.register('repositoryService', repositoryService);

    // Also register individual repository accessors for convenience
    serviceRegistry.register('trackRepository', {
      getRepository: () => repositoryService.getTrackRepository(),
    } as any);

    serviceRegistry.register('pluginPresetRepository', {
      getRepository: () => repositoryService.getPluginPresetRepository(),
    } as any);

    serviceRegistry.register('transportRepository', {
      getRepository: () => repositoryService.getTransportRepository(),
    } as any);

    logger.info('Playback repositories registered successfully');
  } catch (error) {
    logger.error('Failed to register playback repositories', error as Error);
    throw error;
  }
}

/**
 * Get repository service from the registry
 */
export function getRepositoryService(): RepositoryService {
  return serviceRegistry.get<RepositoryService>('repositoryService');
}

/**
 * Get track repository from the registry
 */
export function getTrackRepository() {
  const service = getRepositoryService();
  return service.getTrackRepository();
}

/**
 * Get plugin preset repository from the registry
 */
export function getPluginPresetRepository() {
  const service = getRepositoryService();
  return service.getPluginPresetRepository();
}

/**
 * Get transport repository from the registry
 */
export function getTransportRepository() {
  const service = getRepositoryService();
  return service.getTransportRepository();
}
