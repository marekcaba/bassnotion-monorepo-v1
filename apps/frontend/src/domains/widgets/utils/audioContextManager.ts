/**
 * Centralized audio context management to prevent multiple global click handlers
 * This singleton ensures only one click handler is active for resuming audio context
 */

class AudioContextManager {
  private static instance: AudioContextManager;
  private audioContext: AudioContext | null = null;
  private isListening = false;
  private resumePromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  setAudioContext(context: AudioContext) {
    this.audioContext = context;
  }

  async ensureResumed(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not set');
    }

    // If already running, return immediately
    if (this.audioContext.state === 'running') {
      return;
    }

    // If already resuming, return the existing promise
    if (this.resumePromise) {
      return this.resumePromise;
    }

    // If not listening yet, set up the click handler
    if (!this.isListening && this.audioContext.state === 'suspended') {
      this.isListening = true;

      this.resumePromise = new Promise<void>((resolve) => {
        const handleInteraction = async () => {
          if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
              await this.audioContext.resume();
              logger.info(
                '🎵 AudioContextManager: Resumed audio context on user interaction',
              );
              resolve();

              // Clean up
              this.isListening = false;
              this.resumePromise = null;
              document.removeEventListener('click', handleInteraction);
              document.removeEventListener('touchstart', handleInteraction);
            } catch (error) {
              logger.error('Failed to resume audio context:', error);
            }
          }
        };

        // Add both click and touchstart for better mobile support
        document.addEventListener('click', handleInteraction, { once: true });
        document.addEventListener('touchstart', handleInteraction, {
          once: true,
        });
      });
    }

    return this.resumePromise || Promise.resolve();
  }

  getState(): AudioContextState | null {
    return this.audioContext?.state || null;
  }
}

export const audioContextManager = AudioContextManager.getInstance();
