/**
 * AudioContextManager - Singleton Web Audio API Context Manager
 *
 * Manages the lifecycle of the Web Audio API AudioContext across the application.
 * Handles user gesture requirements, browser compatibility, and proper cleanup.
 *
 * Part of Story 2.1: Core Audio Engine Foundation
 */

export type AudioContextState =
  | 'suspended'
  | 'running'
  | 'closed'
  | 'interrupted';

export interface AudioContextError {
  type: 'unsupported' | 'hardware' | 'permission' | 'unknown';
  message: string;
  originalError?: Error;
}

export class AudioContextManager {
  private static instance: AudioContextManager;
  private audioContext: AudioContext | null = null;
  private isInitialized = false;
  private currentState: AudioContextState = 'suspended';
  private initializationPromise: Promise<void> | null = null;
  private errorHandlers: Set<(error: AudioContextError) => void> = new Set();
  private stateChangeHandlers: Set<(state: AudioContextState) => void> =
    new Set();

  private constructor() {
    // Private constructor for singleton pattern
    this.setupVisibilityHandling();
  }

  public static getInstance(): AudioContextManager {
    // TODO: Review non-null assertion - consider null safety
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  /**
   * Initialize AudioContext with user gesture handling
   * Must be called from a user interaction event (click, touch, etc.)
   */
  public async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.isInitialized && this.audioContext) {
      return;
    }

    // If initialization is in progress, wait for it to complete
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization process
    this.initializationPromise = this.performInitialization();
    try {
      await this.initializationPromise;
    } finally {
      // Clear the promise after completion (success or failure)
      this.initializationPromise = null;
    }
  }

  private async performInitialization(): Promise<void> {
    try {
      // Check browser support
      // TODO: Review non-null assertion - consider null safety
      if (!this.isBrowserSupported()) {
        throw new Error('Web Audio API not supported in this browser');
      }

      // Create AudioContext
      this.audioContext = new AudioContext({
        latencyHint: 'interactive', // Optimize for low latency
        sampleRate: 44100, // Standard sample rate
      });

      // Set up state change listener
      this.audioContext.addEventListener(
        'statechange',
        this.handleStateChange.bind(this),
      );

      // Resume context if suspended (required for user gesture)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.isInitialized = true;
      this.currentState = this.audioContext.state as AudioContextState;
      this.notifyStateChange(this.audioContext.state as AudioContextState);
    } catch (error) {
      const audioError: AudioContextError = {
        type: this.categorizeError(error),
        message:
          error instanceof Error
            ? error.message
            : 'Unknown audio initialization error',
        originalError: error instanceof Error ? error : undefined,
      };

      this.notifyError(audioError);
      throw audioError;
    }
  }

  /**
   * Get the current AudioContext instance
   * Throws error if not initialized
   */
  public getContext(): AudioContext {
    // TODO: Review non-null assertion - consider null safety
    if (!this.audioContext || !this.isInitialized) {
      throw new Error(
        'AudioContext not initialized. Call initialize() first from a user gesture.',
      );
    }
    return this.audioContext;
  }

  /**
   * Get current audio context state
   */
  public getState(): AudioContextState {
    return this.currentState;
  }

  /**
   * Resume audio context from suspended state
   */
  public async resume(): Promise<void> {
    // TODO: Review non-null assertion - consider null safety
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    try {
      // Only resume if actually suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch (error) {
      // Create properly structured error object matching test expectations
      const audioError: AudioContextError = {
        type: 'hardware',
        message: 'Failed to resume audio context',
        originalError: error instanceof Error ? error : undefined,
      };

      this.notifyError(audioError);

      // Re-throw the structured error object, not a plain Error
      throw audioError;
    }
  }

  /**
   * Suspend audio context (for battery saving)
   */
  public async suspend(): Promise<void> {
    // TODO: Review non-null assertion - consider null safety
    if (!this.audioContext) return;

    try {
      // Only suspend if actually running
      if (this.audioContext.state === 'running') {
        await this.audioContext.suspend();
      }
    } catch (error) {
      const audioError: AudioContextError = {
        type: 'hardware',
        message: 'Failed to suspend audio context',
        originalError: error instanceof Error ? error : undefined,
      };
      this.notifyError(audioError);

      // Don't re-throw for suspend, just log the error
      console.warn(
        'Audio context suspend failed:',
        this.sanitizeErrorMessage(audioError.message),
      );
    }
  }

  /**
   * Close and cleanup audio context
   * Should be called on app unmount or navigation away
   */
  public async dispose(): Promise<void> {
    // TODO: Review non-null assertion - consider null safety
    if (!this.audioContext) return;

    try {
      // Remove event listeners
      this.audioContext.removeEventListener(
        'statechange',
        this.handleStateChange.bind(this),
      );

      // Close the context
      if (this.audioContext.state !== 'closed') {
        await this.audioContext.close();
      }

      this.audioContext = null;
      this.isInitialized = false;
      this.initializationPromise = null;
      this.currentState = 'closed';
      this.notifyStateChange('closed');
    } catch (error) {
      console.error('Error disposing AudioContext:', error);
    }
  }

  /**
   * Check if Web Audio API is supported
   */
  public isBrowserSupported(): boolean {
    // TODO: Review non-null assertion - consider null safety
    return !!(window.AudioContext || (window as any).webkitAudioContext);
  }

  /**
   * Add error handler
   */
  public onError(handler: (error: AudioContextError) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * Add state change handler
   */
  public onStateChange(
    handler: (state: AudioContextState) => void,
  ): () => void {
    this.stateChangeHandlers.add(handler);
    return () => this.stateChangeHandlers.delete(handler);
  }

  /**
   * Get current time in audio context
   */
  public getCurrentTime(): number {
    return this.audioContext?.currentTime ?? 0;
  }

  private handleStateChange(): void {
    if (this.audioContext) {
      this.currentState = this.audioContext.state as AudioContextState;
      this.notifyStateChange(this.audioContext.state as AudioContextState);
    }
  }

  private notifyError(error: AudioContextError): void {
    // Sanitize error message to prevent information disclosure
    const sanitizedError = {
      ...error,
      message: this.sanitizeErrorMessage(error.message),
      originalError: undefined, // Remove original error to prevent info disclosure
    };

    this.errorHandlers.forEach((handler) => {
      try {
        handler(sanitizedError);
      } catch (err) {
        console.error('Error in audio error handler:', err);
      }
    });
  }

  private sanitizeErrorMessage(message: string): string {
    // Remove potentially sensitive file paths, line numbers, and system info
    return message
      .replace(/[/][a-zA-Z0-9/_.-]+[.](js|ts|jsx|tsx)/g, '[file]') // Remove file paths
      .replace(/line \d+/g, 'line [number]') // Remove line numbers
      .replace(/at .+:\d+:\d+/g, 'at [location]') // Remove stack trace locations
      .replace(/Internal path:\s*[^\s]+.*$/gm, 'Internal error occurred') // Remove internal paths - fixed pattern
      .replace(/System path:\s*[^\s]+.*$/gm, 'System error occurred') // Remove system paths - fixed pattern
      .replace(/\/usr\/[^\s]*/g, '[system-path]') // Remove /usr/ paths
      .replace(/\/opt\/[^\s]*/g, '[system-path]') // Remove /opt/ paths
      .replace(/\/var\/[^\s]*/g, '[system-path]') // Remove /var/ paths
      .replace(/\/home\/[^\s]*/g, '[user-path]') // Remove /home/ paths
      .replace(/C:\\[^\s]*/g, '[system-path]') // Remove Windows paths
      .replace(/[^\s]*:\d+:\d+/g, '[location removed]') // Remove file paths with line numbers
      .replace(/:\d+:\d+/g, ':[line]:[col]'); // Remove line:column references
  }

  private notifyStateChange(state: AudioContextState): void {
    this.stateChangeHandlers.forEach((handler) => {
      try {
        handler(state);
      } catch (err) {
        console.error('Error in state change handler:', err);
      }
    });
  }

  private categorizeError(error: unknown): AudioContextError['type'] {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('not supported') || message.includes('undefined')) {
        return 'unsupported';
      }
      if (message.includes('permission') || message.includes('access')) {
        return 'permission';
      }
      if (message.includes('hardware') || message.includes('device')) {
        return 'hardware';
      }
    }
    return 'unknown';
  }

  private setupVisibilityHandling(): void {
    // Handle page visibility changes for mobile battery optimization
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.audioContext?.state === 'running') {
          // Consider suspending on mobile for battery optimization
          // This can be configured based on user preferences
        }
      });
    }
  }
}
