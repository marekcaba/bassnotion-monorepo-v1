/**
 * Instrument Lifecycle Interface
 *
 * Manages instrument lifecycle and resource management
 */

import type { IInstrumentCore } from './IInstrumentCore.js';

export interface LifecycleState {
  phase: LifecyclePhase;
  initialized: boolean;
  loaded: boolean;
  ready: boolean;
  error?: Error;
  metadata: LifecycleMetadata;
}

export type LifecyclePhase =
  | 'uninitialized'
  | 'initializing'
  | 'loading'
  | 'ready'
  | 'suspending'
  | 'suspended'
  | 'resuming'
  | 'disposing'
  | 'disposed'
  | 'error';

export interface LifecycleMetadata {
  createdAt: Date;
  initializedAt?: Date;
  loadedAt?: Date;
  lastUsedAt?: Date;
  suspendedAt?: Date;
  disposedAt?: Date;
  resourcesLoaded: number;
  resourcesTotal: number;
  memoryUsage?: number;
}

export interface LifecycleHooks {
  onBeforeInitialize?: () => Promise<void> | void;
  onAfterInitialize?: () => Promise<void> | void;
  onBeforeLoad?: () => Promise<void> | void;
  onAfterLoad?: () => Promise<void> | void;
  onBeforeSuspend?: () => Promise<void> | void;
  onAfterSuspend?: () => Promise<void> | void;
  onBeforeResume?: () => Promise<void> | void;
  onAfterResume?: () => Promise<void> | void;
  onBeforeDispose?: () => Promise<void> | void;
  onAfterDispose?: () => Promise<void> | void;
  onError?: (error: Error) => void;
}

export interface ResourceInfo {
  id: string;
  type: 'sample' | 'impulse' | 'wavetable' | 'other';
  url?: string;
  size?: number;
  loaded: boolean;
  error?: Error;
}

/**
 * Lifecycle management for instruments
 */
export interface IInstrumentLifecycle {
  // Lifecycle control
  initialize(): Promise<void>;
  load(): Promise<void>;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  dispose(): Promise<void>;

  // State
  getLifecycleState(): LifecycleState;
  getPhase(): LifecyclePhase;
  isReady(): boolean;
  isSuspended(): boolean;

  // Resource management
  preloadResources(): Promise<void>;
  releaseResources(): void;
  getResourceInfo(): ResourceInfo[];
  getMemoryUsage(): number;

  // Hooks
  registerHooks(hooks: LifecycleHooks): void;
  unregisterHooks(): void;
}

/**
 * Manager for multiple instrument lifecycles
 */
export interface ILifecycleManager {
  // Registration
  register(instrument: IInstrumentCore & IInstrumentLifecycle): void;
  unregister(instrumentId: string): void;

  // Batch operations
  initializeAll(): Promise<void>;
  loadAll(): Promise<void>;
  suspendAll(): Promise<void>;
  resumeAll(): Promise<void>;
  disposeAll(): Promise<void>;

  // Management
  suspendInactive(inactiveTime: number): void;
  optimizeMemory(targetMemoryMB: number): void;

  // Monitoring
  getInstruments(): Array<IInstrumentCore & IInstrumentLifecycle>;
  getTotalMemoryUsage(): number;
  getStatistics(): LifecycleStatistics;
}

export interface LifecycleStatistics {
  totalInstruments: number;
  readyInstruments: number;
  suspendedInstruments: number;
  totalMemoryMB: number;
  averageLoadTimeMs: number;
  lastOptimizationTime?: Date;
}

/**
 * Base lifecycle implementation
 */
export abstract class BaseInstrumentLifecycle implements IInstrumentLifecycle {
  protected state: LifecycleState = {
    phase: 'uninitialized',
    initialized: false,
    loaded: false,
    ready: false,
    metadata: {
      createdAt: new Date(),
      resourcesLoaded: 0,
      resourcesTotal: 0,
    },
  };

  protected hooks: LifecycleHooks = {};
  protected resources: Map<string, ResourceInfo> = new Map();

  async initialize(): Promise<void> {
    if (this.state.phase !== 'uninitialized') {
      throw new Error(`Cannot initialize from phase: ${this.state.phase}`);
    }

    try {
      this.setPhase('initializing');
      await this.hooks.onBeforeInitialize?.();

      await this.performInitialization();

      this.state.initialized = true;
      this.state.metadata.initializedAt = new Date();
      await this.hooks.onAfterInitialize?.();

      this.setPhase('loading');
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  async load(): Promise<void> {
    if (this.state.phase !== 'loading' && this.state.phase !== 'suspended') {
      throw new Error(`Cannot load from phase: ${this.state.phase}`);
    }

    try {
      this.setPhase('loading');
      await this.hooks.onBeforeLoad?.();

      await this.performLoad();

      this.state.loaded = true;
      this.state.metadata.loadedAt = new Date();
      await this.hooks.onAfterLoad?.();

      this.setPhase('ready');
      this.state.ready = true;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  async suspend(): Promise<void> {
    if (this.state.phase !== 'ready') {
      throw new Error(`Cannot suspend from phase: ${this.state.phase}`);
    }

    try {
      this.setPhase('suspending');
      await this.hooks.onBeforeSuspend?.();

      await this.performSuspend();

      this.state.metadata.suspendedAt = new Date();
      await this.hooks.onAfterSuspend?.();

      this.setPhase('suspended');
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  async resume(): Promise<void> {
    if (this.state.phase !== 'suspended') {
      throw new Error(`Cannot resume from phase: ${this.state.phase}`);
    }

    try {
      this.setPhase('resuming');
      await this.hooks.onBeforeResume?.();

      await this.performResume();

      this.state.metadata.lastUsedAt = new Date();
      await this.hooks.onAfterResume?.();

      this.setPhase('ready');
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    if (this.state.phase === 'disposed') {
      return;
    }

    try {
      this.setPhase('disposing');
      await this.hooks.onBeforeDispose?.();

      await this.performDispose();
      this.releaseResources();

      this.state.metadata.disposedAt = new Date();
      await this.hooks.onAfterDispose?.();

      this.setPhase('disposed');
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  getLifecycleState(): LifecycleState {
    return { ...this.state };
  }

  getPhase(): LifecyclePhase {
    return this.state.phase;
  }

  isReady(): boolean {
    return this.state.phase === 'ready';
  }

  isSuspended(): boolean {
    return this.state.phase === 'suspended';
  }

  async preloadResources(): Promise<void> {
    // Override in implementations
  }

  releaseResources(): void {
    for (const resource of this.resources.values()) {
      resource.loaded = false;
    }
    this.resources.clear();
    this.state.metadata.resourcesLoaded = 0;
  }

  getResourceInfo(): ResourceInfo[] {
    return Array.from(this.resources.values());
  }

  getMemoryUsage(): number {
    let totalSize = 0;
    for (const resource of this.resources.values()) {
      if (resource.size) {
        totalSize += resource.size;
      }
    }
    return totalSize;
  }

  registerHooks(hooks: LifecycleHooks): void {
    this.hooks = { ...this.hooks, ...hooks };
  }

  unregisterHooks(): void {
    this.hooks = {};
  }

  protected abstract performInitialization(): Promise<void>;
  protected abstract performLoad(): Promise<void>;
  protected abstract performSuspend(): Promise<void>;
  protected abstract performResume(): Promise<void>;
  protected abstract performDispose(): Promise<void>;

  protected setPhase(phase: LifecyclePhase): void {
    this.state.phase = phase;
  }

  protected handleError(error: Error): void {
    this.state.error = error;
    this.setPhase('error');
    this.hooks.onError?.(error);
  }

  protected trackResource(resource: ResourceInfo): void {
    this.resources.set(resource.id, resource);
    this.state.metadata.resourcesTotal = this.resources.size;
    if (resource.loaded) {
      this.state.metadata.resourcesLoaded++;
    }
  }
}
