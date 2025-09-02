/**
 * YouTubePlaybackSync Service
 *
 * Synchronizes YouTube video player with internal Core Playback Engine for dual-timeline coordination.
 * Handles video seek operations, latency compensation, and maintains sync between video and audio.
 *
 * Part of Story 3.14: Global Playback Synchronization
 * Task 5: YouTube Player Synchronization
 */

import { CorePlaybackEngine } from '@/domains/playback/services/CorePlaybackEngine/CorePlaybackEngine';
import { widgetSyncService } from './WidgetSyncService';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// ============================================================================
// INTERFACES
// ============================================================================

export interface YouTubePlayerConfig {
  videoId: string;
  startTime?: number; // seconds
  endTime?: number; // seconds
  quality?: 'small' | 'medium' | 'large' | 'hd720' | 'hd1080' | 'highres';
  autoplay?: boolean;
  controls?: boolean;
  enablejsapi?: boolean;
}

export interface YouTubeSyncConfig {
  // Synchronization settings
  syncMode: 'video_master' | 'audio_master' | 'bidirectional';
  latencyCompensation: number; // milliseconds
  syncTolerance: number; // milliseconds (acceptable drift)
  autoCorrection: boolean; // Auto-correct drift

  // Performance settings
  updateInterval: number; // milliseconds
  maxCorrectionJump: number; // seconds (max seek distance for correction)

  // Debugging
  enableDebugLogging: boolean;
}

export interface SyncState {
  // Player states
  videoCurrentTime: number;
  videoIsPlaying: boolean;
  videoDuration: number;

  audioCurrentTime: number;
  audioIsPlaying: boolean;

  // Sync status
  isInSync: boolean;
  timeDrift: number; // milliseconds
  lastSyncTime: number;
  correctionsMade: number;

  // Connection status
  isVideoPlayerReady: boolean;
  isAudioEngineReady: boolean;
  isSyncEnabled: boolean;
}

export interface YouTubePlayerAPI {
  // Basic controls
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;

  // State getters
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;

  // Event listeners
  addEventListener(event: string, listener: (event: any) => void): void;
  removeEventListener(event: string, listener: (event: any) => void): void;
}

// YouTube Player States
export const YOUTUBE_PLAYER_STATES = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

// ============================================================================
// YOUTUBE PLAYBACK SYNC CLASS
// ============================================================================

export class YouTubePlaybackSync {
  private static instance: YouTubePlaybackSync | null = null;

  private coreEngine: CorePlaybackEngine;
  private youtubePlayer: YouTubePlayerAPI | null = null;
  private config: YouTubeSyncConfig;
  private syncState: SyncState;
  private isInitialized = false;

  // Timing and synchronization
  private syncTimer: NodeJS.Timeout | null = null;
  private highPrecisionClock: () => number;
  private lastVideoTime = 0;
  private lastAudioTime = 0;

  // Event handlers
  private eventHandlers: Map<string, ((...args: any[]) => void)[]> = new Map();
  private boundEventHandlers: Map<string, (...args: any[]) => void> = new Map();

  // ============================================================================
  // SINGLETON PATTERN
  // ============================================================================

  public static getInstance(): YouTubePlaybackSync {
    if (!YouTubePlaybackSync.instance) {
      YouTubePlaybackSync.instance = new YouTubePlaybackSync();
    }
    return YouTubePlaybackSync.instance;
  }

  private constructor() {
    this.coreEngine = CorePlaybackEngine.getInstance();
    this.highPrecisionClock = () => performance.now();

    // Default configuration
    this.config = {
      syncMode: 'bidirectional',
      latencyCompensation: 100, // 100ms compensation for video latency
      syncTolerance: 200, // 200ms tolerance
      autoCorrection: true,
      updateInterval: 100, // Check sync every 100ms
      maxCorrectionJump: 2, // Max 2 second jump for auto-correction
      enableDebugLogging: false,
    };

    // Initialize sync state
    this.syncState = {
      videoCurrentTime: 0,
      videoIsPlaying: false,
      videoDuration: 0,
      audioCurrentTime: 0,
      audioIsPlaying: false,
      isInSync: true,
      timeDrift: 0,
      lastSyncTime: 0,
      correctionsMade: 0,
      isVideoPlayerReady: false,
      isAudioEngineReady: false,
      isSyncEnabled: false,
    };
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  public async initialize(config?: Partial<YouTubeSyncConfig>): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Update configuration
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // Initialize Core Playback Engine
      await this.coreEngine.initialize();
      this.syncState.isAudioEngineReady = true;

      // Set up event handlers
      this.setupEventHandlers();

      this.isInitialized = true;

      if (this.config.enableDebugLogging) {
        logger.info('[YouTubePlaybackSync] Initialized successfully');
      }
    } catch (error) {
      logger.error('[YouTubePlaybackSync] Initialization failed:', error);
      throw error;
    }
  }

  public async dispose(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Stop sync timer
      this.stopSync();

      // Remove YouTube player event listeners
      if (this.youtubePlayer) {
        this.removeAllYouTubeEventListeners();
      }

      // Clear state
      this.youtubePlayer = null;
      this.syncState.isVideoPlayerReady = false;
      this.syncState.isAudioEngineReady = false;
      this.syncState.isSyncEnabled = false;

      this.isInitialized = false;

      if (this.config.enableDebugLogging) {
        logger.info('[YouTubePlaybackSync] Disposed successfully');
      }
    } catch (error) {
      logger.error('[YouTubePlaybackSync] Disposal failed:', error);
    }
  }

  // ============================================================================
  // YOUTUBE PLAYER INTEGRATION
  // ============================================================================

  public setYouTubePlayer(player: YouTubePlayerAPI): void {
    this.youtubePlayer = player;
    this.syncState.isVideoPlayerReady = true;

    // Set up YouTube player event listeners
    this.setupYouTubeEventListeners();

    // Enable sync if audio engine is also ready
    if (this.syncState.isAudioEngineReady) {
      this.enableSync();
    }

    if (this.config.enableDebugLogging) {
      logger.info('[YouTubePlaybackSync] YouTube player connected');
    }
  }

  public removeYouTubePlayer(): void {
    if (this.youtubePlayer) {
      this.removeAllYouTubeEventListeners();
      this.youtubePlayer = null;
    }

    this.syncState.isVideoPlayerReady = false;
    this.disableSync();

    if (this.config.enableDebugLogging) {
      logger.info('[YouTubePlaybackSync] YouTube player disconnected');
    }
  }

  // ============================================================================
  // SYNCHRONIZATION CONTROL
  // ============================================================================

  public enableSync(): void {
    if (
      !this.syncState.isVideoPlayerReady ||
      !this.syncState.isAudioEngineReady
    ) {
      logger.warn(
        '[YouTubePlaybackSync] Cannot enable sync - not all components ready',
      );
      return;
    }

    this.syncState.isSyncEnabled = true;
    this.startSyncLoop();

    if (this.config.enableDebugLogging) {
      logger.info('[YouTubePlaybackSync] Synchronization enabled');
    }
  }

  public disableSync(): void {
    this.syncState.isSyncEnabled = false;
    this.stopSync();

    if (this.config.enableDebugLogging) {
      logger.info('[YouTubePlaybackSync] Synchronization disabled');
    }
  }

  // ============================================================================
  // PLAYBACK CONTROL
  // ============================================================================

  public async play(): Promise<void> {
    if (!this.youtubePlayer) return;

    try {
      // Synchronize start times
      const audioTime = await this.getAudioCurrentTime();
      const videoTime = this.youtubePlayer.getCurrentTime();

      // Apply latency compensation
      const compensatedTime =
        audioTime + this.config.latencyCompensation / 1000;

      if (
        Math.abs(videoTime - compensatedTime) >
        this.config.syncTolerance / 1000
      ) {
        this.youtubePlayer.seekTo(compensatedTime, true);
      }

      // Start both players
      this.youtubePlayer.playVideo();
      await this.coreEngine.play();

      if (this.config.enableDebugLogging) {
        logger.info(
          `[YouTubePlaybackSync] Play - Video: ${videoTime}s, Audio: ${audioTime}s`,
        );
      }
    } catch (error) {
      logger.error('[YouTubePlaybackSync] Play failed:', error);
    }
  }

  public async pause(): Promise<void> {
    if (!this.youtubePlayer) return;

    try {
      // Pause both players simultaneously
      this.youtubePlayer.pauseVideo();
      await this.coreEngine.pause();

      if (this.config.enableDebugLogging) {
        logger.info('[YouTubePlaybackSync] Paused');
      }
    } catch (error) {
      logger.error('[YouTubePlaybackSync] Pause failed:', error);
    }
  }

  public async stop(): Promise<void> {
    if (!this.youtubePlayer) return;

    try {
      // Stop both players
      this.youtubePlayer.stopVideo();
      await this.coreEngine.stop();

      if (this.config.enableDebugLogging) {
        logger.info('[YouTubePlaybackSync] Stopped');
      }
    } catch (error) {
      logger.error('[YouTubePlaybackSync] Stop failed:', error);
    }
  }

  public async seekTo(seconds: number): Promise<void> {
    if (!this.youtubePlayer) return;

    try {
      // Seek both players with latency compensation
      const compensatedVideoTime =
        seconds + this.config.latencyCompensation / 1000;

      this.youtubePlayer.seekTo(compensatedVideoTime, true);
      // Note: Audio seek would need to be implemented in CorePlaybackEngine

      // Emit sync event
      widgetSyncService.emit({
        type: 'SEEK',
        payload: { currentTime: seconds },
        timestamp: this.highPrecisionClock(),
        source: 'youtube-sync',
        priority: 'high',
      });

      if (this.config.enableDebugLogging) {
        logger.info(
          `[YouTubePlaybackSync] Seek to ${seconds}s (compensated: ${compensatedVideoTime}s)`,
        );
      }
    } catch (error) {
      logger.error('[YouTubePlaybackSync] Seek failed:', error);
    }
  }

  // ============================================================================
  // SYNCHRONIZATION LOOP
  // ============================================================================

  private startSyncLoop(): void {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(() => {
      this.performSyncCheck();
    }, this.config.updateInterval);
  }

  private stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private async performSyncCheck(): Promise<void> {
    if (!this.syncState.isSyncEnabled || !this.youtubePlayer) return;

    try {
      // Get current times
      const videoTime = this.youtubePlayer.getCurrentTime();
      const audioTime = await this.getAudioCurrentTime();

      // Update sync state
      this.syncState.videoCurrentTime = videoTime;
      this.syncState.audioCurrentTime = audioTime;
      this.syncState.videoIsPlaying =
        this.youtubePlayer.getPlayerState() === YOUTUBE_PLAYER_STATES.PLAYING;
      this.syncState.audioIsPlaying = await this.getAudioIsPlaying();

      // Calculate drift (accounting for latency compensation)
      const compensatedVideoTime =
        videoTime - this.config.latencyCompensation / 1000;
      const drift = (compensatedVideoTime - audioTime) * 1000; // Convert to milliseconds
      this.syncState.timeDrift = drift;

      // Check if in sync
      const wasInSync = this.syncState.isInSync;
      this.syncState.isInSync = Math.abs(drift) <= this.config.syncTolerance;

      // Auto-correction if enabled and drift is significant
      if (this.config.autoCorrection && !this.syncState.isInSync) {
        await this.performAutoCorrection(drift);
      }

      // Log sync status changes
      if (
        wasInSync !== this.syncState.isInSync &&
        this.config.enableDebugLogging
      ) {
        logger.info(
          `[YouTubePlaybackSync] Sync status changed: ${this.syncState.isInSync ? 'IN SYNC' : 'OUT OF SYNC'} (drift: ${drift.toFixed(1)}ms)`,
        );
      }

      this.syncState.lastSyncTime = this.highPrecisionClock();
    } catch (error) {
      logger.error('[YouTubePlaybackSync] Sync check failed:', error);
    }
  }

  private async performAutoCorrection(drift: number): Promise<void> {
    const driftSeconds = Math.abs(drift) / 1000;

    // Only perform correction if within reasonable bounds
    if (driftSeconds > this.config.maxCorrectionJump) {
      if (this.config.enableDebugLogging) {
        logger.warn(
          `[YouTubePlaybackSync] Drift too large for auto-correction: ${driftSeconds.toFixed(2)}s`,
        );
      }
      return;
    }

    try {
      if (this.config.syncMode === 'video_master') {
        // Adjust audio to match video
        const targetTime =
          this.syncState.videoCurrentTime -
          this.config.latencyCompensation / 1000;
        // Note: Audio seek would need to be implemented in CorePlaybackEngine
      } else if (this.config.syncMode === 'audio_master') {
        // Adjust video to match audio
        const targetTime =
          this.syncState.audioCurrentTime +
          this.config.latencyCompensation / 1000;
        this.youtubePlayer?.seekTo(targetTime, true);
      } else {
        // Bidirectional: adjust both slightly towards center
        const centerTime =
          (this.syncState.videoCurrentTime + this.syncState.audioCurrentTime) /
          2;
        const videoAdjustment =
          centerTime + this.config.latencyCompensation / 1000;
        this.youtubePlayer?.seekTo(videoAdjustment, true);
        // Note: Audio seek would need to be implemented in CorePlaybackEngine
      }

      this.syncState.correctionsMade++;

      if (this.config.enableDebugLogging) {
        logger.info(
          `[YouTubePlaybackSync] Auto-correction applied (drift was ${drift.toFixed(1)}ms)`,
        );
      }
    } catch (error) {
      logger.error('[YouTubePlaybackSync] Auto-correction failed:', error);
    }
  }

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

  private setupEventHandlers(): void {
    // Listen for global playback events
    widgetSyncService.subscribe('PLAYBACK_STATE', (event) => {
      if (event.source === 'youtube-sync') return; // Avoid feedback loops

      const { isPlaying } = event.payload;
      if (isPlaying && !this.syncState.videoIsPlaying) {
        this.play();
      } else if (!isPlaying && this.syncState.videoIsPlaying) {
        this.pause();
      }
    });

    widgetSyncService.subscribe('TIME_SEEK', (event) => {
      if (event.source === 'youtube-sync') return; // Avoid feedback loops

      const { currentTime } = event.payload;
      this.seekTo(currentTime);
    });
  }

  private setupYouTubeEventListeners(): void {
    if (!this.youtubePlayer) return;

    // State change handler
    const onStateChange = (event: any) => {
      const state = event.data;
      const wasPlaying = this.syncState.videoIsPlaying;
      this.syncState.videoIsPlaying = state === YOUTUBE_PLAYER_STATES.PLAYING;

      // Emit playback state events
      if (wasPlaying !== this.syncState.videoIsPlaying) {
        widgetSyncService.emit({
          type: 'PLAYBACK_STATE',
          payload: { isPlaying: this.syncState.videoIsPlaying },
          timestamp: this.highPrecisionClock(),
          source: 'youtube-sync',
          priority: 'high',
        });
      }
    };

    this.youtubePlayer.addEventListener('onStateChange', onStateChange);
    this.boundEventHandlers.set('onStateChange', onStateChange);
  }

  private removeAllYouTubeEventListeners(): void {
    if (!this.youtubePlayer) return;

    for (const [event, handler] of this.boundEventHandlers) {
      this.youtubePlayer.removeEventListener(event, handler);
    }
    this.boundEventHandlers.clear();
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async getAudioCurrentTime(): Promise<number> {
    // This would need to be implemented in CorePlaybackEngine
    // For now, return a placeholder
    return 0;
  }

  private async getAudioIsPlaying(): Promise<boolean> {
    // This would need to be implemented in CorePlaybackEngine
    // For now, return a placeholder
    return false;
  }

  // ============================================================================
  // PUBLIC GETTERS
  // ============================================================================

  public getSyncState(): SyncState {
    return { ...this.syncState };
  }

  public getConfig(): YouTubeSyncConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<YouTubeSyncConfig>): void {
    this.config = { ...this.config, ...updates };

    if (this.config.enableDebugLogging) {
      logger.info('[YouTubePlaybackSync] Configuration updated:', updates);
    }
  }

  public isReady(): boolean {
    return (
      this.syncState.isVideoPlayerReady && this.syncState.isAudioEngineReady
    );
  }

  public isSyncEnabled(): boolean {
    return this.syncState.isSyncEnabled;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const youTubePlaybackSync = YouTubePlaybackSync.getInstance();
