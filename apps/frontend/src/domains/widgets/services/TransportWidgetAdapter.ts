/**
 * TransportWidgetAdapter Service
 * Story 3.17b: Unified Transport Control
 *
 * Provides an adapter for widgets to integrate with UnifiedTransportController.
 * Handles transport synchronization and beat tracking for widgets.
 */

// Epic 3.18: UnifiedTransportController removed - use UnifiedTransport stub instead
import { TransportAdapter } from '@/domains/playback/services/core/index.js';

// Stub types
type TransportState = 'stopped' | 'playing' | 'paused';
interface TransportPosition {
  seconds: number;
  ticks: number;
  bars: number;
  beats: number;
  subdivision: number;
}
interface TransportObserver {
  onStateChange?: (state: TransportState) => void;
  onPositionChange?: (position: TransportPosition) => void;
  onBeat?: (beatNumber: number, time: number) => void;
  onBar?: (barNumber: number, time: number) => void;
}

// Stub UnifiedTransportController that wraps UnifiedTransport for backward compatibility
class UnifiedTransportController {
  private static instance: UnifiedTransportController | null = null;
  private unifiedTransport: TransportAdapter | null = null;

  static getInstance() {
    if (!this.instance) {
      this.instance = new UnifiedTransportController();
    }
    return this.instance;
  }

  constructor() {
    // Try to get UnifiedTransport from CoreServices
    const coreServices = (window as any).__coreServices;
    if (coreServices) {
      try {
        this.unifiedTransport =
          coreServices.getUnifiedTransport() as TransportAdapter;
      } catch (error) {
        logger.warn(
          'UnifiedTransportController stub: Failed to get UnifiedTransport from CoreServices',
        );
      }
    }

    // No fallback - if CoreServices isn't ready, we wait
    if (!this.unifiedTransport) {
      logger.info(
        'TransportWidgetAdapter: UnifiedTransport not available from CoreServices yet',
      );
    }
  }

  isInitialized(): boolean {
    return this.unifiedTransport?.isInitialized() ?? true;
  }

  async initialize(): Promise<void> {
    if (this.unifiedTransport && !this.unifiedTransport.isInitialized()) {
      await this.unifiedTransport.initialize();
    }
  }

  register(adapter: any, priority?: number): void {
    // UnifiedTransport doesn't have register method - this is a no-op
  }

  unregister(adapter: any): void {
    // UnifiedTransport doesn't have unregister method - this is a no-op
  }

  subscribe(observer: TransportObserver): void {
    // UnifiedTransport doesn't have subscribe method - this is a no-op
  }

  unsubscribe(observer: TransportObserver): void {
    // UnifiedTransport doesn't have unsubscribe method - this is a no-op
  }

  getTransportState(): TransportState {
    return this.unifiedTransport?.getState() ?? 'stopped';
  }

  getCurrentPosition(): TransportPosition {
    return (
      this.unifiedTransport?.getMusicalPosition() ?? {
        seconds: 0,
        ticks: 0,
        bars: 0,
        beats: 0,
        subdivision: 0,
      }
    );
  }

  getPosition(): TransportPosition {
    return this.getCurrentPosition();
  }

  async start(): Promise<void> {
    if (this.unifiedTransport) {
      await this.unifiedTransport.start();
    }
  }

  async stop(): Promise<void> {
    if (this.unifiedTransport) {
      await this.unifiedTransport.stop();
    }
  }

  async pause(): Promise<void> {
    if (this.unifiedTransport) {
      await this.unifiedTransport.pause();
    }
  }

  setTempo(bpm: number): void {
    if (this.unifiedTransport) {
      this.unifiedTransport.setTempo(bpm);
    }
  }

  getTempo(): number {
    return this.unifiedTransport?.getTempo() ?? 120;
  }

  setTimeSignature(numerator: number, denominator: number): void {
    if (this.unifiedTransport) {
      this.unifiedTransport.setTimeSignature(numerator, denominator);
    }
  }
}
import { widgetSyncService } from './WidgetSyncService';
import { logDebug, logError } from '@/domains/playback/utils/logger';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// ============================================================================
// INTERFACES
// ============================================================================

export interface WidgetTransportConfig {
  widgetId: string;
  widgetType: string;
  priority?: number;

  // Callbacks
  onBeat?: (beatNumber: number, time: number) => void;
  onBar?: (barNumber: number, time: number) => void;
  onStop?: () => void;
  onStart?: () => void;
  onPause?: () => void;

  // Beat tracking configuration
  enableBeatTracking?: boolean;
  beatSubdivision?: number; // How many beats per bar to track
}

export interface BeatInfo {
  currentBeat: number;
  currentBar: number;
  isDownbeat: boolean;
  time: number;
  position: string;
}

// ============================================================================
// TRANSPORT WIDGET ADAPTER
// ============================================================================

export class TransportWidgetAdapter implements TransportObserver {
  private unifiedTransport: UnifiedTransportController;
  private config: WidgetTransportConfig;
  private isRegistered = false;

  // Beat tracking
  private lastBeat = -1;
  private lastBar = -1;
  private beatsPerBar = 4;

  // Event deduplication
  private lastBeatTime = 0;
  private lastBarTime = 0;
  private readonly MIN_BEAT_INTERVAL_MS = 50; // Minimum time between beat events

  // State
  private currentState: TransportState = 'stopped';

  constructor(config: WidgetTransportConfig) {
    this.config = config;
    this.unifiedTransport = UnifiedTransportController.getInstance();
  }

  // ============================================================================
  // TRANSPORT OBSERVER IMPLEMENTATION
  // ============================================================================

  get widgetId(): string {
    return this.config.widgetId;
  }

  async onTransportStart(): Promise<void> {
    logger.info(
      `[TransportWidgetAdapter] onTransportStart called for widget: ${this.config.widgetId}`,
    );

    // Update state immediately
    this.currentState = 'playing';

    // Reset beat tracking
    this.lastBeat = -1;
    this.lastBar = -1;

    // Notify widget
    if (this.config.onStart) {
      logger.info(
        `[TransportWidgetAdapter] Calling onStart callback for widget: ${this.config.widgetId}`,
      );
      this.config.onStart();
    }

    // Emit sync event
    widgetSyncService.emit({
      type: 'TRANSPORT_START',
      payload: { widgetId: this.widgetId },
      timestamp: Date.now(),
      source: this.widgetId,
      priority: 'high',
    });
  }

  onTransportStop(): void {
    // Update state immediately
    this.currentState = 'stopped';

    // Reset beat tracking
    this.lastBeat = -1;
    this.lastBar = -1;

    // Notify widget
    if (this.config.onStop) {
      this.config.onStop();
    }

    // Emit sync event
    widgetSyncService.emit({
      type: 'TRANSPORT_STOP',
      payload: { widgetId: this.widgetId },
      timestamp: Date.now(),
      source: this.widgetId,
      priority: 'high',
    });
  }

  onTransportPause(): void {
    // Notify widget
    if (this.config.onPause) {
      this.config.onPause();
    }

    // Emit sync event
    widgetSyncService.emit({
      type: 'TRANSPORT_PAUSE',
      payload: { widgetId: this.widgetId },
      timestamp: Date.now(),
      source: this.widgetId,
      priority: 'high',
    });
  }

  onTransportPositionChange(position: string): void {
    if (!this.config.enableBeatTracking) return;

    // Parse position string (format: "bars:beats:sixteenths")
    const [bars, beats] = position.split(':').map(Number);
    const now = Date.now();

    // Check for beat change
    if (beats !== this.lastBeat) {
      // Deduplicate beat events
      if (now - this.lastBeatTime >= this.MIN_BEAT_INTERVAL_MS) {
        this.lastBeat = beats;
        this.lastBeatTime = now;

        // Calculate actual beat number (1-based)
        const beatNumber = bars * this.beatsPerBar + beats + 1;

        // Notify widget of beat
        if (this.config.onBeat) {
          this.config.onBeat(beatNumber, now);
        }

        // Check for downbeat (first beat of bar)
        if (beats === 0 && this.config.onBar) {
          // Deduplicate bar events
          if (now - this.lastBarTime >= this.MIN_BEAT_INTERVAL_MS) {
            this.lastBar = bars;
            this.lastBarTime = now;
            this.config.onBar(bars + 1, now);
          }
        }
      }
    }
  }

  onTransportStateChange(state: TransportState): void {
    this.currentState = state;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize and register with transport
   */
  public async initialize(): Promise<void> {
    if (this.isRegistered) return;

    try {
      // Ensure transport is initialized
      if (!this.unifiedTransport.isInitialized()) {
        await this.unifiedTransport.initialize();
      }

      // Register this adapter
      this.unifiedTransport.register(this, this.config.priority || 0);
      this.isRegistered = true;

      logDebug(
        '[TransportWidgetAdapter]',
        `Registered widget: ${this.widgetId}`,
      );
    } catch (error) {
      logError(
        '[TransportWidgetAdapter]',
        `Failed to initialize for ${this.widgetId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Cleanup and unregister
   */
  public dispose(): void {
    if (this.isRegistered) {
      this.unifiedTransport.unregister(this.widgetId);
      this.isRegistered = false;
    }
  }

  /**
   * Get current transport state
   */
  public getState(): TransportState {
    return this.currentState;
  }

  /**
   * Get current position
   */
  public getPosition(): TransportPosition {
    return this.unifiedTransport.getPosition();
  }

  /**
   * Get current tempo
   */
  public getTempo(): number {
    return this.unifiedTransport.getTempo();
  }

  /**
   * Set beats per bar for beat tracking
   */
  public setBeatsPerBar(beats: number): void {
    this.beatsPerBar = beats;
  }

  /**
   * Check if transport is playing
   */
  public isPlaying(): boolean {
    return this.currentState === 'playing';
  }

  /**
   * Get beat info for current position
   */
  public getBeatInfo(): BeatInfo {
    const position = this.unifiedTransport.getPosition();
    const currentBeat = position.bars * this.beatsPerBar + position.beats + 1;

    return {
      currentBeat,
      currentBar: position.bars + 1,
      isDownbeat: position.beats === 0,
      time: Date.now(),
      position: `${position.bars}:${position.beats}:${position.sixteenths}`,
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a transport adapter for a widget
 */
export function createTransportAdapter(
  config: WidgetTransportConfig,
): TransportWidgetAdapter {
  return new TransportWidgetAdapter(config);
}
