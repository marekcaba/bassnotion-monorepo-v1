'use client';

/**
 * ResumeOverlay - iOS Background Audio Resume UI
 *
 * When the app is backgrounded on iOS, the AudioContext gets interrupted.
 * When the user returns, we need a user gesture to resume audio.
 * This overlay provides a clear UI for the user to tap to resume.
 *
 * Features:
 * - Listens for 'audio:needs-resume' events from EventBus
 * - Shows overlay with "Tap to Resume" button
 * - Resumes AudioContext on tap
 * - Optionally restores playback position if user was playing
 */

import { useState, useEffect, useCallback } from 'react';
import { useAudioServices } from '../providers/AudioProvider.js';
import { getLogger } from '@/utils/logger';

const logger = getLogger('ResumeOverlay');

interface ResumeData {
  wasPlaying: boolean;
  savedPosition: number;
  contextState?: string;
}

export function ResumeOverlay() {
  const [needsResume, setNeedsResume] = useState(false);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [isResuming, setIsResuming] = useState(false);

  const { coreServices, isInitialized } = useAudioServices();

  // Subscribe to audio:needs-resume events
  useEffect(() => {
    if (!coreServices || !isInitialized) {
      return;
    }

    const eventBus = coreServices.getEventBus();

    const handleNeedsResume = (data: ResumeData) => {
      logger.info('ResumeOverlay: Received needs-resume event', data);
      setNeedsResume(true);
      setResumeData(data);
    };

    // Also listen for audio:interrupted to prepare for resume
    const handleInterrupted = (data: ResumeData) => {
      logger.info('ResumeOverlay: Received interrupted event', data);
      // We'll show the overlay when visibility changes, not immediately on interrupt
      setResumeData(data);
    };

    const unsubscribeResume = eventBus.on(
      'audio:needs-resume',
      handleNeedsResume,
    );
    const unsubscribeInterrupt = eventBus.on(
      'audio:interrupted',
      handleInterrupted,
    );

    return () => {
      unsubscribeResume();
      unsubscribeInterrupt();
    };
  }, [coreServices, isInitialized]);

  // Handle resume action
  const handleResume = useCallback(async () => {
    if (!coreServices || isResuming) {
      return;
    }

    setIsResuming(true);
    logger.info('ResumeOverlay: User tapped to resume audio');

    try {
      const audioEngine = coreServices.getAudioEngine();
      const context = audioEngine.getContext();

      // Resume the AudioContext
      await context.resume();
      logger.info('ResumeOverlay: AudioContext resumed successfully', {
        state: context.state,
      });

      // Optionally restore playback if user was playing before
      if (resumeData?.wasPlaying && resumeData.savedPosition > 0) {
        const transport = coreServices.getUnifiedTransport();

        try {
          // Seek to saved position
          await transport.seek(resumeData.savedPosition);
          // Resume playback
          await transport.start();
          logger.info('ResumeOverlay: Playback restored', {
            position: resumeData.savedPosition,
          });
        } catch (playbackError) {
          logger.error(
            'ResumeOverlay: Failed to restore playback',
            playbackError as Error,
          );
          // Audio is still resumed, just playback restoration failed
        }
      }

      // Emit success event
      coreServices.getEventBus().emit('audio:resumed', {
        timestamp: Date.now(),
        wasPlaying: resumeData?.wasPlaying || false,
        restoredPosition: resumeData?.savedPosition || 0,
      });

      // Hide overlay
      setNeedsResume(false);
      setResumeData(null);
    } catch (error) {
      logger.error('ResumeOverlay: Failed to resume audio', error as Error);
      // Keep overlay visible so user can try again
    } finally {
      setIsResuming(false);
    }
  }, [coreServices, resumeData, isResuming]);

  // Don't render if not needed
  if (!needsResume) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] backdrop-blur-sm"
      onClick={handleResume}
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-2xl max-w-sm mx-4 transform transition-all"
        onClick={(e) => e.stopPropagation()} // Prevent double-triggering
      >
        {/* Music icon */}
        <div className="text-5xl mb-4 animate-pulse">🎵</div>

        {/* Title */}
        <h2
          id="resume-title"
          className="text-xl font-semibold mb-2 text-gray-900 dark:text-white"
        >
          Audio Paused
        </h2>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
          {resumeData?.wasPlaying
            ? 'Your practice session was paused. Tap to continue where you left off.'
            : 'Tap anywhere to enable audio playback.'}
        </p>

        {/* Resume button */}
        <button
          onClick={handleResume}
          disabled={isResuming}
          className={`
            w-full px-6 py-4 rounded-xl font-semibold text-white
            transition-all duration-200 transform
            ${
              isResuming
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 hover:scale-105 active:scale-95'
            }
          `}
        >
          {isResuming ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Resuming...
            </span>
          ) : (
            <>
              {resumeData?.wasPlaying
                ? '▶️ Resume Playback'
                : '🔊 Enable Audio'}
            </>
          )}
        </button>

        {/* Tap anywhere hint */}
        <p className="text-gray-400 dark:text-gray-500 text-xs mt-4">
          or tap anywhere on the screen
        </p>
      </div>
    </div>
  );
}

export default ResumeOverlay;
