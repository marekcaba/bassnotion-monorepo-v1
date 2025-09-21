/**
 * TransportWithEventBus - Transport with EventBus integration
 *
 * This extends the base Transport to add EventBus support for
 * compatibility with the existing system architecture.
 */

import { Transport } from './Transport.js';
import { TransportConfig, MusicalPosition } from '../types/index.js';
import { createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('TransportWithEventBus');

export interface EventBus {
  emit(event: string, data: any): void;
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
}

export class TransportWithEventBus extends Transport {
  private eventBus: EventBus | null = null;
  private eventBusUpdateInterval: number | null = null;

  constructor(eventBus: EventBus, config?: Partial<TransportConfig>) {
    super(config);
    this.eventBus = eventBus;
    logger.info('TransportWithEventBus created');
  }

  /**
   * Override start to emit events
   */
  async start(): Promise<void> {
    await super.start();

    this.emitEvent('transport:start', {
      tempo: this.getTempo(),
      position: this.getPosition(),
    });

    // Start position update events
    this.startPositionEvents();
  }

  /**
   * Override stop to emit events
   */
  async stop(): Promise<void> {
    const position = this.getPosition();

    await super.stop();

    this.emitEvent('transport:stop', {
      position,
    });

    // Stop position events
    this.stopPositionEvents();
  }

  /**
   * Override pause to emit events
   */
  async pause(): Promise<void> {
    const position = this.getPosition();

    await super.pause();

    this.emitEvent('transport:pause', {
      position,
    });

    this.stopPositionEvents();
  }

  /**
   * Override resume to emit events
   */
  async resume(): Promise<void> {
    await super.resume();

    this.emitEvent('transport:resume', {
      position: this.getPosition(),
    });

    this.startPositionEvents();
  }

  /**
   * Override seek to emit events
   */
  async seek(position: MusicalPosition): Promise<void> {
    await super.seek(position);

    this.emitEvent('transport:seek', {
      position,
    });
  }

  /**
   * Override setTempo to emit events
   */
  setTempo(bpm: number): void {
    super.setTempo(bpm);

    this.emitEvent('transport:tempo', {
      tempo: bpm,
    });
  }

  /**
   * Override setLoopEnabled to emit events
   */
  setLoopEnabled(enabled: boolean): void {
    super.setLoopEnabled(enabled);

    this.emitEvent('transport:loop', {
      enabled,
    });
  }

  /**
   * Override setLoopPoints to emit events
   */
  setLoopPoints(start: MusicalPosition, end: MusicalPosition): void {
    super.setLoopPoints(start, end);

    this.emitEvent('transport:loop-points', {
      start,
      end,
    });
  }

  /**
   * Start emitting position update events
   */
  private startPositionEvents(): void {
    if (this.eventBusUpdateInterval !== null) {
      return;
    }

    const emit = () => {
      if (this.getState() === 'playing') {
        this.emitEvent('transport:position-updated', {
          position: this.getTransportPosition(),
        });
      }
    };

    // Initial emit
    emit();

    // Set up periodic updates (40Hz to match original)
    this.eventBusUpdateInterval = window.setInterval(emit, 25);
  }

  /**
   * Stop emitting position update events
   */
  private stopPositionEvents(): void {
    if (this.eventBusUpdateInterval !== null) {
      window.clearInterval(this.eventBusUpdateInterval);
      this.eventBusUpdateInterval = null;
    }
  }

  /**
   * Emit event safely
   */
  private emitEvent(event: string, data: any): void {
    if (this.eventBus) {
      try {
        this.eventBus.emit(event, data);
        logger.debug('Event emitted', { event, data });
      } catch (error) {
        logger.error('Failed to emit event', error as Error, { event });
      }
    }
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.stopPositionEvents();
    super.dispose();
    this.eventBus = null;
  }
}
