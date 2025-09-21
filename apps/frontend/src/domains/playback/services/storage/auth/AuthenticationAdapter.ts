/**
 * Authentication Adapter for Playback Domain
 *
 * Thin adapter that wraps shared authentication infrastructure
 * for playback-specific needs
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createStructuredLogger } from '@bassnotion/contracts';
import {
  AuthenticationManager,
  SecurityMonitor,
} from '@/shared/infrastructure/storage/index.js';
import type {
  AuthenticationConfig,
  AuthenticationMetrics,
  SessionState,
  StorageTokenInfo,
} from '@bassnotion/contracts';

const logger = createStructuredLogger('PlaybackAuthAdapter');

export class PlaybackAuthenticationManager extends AuthenticationManager {
  private playbackSpecificFeatures: {
    autoResumePlayback: boolean;
    savePlaybackState: boolean;
  };

  constructor(
    config: AuthenticationConfig,
    supabaseClient: SupabaseClient,
    metrics: AuthenticationMetrics,
    playbackFeatures = { autoResumePlayback: true, savePlaybackState: true },
  ) {
    super(config, supabaseClient, metrics);
    this.playbackSpecificFeatures = playbackFeatures;
  }

  /**
   * Override authenticate to add playback-specific logic
   */
  async authenticate(credentials?: any): Promise<SessionState> {
    const session = await super.authenticate(credentials);

    if (this.playbackSpecificFeatures.autoResumePlayback) {
      logger.info('Preparing to resume playback state after authentication');
      // Domain-specific logic for resuming playback would go here
    }

    return session;
  }

  /**
   * Override signOut to handle playback cleanup
   */
  async signOut(): Promise<void> {
    if (this.playbackSpecificFeatures.savePlaybackState) {
      logger.info('Saving playback state before sign out');
      // Domain-specific logic for saving playback state would go here
    }

    await super.signOut();
  }

  /**
   * Get auth headers with playback-specific additions
   */
  async getPlaybackAuthHeaders(): Promise<Record<string, string>> {
    const headers = await this.getAuthHeaders();

    // Add playback-specific headers if needed
    return {
      ...headers,
      'X-Playback-Domain': 'true',
    };
  }
}

export class PlaybackSecurityMonitor extends SecurityMonitor {
  constructor(config: any, metrics: AuthenticationMetrics) {
    super(config, metrics);
  }

  /**
   * Track playback-specific security events
   */
  trackPlaybackEvent(eventType: string, details: any): void {
    this.trackEvent({
      type: 'PLAYBACK_EVENT',
      success: true,
      userId: details.userId,
      deviceInfo: details.deviceInfo,
      metadata: {
        playbackEventType: eventType,
        ...details,
      },
    });
  }
}
