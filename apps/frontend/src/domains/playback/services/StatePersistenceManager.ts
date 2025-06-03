/**
 * StatePersistenceManager - Session State Persistence and Recovery
 *
 * Handles automatic state persistence, session recovery, and cross-tab synchronization
 * for the Core Audio Engine with comprehensive error handling and data validation.
 *
 * Part of Story 2.1: Task 4, Subtask 4.5 - State persistence for session recovery
 */

import {
  CoreAudioEngineConfig,
  AudioSourceConfig,
  PlaybackState,
} from '../types/audio.js';

// Storage configuration and types
export interface PersistenceConfig {
  enabled: boolean;
  storageType: 'localStorage' | 'sessionStorage' | 'indexedDB';
  autoSaveInterval: number; // milliseconds
  maxStorageSize: number; // bytes
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  versionMigration: boolean;
  crossTabSync: boolean;
}

export interface PersistedState {
  version: string;
  timestamp: number;
  sessionId: string;
  config: CoreAudioEngineConfig;
  playbackState: PlaybackState;
  audioSources: Array<AudioSourceConfig>;
  soloSources: string[];
  transportState: {
    position: number;
    bpm: number;
    swing: number;
    loop: boolean;
    loopStart?: number;
    loopEnd?: number;
  };
  performanceHistory: {
    averageLatency: number;
    maxLatency: number;
    dropoutCount: number;
    lastMeasurement: number;
  };
  userPreferences: {
    masterVolume: number;
    audioQuality: 'high' | 'medium' | 'low';
    backgroundProcessing: boolean;
    batteryOptimization: boolean;
  };
  metadata: {
    deviceInfo: string;
    browserInfo: string;
    lastActiveTime: number;
    sessionDuration: number;
  };
}

export interface StorageQuota {
  used: number;
  available: number;
  total: number;
  percentage: number;
}

export interface PersistenceMetrics {
  saveOperations: number;
  loadOperations: number;
  compressionRatio: number;
  averageSaveTime: number;
  averageLoadTime: number;
  storageQuota: StorageQuota;
  errorCount: number;
  lastError?: string;
}

export class StatePersistenceManager {
  private static instance: StatePersistenceManager;
  private config: PersistenceConfig;
  private autoSaveTimer: number | null = null;
  private sessionId: string;
  private storageKey = 'bassnotion-playback-state';
  private backupKey = 'bassnotion-playback-backup';
  private isInitialized = false;

  // Performance and monitoring
  private metrics: PersistenceMetrics = {
    saveOperations: 0,
    loadOperations: 0,
    compressionRatio: 1.0,
    averageSaveTime: 0,
    averageLoadTime: 0,
    storageQuota: { used: 0, available: 0, total: 0, percentage: 0 },
    errorCount: 0,
  };

  // Event listeners for cross-tab synchronization
  private eventHandlers: Map<string, Set<(...args: any[]) => void>> = new Map();
  private storageListener: ((event: StorageEvent) => void) | null = null;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.config = this.getDefaultConfig();
  }

  public static getInstance(): StatePersistenceManager {
    if (!StatePersistenceManager.instance) {
      StatePersistenceManager.instance = new StatePersistenceManager();
    }
    return StatePersistenceManager.instance;
  }

  /**
   * Initialize the persistence manager
   */
  public async initialize(config?: Partial<PersistenceConfig>): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.config = { ...this.config, ...config };

    if (!this.config.enabled) {
      console.log('State persistence disabled');
      return;
    }

    try {
      // Check storage availability and quota
      await this.checkStorageAvailability();
      await this.updateStorageQuota();

      // Set up cross-tab synchronization
      if (this.config.crossTabSync) {
        this.setupCrossTabSync();
      }

      // Start auto-save if configured
      if (this.config.autoSaveInterval > 0) {
        this.startAutoSave();
      }

      // Clean up old sessions
      await this.cleanupOldSessions();

      this.isInitialized = true;
      console.log('State persistence initialized:', this.config.storageType);
    } catch (error) {
      console.error('Failed to initialize state persistence:', error);
      this.metrics.errorCount++;
      this.metrics.lastError =
        error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  /**
   * Save current state to storage
   */
  public async saveState(state: Partial<PersistedState>): Promise<void> {
    if (!this.config.enabled || !this.isInitialized) {
      return;
    }

    const startTime = performance.now();

    try {
      // Create complete persisted state
      const persistedState: PersistedState = {
        version: '2.1.0',
        timestamp: Date.now(),
        sessionId: this.sessionId,
        config: state.config || ({} as CoreAudioEngineConfig),
        playbackState: state.playbackState || 'stopped',
        audioSources: state.audioSources || [],
        soloSources: state.soloSources || [],
        transportState: state.transportState || {
          position: 0,
          bpm: 120,
          swing: 0,
          loop: false,
        },
        performanceHistory: state.performanceHistory || {
          averageLatency: 0,
          maxLatency: 0,
          dropoutCount: 0,
          lastMeasurement: Date.now(),
        },
        userPreferences: state.userPreferences || {
          masterVolume: 0.8,
          audioQuality: 'high',
          backgroundProcessing: true,
          batteryOptimization: false,
        },
        metadata: {
          deviceInfo: this.getDeviceInfo(),
          browserInfo: this.getBrowserInfo(),
          lastActiveTime: Date.now(),
          sessionDuration: Date.now() - this.getSessionStartTime(),
          ...state.metadata,
        },
      };

      // Validate state before saving
      this.validateState(persistedState);

      // Serialize and optionally compress
      let serializedState = JSON.stringify(persistedState);

      if (this.config.compressionEnabled) {
        const compressed = await this.compressData(serializedState);
        this.metrics.compressionRatio =
          compressed.length / serializedState.length;
        serializedState = compressed;
      }

      // Check storage quota before saving
      await this.updateStorageQuota();
      const stateSize = new Blob([serializedState]).size;

      if (stateSize > this.metrics.storageQuota.available) {
        // Clean up old data to make space
        await this.cleanupStorage();
        await this.updateStorageQuota();

        if (stateSize > this.metrics.storageQuota.available) {
          throw new Error('Insufficient storage space for state persistence');
        }
      }

      // Save to storage with backup
      const currentState = await this.loadFromStorage(this.storageKey);
      if (currentState) {
        await this.saveToStorage(this.backupKey, currentState);
      }
      await this.saveToStorage(this.storageKey, serializedState);

      // Update metrics
      const saveTime = performance.now() - startTime;
      this.metrics.saveOperations++;
      this.metrics.averageSaveTime =
        (this.metrics.averageSaveTime * (this.metrics.saveOperations - 1) +
          saveTime) /
        this.metrics.saveOperations;

      // Emit save event for cross-tab sync
      this.emit('stateSaved', {
        sessionId: this.sessionId,
        timestamp: Date.now(),
      });

      console.log(`State saved successfully in ${saveTime.toFixed(1)}ms`);
    } catch (error) {
      this.metrics.errorCount++;
      this.metrics.lastError =
        error instanceof Error ? error.message : 'Save failed';
      console.error('Failed to save state:', error);
      throw error;
    }
  }

  /**
   * Load state from storage
   */
  public async loadState(): Promise<PersistedState | null> {
    if (!this.config.enabled || !this.isInitialized) {
      return null;
    }

    const startTime = performance.now();

    try {
      let serializedState = await this.loadFromStorage(this.storageKey);

      if (!serializedState) {
        console.log('No persisted state found');
        return null;
      }

      // Decompress if needed
      if (this.config.compressionEnabled) {
        serializedState = await this.decompressData(serializedState);
      }

      // Parse and validate
      let state: PersistedState = JSON.parse(serializedState);
      this.validateState(state);

      // Check version compatibility
      if (this.config.versionMigration) {
        const migratedState = await this.migrateStateVersion(state);
        if (migratedState !== state) {
          // Save migrated state
          await this.saveState(migratedState);
          state = migratedState;
        }
      }

      // Update metrics
      const loadTime = performance.now() - startTime;
      this.metrics.loadOperations++;
      this.metrics.averageLoadTime =
        (this.metrics.averageLoadTime * (this.metrics.loadOperations - 1) +
          loadTime) /
        this.metrics.loadOperations;

      console.log(`State loaded successfully in ${loadTime.toFixed(1)}ms`);
      return state;
    } catch (error) {
      this.metrics.errorCount++;
      this.metrics.lastError =
        error instanceof Error ? error.message : 'Load failed';
      console.error('Failed to load state:', error);

      // Try to load backup
      return await this.loadBackupState();
    }
  }

  /**
   * Clear all persisted state
   */
  public async clearState(): Promise<void> {
    try {
      await this.removeFromStorage(this.storageKey);
      await this.removeFromStorage(this.backupKey);

      this.emit('stateCleared', {
        sessionId: this.sessionId,
        timestamp: Date.now(),
      });
      console.log('Persisted state cleared');
    } catch (error) {
      console.error('Failed to clear state:', error);
      throw error;
    }
  }

  /**
   * Get persistence metrics
   */
  public getMetrics(): PersistenceMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if session recovery is available
   */
  public async hasRecoverableSession(): Promise<boolean> {
    try {
      const state = await this.loadState();
      if (!state) return false;

      // Check if session is recent enough to recover (within 24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      const age = Date.now() - state.timestamp;

      return age < maxAge;
    } catch {
      return false;
    }
  }

  /**
   * Add event listener
   */
  public on(event: string, handler: (...args: any[]) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.add(handler);
    }

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Dispose and cleanup
   */
  public async dispose(): Promise<void> {
    try {
      this.stopAutoSave();
      this.cleanupCrossTabSync();
      this.eventHandlers.clear();
      this.isInitialized = false;

      console.log('State persistence manager disposed');
    } catch (error) {
      console.error('Error disposing state persistence manager:', error);
    }
  }

  // Private implementation methods

  private getDefaultConfig(): PersistenceConfig {
    return {
      enabled: true,
      storageType: 'localStorage',
      autoSaveInterval: 30000, // 30 seconds
      maxStorageSize: 10 * 1024 * 1024, // 10MB
      compressionEnabled: true,
      encryptionEnabled: false,
      versionMigration: true,
      crossTabSync: true,
    };
  }

  private async checkStorageAvailability(): Promise<void> {
    try {
      switch (this.config.storageType) {
        case 'localStorage':
          if (typeof localStorage === 'undefined') {
            throw new Error('localStorage not available');
          }
          break;
        case 'sessionStorage':
          if (typeof sessionStorage === 'undefined') {
            throw new Error('sessionStorage not available');
          }
          break;
        case 'indexedDB':
          if (typeof indexedDB === 'undefined') {
            throw new Error('IndexedDB not available');
          }
          break;
      }
    } catch (error) {
      throw new Error(
        `Storage type ${this.config.storageType} not available: ${error}`,
      );
    }
  }

  private async updateStorageQuota(): Promise<void> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        this.metrics.storageQuota = {
          used: estimate.usage || 0,
          available: (estimate.quota || 0) - (estimate.usage || 0),
          total: estimate.quota || 0,
          percentage: estimate.quota
            ? ((estimate.usage || 0) / estimate.quota) * 100
            : 0,
        };
      } else {
        // Fallback estimation for older browsers
        this.metrics.storageQuota = {
          used: 0,
          available: 5 * 1024 * 1024, // 5MB estimate
          total: 10 * 1024 * 1024, // 10MB estimate
          percentage: 0,
        };
      }
    } catch (error) {
      console.warn('Could not estimate storage quota:', error);
    }
  }

  private async saveToStorage(key: string, data: string | null): Promise<void> {
    if (!data) return; // Skip saving if data is null

    switch (this.config.storageType) {
      case 'localStorage':
        localStorage.setItem(key, data);
        break;
      case 'sessionStorage':
        sessionStorage.setItem(key, data);
        break;
      case 'indexedDB':
        // IndexedDB implementation would go here
        throw new Error('IndexedDB not yet implemented');
    }
  }

  private async loadFromStorage(key: string): Promise<string | null> {
    switch (this.config.storageType) {
      case 'localStorage':
        return localStorage.getItem(key);
      case 'sessionStorage':
        return sessionStorage.getItem(key);
      case 'indexedDB':
        // IndexedDB implementation would go here
        throw new Error('IndexedDB not yet implemented');
      default:
        return null;
    }
  }

  private async removeFromStorage(key: string): Promise<void> {
    switch (this.config.storageType) {
      case 'localStorage':
        localStorage.removeItem(key);
        break;
      case 'sessionStorage':
        sessionStorage.removeItem(key);
        break;
      case 'indexedDB':
        // IndexedDB implementation would go here
        throw new Error('IndexedDB not yet implemented');
    }
  }

  private validateState(state: PersistedState): void {
    if (!state.version || !state.timestamp || !state.sessionId) {
      throw new Error('Invalid state: missing required fields');
    }

    if (typeof state.config !== 'object') {
      throw new Error('Invalid state: config must be an object');
    }

    if (!Array.isArray(state.audioSources)) {
      throw new Error('Invalid state: audioSources must be an array');
    }

    // Add more validation as needed
  }

  private async migrateStateVersion(
    state: PersistedState,
  ): Promise<PersistedState> {
    // Version migration logic would go here
    // For now, return state unchanged
    return state;
  }

  private async loadBackupState(): Promise<PersistedState | null> {
    try {
      const backupData = await this.loadFromStorage(this.backupKey);
      if (backupData) {
        const state = JSON.parse(backupData);
        console.log('Loaded backup state');
        return state;
      }
    } catch (error) {
      console.error('Failed to load backup state:', error);
    }
    return null;
  }

  private async compressData(data: string): Promise<string> {
    // Simple compression using built-in compression
    // In production, you might use a library like pako
    return data; // Placeholder - implement actual compression
  }

  private async decompressData(data: string): Promise<string> {
    // Decompression counterpart
    return data; // Placeholder - implement actual decompression
  }

  private async cleanupOldSessions(): Promise<void> {
    // Clean up old session data that's older than 7 days
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    try {
      const state = await this.loadState();
      if (state && Date.now() - state.timestamp > maxAge) {
        await this.clearState();
        console.log('Cleaned up old session data');
      }
    } catch (error) {
      console.warn('Could not clean up old sessions:', error);
    }
  }

  private async cleanupStorage(): Promise<void> {
    // Clean up storage space when needed
    try {
      // Remove backup first
      await this.removeFromStorage(this.backupKey);

      // Could add more cleanup strategies here
      console.log('Storage cleanup completed');
    } catch (error) {
      console.warn('Storage cleanup failed:', error);
    }
  }

  private setupCrossTabSync(): void {
    if (typeof window === 'undefined') return;

    this.storageListener = (event: StorageEvent) => {
      if (event.key === this.storageKey && event.newValue) {
        try {
          const state = JSON.parse(event.newValue);
          if (state.sessionId !== this.sessionId) {
            this.emit('externalStateChange', state);
          }
        } catch (error) {
          console.warn('Failed to parse external state change:', error);
        }
      }
    };

    window.addEventListener('storage', this.storageListener);
  }

  private cleanupCrossTabSync(): void {
    if (this.storageListener && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.storageListener);
      this.storageListener = null;
    }
  }

  private startAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = window.setInterval(() => {
      this.emit('autoSaveRequested');
    }, this.config.autoSaveInterval);
  }

  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSessionStartTime(): number {
    // Get session start time from sessionId timestamp
    const match = this.sessionId.match(/session-(\d+)-/);
    return match && match[1] ? parseInt(match[1], 10) : Date.now();
  }

  private getDeviceInfo(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    return `${navigator.platform} ${navigator.userAgent.split(' ')[0]}`;
  }

  private getBrowserInfo(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    return navigator.userAgent;
  }
}
