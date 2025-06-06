/**
 * PluginLoader - Dynamic Plugin Loading System
 *
 * Provides dynamic loading of audio plugins at runtime with support for
 * ES modules, error handling, and safe loading patterns. Enables the
 * plugin system to load new plugins without requiring application restart.
 *
 * Part of Story 2.1: Task 14, Subtask 14.5
 */

import type { AudioPlugin, PluginMetadata } from '../types/plugin.js';
import {
  createValidationError,
  ValidationErrorCode,
} from './errors/ValidationError.js';
import {
  createResourceError,
  ResourceErrorCode,
} from './errors/ResourceError.js';

/**
 * Plugin loading configuration
 */
export interface PluginLoaderConfig {
  // Loading behavior
  timeout: number; // Loading timeout in milliseconds
  retryAttempts: number; // Number of retry attempts
  enableValidation: boolean; // Enable plugin validation
  enableSandbox: boolean; // Enable sandbox mode (if supported)

  // Security settings
  allowedOrigins: string[]; // Allowed plugin origins
  trustedPlugins: string[]; // List of trusted plugin IDs
  requireSignature: boolean; // Require plugin signatures

  // Performance settings
  maxConcurrentLoads: number; // Maximum concurrent plugin loads
  preloadCommonDependencies: boolean; // Preload common dependencies

  // Development settings
  enableHotReload: boolean; // Enable hot reload in development
  developmentMode: boolean; // Development mode flag
}

/**
 * Plugin loading result
 */
export interface PluginLoadResult {
  success: boolean;
  plugin?: AudioPlugin;
  error?: Error;
  loadTime: number;
  fromCache: boolean;
  metadata?: PluginMetadata;
}

/**
 * Plugin loading context
 */
export interface PluginLoadContext {
  url: string;
  pluginId: string;
  version?: string;
  checksum?: string;
  dependencies?: string[];
  loadingStartTime: number;
}

/**
 * Plugin cache entry
 */
interface PluginCacheEntry {
  plugin: AudioPlugin;
  loadTime: number;
  url: string;
  checksum?: string;
  dependencies: string[];
  lastAccessed: number;
}

/**
 * Default plugin loader configuration
 */
const DEFAULT_CONFIG: PluginLoaderConfig = {
  timeout: 10000,
  retryAttempts: 3,
  enableValidation: true,
  enableSandbox: false,
  allowedOrigins: [
    'https://plugins.bassnotion.com',
    'https://cdn.bassnotion.com',
  ],
  trustedPlugins: [],
  requireSignature: false,
  maxConcurrentLoads: 3,
  preloadCommonDependencies: true,
  enableHotReload: true,
  developmentMode: process.env.NODE_ENV === 'development',
};

export class PluginLoader {
  private static instance: PluginLoader;

  private config: PluginLoaderConfig;
  private cache: Map<string, PluginCacheEntry> = new Map();
  private loadingQueue: Map<string, Promise<PluginLoadResult>> = new Map();
  private currentLoads = 0;

  // Dependencies cache
  private dependencyCache: Map<string, any> = new Map();

  // Security validation
  private trustedHashes: Set<string> = new Set();

  // Hot reload tracking
  private watchedPlugins: Map<string, { url: string; lastModified?: number }> =
    new Map();

  private constructor(config: Partial<PluginLoaderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeLoader();
  }

  public static getInstance(
    config?: Partial<PluginLoaderConfig>,
  ): PluginLoader {
    if (!PluginLoader.instance) {
      PluginLoader.instance = new PluginLoader(config);
    }
    return PluginLoader.instance;
  }

  /**
   * Load a plugin dynamically from URL
   */
  public async loadPlugin(
    url: string,
    pluginId?: string,
  ): Promise<PluginLoadResult> {
    const startTime = performance.now();

    try {
      // Check if already loading
      const existingLoad = this.loadingQueue.get(url);
      if (existingLoad) {
        return await existingLoad;
      }

      // Create loading promise
      const loadPromise = this.performPluginLoad(url, pluginId, startTime);
      this.loadingQueue.set(url, loadPromise);

      try {
        const result = await loadPromise;
        return result;
      } finally {
        this.loadingQueue.delete(url);
      }
    } catch (error) {
      this.loadingQueue.delete(url);
      throw error;
    }
  }

  /**
   * Load multiple plugins concurrently
   */
  public async loadPlugins(urls: string[]): Promise<PluginLoadResult[]> {
    const loadPromises = urls.map((url) => this.loadPlugin(url));
    return await Promise.all(loadPromises);
  }

  /**
   * Reload a plugin (for hot reload)
   */
  public async reloadPlugin(pluginId: string): Promise<PluginLoadResult> {
    const watchedPlugin = this.watchedPlugins.get(pluginId);
    if (!watchedPlugin) {
      throw createResourceError(
        ResourceErrorCode.NOT_FOUND,
        `Plugin ${pluginId} is not being watched for hot reload`,
      );
    }

    // Remove from cache to force reload
    this.cache.delete(pluginId);

    return await this.loadPlugin(watchedPlugin.url, pluginId);
  }

  /**
   * Get plugin from cache
   */
  public getCachedPlugin(pluginId: string): AudioPlugin | null {
    const entry = this.cache.get(pluginId);
    if (entry) {
      entry.lastAccessed = Date.now();
      return entry.plugin;
    }
    return null;
  }

  /**
   * Check if plugin is cached
   */
  public isPluginCached(pluginId: string): boolean {
    return this.cache.has(pluginId);
  }

  /**
   * Clear plugin cache
   */
  public clearCache(pluginId?: string): void {
    if (pluginId) {
      this.cache.delete(pluginId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Preload plugin dependencies
   */
  public async preloadDependencies(dependencies: string[]): Promise<void> {
    const loadPromises = dependencies.map(async (dep) => {
      if (!this.dependencyCache.has(dep)) {
        try {
          const module = await import(dep);
          this.dependencyCache.set(dep, module);
        } catch (error) {
          console.warn(`Failed to preload dependency ${dep}:`, error);
        }
      }
    });

    await Promise.all(loadPromises);
  }

  /**
   * Enable hot reload for a plugin
   */
  public enableHotReload(pluginId: string, url: string): void {
    if (!this.config.enableHotReload || !this.config.developmentMode) {
      return;
    }

    this.watchedPlugins.set(pluginId, { url });

    // In a real implementation, this would set up file watching
    console.log(`Hot reload enabled for plugin: ${pluginId}`);
  }

  /**
   * Disable hot reload for a plugin
   */
  public disableHotReload(pluginId: string): void {
    this.watchedPlugins.delete(pluginId);
    console.log(`Hot reload disabled for plugin: ${pluginId}`);
  }

  /**
   * Validate plugin before loading
   */
  public async validatePlugin(
    plugin: AudioPlugin,
    context: PluginLoadContext,
  ): Promise<boolean> {
    if (!this.config.enableValidation) {
      return true;
    }

    try {
      // Check plugin metadata
      if (!plugin.metadata || !plugin.metadata.id) {
        throw createValidationError(
          ValidationErrorCode.INVALID_FORMAT,
          'Plugin metadata is missing or invalid',
        );
      }

      // Check required methods
      const requiredMethods = ['load', 'initialize', 'process', 'dispose'];
      for (const method of requiredMethods) {
        if (typeof plugin[method as keyof AudioPlugin] !== 'function') {
          throw createValidationError(
            ValidationErrorCode.INVALID_FORMAT,
            `Plugin is missing required method: ${method}`,
          );
        }
      }

      // Check plugin ID matches context
      if (context.pluginId && plugin.metadata.id !== context.pluginId) {
        throw createValidationError(
          ValidationErrorCode.INVALID_FORMAT,
          `Plugin ID mismatch: expected ${context.pluginId}, got ${plugin.metadata.id}`,
        );
      }

      // Check version compatibility
      if (context.version && plugin.metadata.version !== context.version) {
        console.warn(
          `Plugin version mismatch: expected ${context.version}, got ${plugin.metadata.version}`,
        );
      }

      // Check dependencies
      if (plugin.metadata.dependencies?.length > 0) {
        await this.validateDependencies(plugin.metadata.dependencies);
      }

      return true;
    } catch (error) {
      console.error('Plugin validation failed:', error);
      throw error;
    }
  }

  /**
   * Get plugin loading statistics
   */
  public getLoadingStats(): {
    cacheSize: number;
    dependencyCacheSize: number;
    currentLoads: number;
    watchedPlugins: number;
  } {
    return {
      cacheSize: this.cache.size,
      dependencyCacheSize: this.dependencyCache.size,
      currentLoads: this.currentLoads,
      watchedPlugins: this.watchedPlugins.size,
    };
  }

  // Private methods

  private async performPluginLoad(
    url: string,
    pluginId?: string,
    startTime: number = performance.now(),
  ): Promise<PluginLoadResult> {
    // Check concurrent load limit
    if (this.currentLoads >= this.config.maxConcurrentLoads) {
      await this.waitForLoadSlot();
    }

    this.currentLoads++;

    try {
      // Check cache first
      const cacheKey = pluginId || url;
      const cachedEntry = this.cache.get(cacheKey);
      if (cachedEntry) {
        return {
          success: true,
          plugin: cachedEntry.plugin,
          loadTime: performance.now() - startTime,
          fromCache: true,
          metadata: cachedEntry.plugin.metadata,
        };
      }

      // Validate URL
      this.validatePluginUrl(url);

      // Create loading context
      const context: PluginLoadContext = {
        url,
        pluginId: pluginId || this.extractPluginIdFromUrl(url),
        loadingStartTime: startTime,
      };

      // Load the plugin module
      const module = await this.loadPluginModule(url);

      // Extract plugin class/factory
      const plugin = await this.createPluginInstance(module, context);

      // Validate plugin
      await this.validatePlugin(plugin, context);

      // Cache the plugin
      this.cachePlugin(context.pluginId, plugin, url);

      // Enable hot reload if configured
      if (this.config.enableHotReload && this.config.developmentMode) {
        this.enableHotReload(context.pluginId, url);
      }

      return {
        success: true,
        plugin,
        loadTime: performance.now() - startTime,
        fromCache: false,
        metadata: plugin.metadata,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        loadTime: performance.now() - startTime,
        fromCache: false,
      };
    } finally {
      this.currentLoads--;
    }
  }

  private async loadPluginModule(url: string): Promise<any> {
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Plugin loading timeout: ${url}`));
      }, this.config.timeout);
    });

    // Load module with timeout
    try {
      const module = await Promise.race([import(url), timeoutPromise]);
      return module;
    } catch (error) {
      throw createResourceError(
        ResourceErrorCode.LOAD_FAILED,
        `Failed to load plugin module from ${url}: ${(error as Error).message}`,
      );
    }
  }

  private async createPluginInstance(
    module: any,
    context: PluginLoadContext,
  ): Promise<AudioPlugin> {
    // Try different export patterns
    let PluginClass = null;

    // Check for default export
    if (module.default && typeof module.default === 'function') {
      PluginClass = module.default;
    }
    // Check for named export matching plugin ID
    else if (context.pluginId && module[context.pluginId]) {
      PluginClass = module[context.pluginId];
    }
    // Check for common plugin export names
    else if (module.Plugin) {
      PluginClass = module.Plugin;
    } else if (module.AudioPlugin) {
      PluginClass = module.AudioPlugin;
    }

    if (!PluginClass) {
      throw createValidationError(
        ValidationErrorCode.INVALID_FORMAT,
        'Could not find plugin class in module',
      );
    }

    try {
      // Create plugin instance
      const plugin = new PluginClass();

      if (!plugin || typeof plugin !== 'object') {
        throw createValidationError(
          ValidationErrorCode.INVALID_FORMAT,
          'Plugin constructor did not return a valid object',
        );
      }

      return plugin as AudioPlugin;
    } catch (error) {
      throw createValidationError(
        ValidationErrorCode.INVALID_FORMAT,
        `Failed to create plugin instance: ${(error as Error).message}`,
      );
    }
  }

  private validatePluginUrl(url: string): void {
    // Check allowed origins
    if (this.config.allowedOrigins.length > 0) {
      const urlObj = new URL(url);
      const isAllowed = this.config.allowedOrigins.some(
        (origin) => urlObj.origin === origin || url.startsWith(origin),
      );

      if (!isAllowed) {
        throw createValidationError(
          ValidationErrorCode.INVALID_FORMAT,
          `Plugin URL origin not allowed: ${urlObj.origin}`,
        );
      }
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw createValidationError(
        ValidationErrorCode.INVALID_FORMAT,
        `Invalid plugin URL: ${url}`,
      );
    }
  }

  private extractPluginIdFromUrl(url: string): string {
    // Extract plugin ID from URL
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || '';

    // Remove file extension
    return filename.replace(/\.[^/.]+$/, '');
  }

  private async validateDependencies(dependencies: string[]): Promise<void> {
    const missingDeps: string[] = [];

    for (const dep of dependencies) {
      if (!this.dependencyCache.has(dep)) {
        try {
          await import(dep);
        } catch {
          missingDeps.push(dep);
        }
      }
    }

    if (missingDeps.length > 0) {
      throw createValidationError(
        ValidationErrorCode.DEPENDENCY_ERROR,
        `Missing dependencies: ${missingDeps.join(', ')}`,
      );
    }
  }

  private cachePlugin(
    pluginId: string,
    plugin: AudioPlugin,
    url: string,
  ): void {
    const entry: PluginCacheEntry = {
      plugin,
      loadTime: Date.now(),
      url,
      dependencies: plugin.metadata.dependencies || [],
      lastAccessed: Date.now(),
    };

    this.cache.set(pluginId, entry);

    // Cleanup old cache entries if needed
    this.cleanupCache();
  }

  private cleanupCache(): void {
    const maxCacheSize = 50; // Maximum cache entries

    if (this.cache.size > maxCacheSize) {
      // Remove least recently accessed entries
      const entries = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].lastAccessed - b[1].lastAccessed,
      );

      const toRemove = entries.slice(0, this.cache.size - maxCacheSize);
      toRemove.forEach(([pluginId]) => {
        this.cache.delete(pluginId);
      });
    }
  }

  private async waitForLoadSlot(): Promise<void> {
    return new Promise((resolve) => {
      const checkSlot = () => {
        if (this.currentLoads < this.config.maxConcurrentLoads) {
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });
  }

  private initializeLoader(): void {
    // Initialize common dependencies if enabled
    if (this.config.preloadCommonDependencies) {
      this.preloadCommonDependencies();
    }

    // Setup hot reload monitoring if enabled
    if (this.config.enableHotReload && this.config.developmentMode) {
      this.setupHotReloadMonitoring();
    }
  }

  private async preloadCommonDependencies(): Promise<void> {
    const commonDeps = [
      'tone',
      // Add other common dependencies
    ];

    try {
      await this.preloadDependencies(commonDeps);
      console.log('Common dependencies preloaded');
    } catch (error) {
      console.warn('Failed to preload some common dependencies:', error);
    }
  }

  private setupHotReloadMonitoring(): void {
    // In a real implementation, this would set up file system monitoring
    // For now, we'll implement a simple polling mechanism

    if (typeof window !== 'undefined') {
      // Browser environment - could use ServiceWorker or WebSocket
      console.log('Hot reload monitoring setup (browser mode)');
    } else {
      // Node.js environment - could use fs.watch
      console.log('Hot reload monitoring setup (node mode)');
    }
  }
}
