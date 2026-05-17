'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Bunny Stream Player Hook
 *
 * Uses Bunny Stream's Player.js API for video playback control.
 * Docs: https://docs.bunny.net/docs/playback-control-api
 */

interface UseBunnyPlayerOptions {
  libraryId: string; // Bunny Stream video library ID
  videoId: string; // Bunny Stream video ID
  onTimeUpdate?: (seconds: number) => void;
  onReady?: (duration: number) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  onPlay?: () => void;
  onPause?: () => void;
  /** Disable fullscreen to ensure overlays are visible (default: false) */
  disableFullscreen?: boolean;
}

interface UseBunnyPlayerReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  play: () => void;
  playWithFade: (duration?: number) => void;
  pause: () => void;
  pauseWithFade: (duration?: number) => Promise<void>;
  seekTo: (seconds: number) => Promise<void>;
  getCurrentTime: () => Promise<number>;
  getDuration: () => Promise<number>;
  isPlaying: boolean;
  isReady: boolean;
}

// Player.js library type (loaded from CDN)
interface PlayerJsPlayer {
  play: () => void;
  pause: () => void;
  getPaused: (callback: (paused: boolean) => void) => void;
  mute: () => void;
  unmute: () => void;
  getMuted: (callback: (muted: boolean) => void) => void;
  setVolume: (volume: number) => void;
  getVolume: (callback: (volume: number) => void) => void;
  getDuration: (callback: (duration: number) => void) => void;
  setCurrentTime: (time: number) => void;
  getCurrentTime: (callback: (time: number) => void) => void;
  on: (event: string, callback: (data?: unknown) => void) => void;
  off: (event: string, callback?: (data?: unknown) => void) => void;
  supports: (type: 'method' | 'event', name: string) => boolean;
}

// Global playerjs constructor (loaded via script tag)
declare global {
  interface Window {
    playerjs?: {
      Player: new (iframe: HTMLIFrameElement) => PlayerJsPlayer;
    };
  }
}

// Debug flag
const DEBUG_BUNNY = true;

// Script loading promise to ensure we only load once
let playerJsLoadPromise: Promise<void> | null = null;

function loadPlayerJs(): Promise<void> {
  if (playerJsLoadPromise) return playerJsLoadPromise;

  playerJsLoadPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.playerjs) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = '//assets.mediadelivery.net/playerjs/playerjs-latest.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Player.js'));
    document.head.appendChild(script);
  });

  return playerJsLoadPromise;
}

export function useBunnyPlayer(
  options: UseBunnyPlayerOptions,
): UseBunnyPlayerReturn {
  const {
    libraryId,
    videoId,
    onTimeUpdate,
    onReady,
    onEnded,
    onError,
    onPlay,
    onPause,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerJsPlayer | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const originalVolumeRef = useRef<number>(1); // Store original volume for fade restoration
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Store callbacks in refs to avoid recreating player on callback changes
  const callbacksRef = useRef({
    onTimeUpdate,
    onReady,
    onEnded,
    onError,
    onPlay,
    onPause,
  });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
      onTimeUpdate,
      onReady,
      onEnded,
      onError,
      onPlay,
      onPause,
    };
  }, [onTimeUpdate, onReady, onEnded, onError, onPlay, onPause]);

  // Initialize player
  useEffect(() => {
    if (!containerRef.current || !videoId || !libraryId) return;

    let mounted = true;

    const initPlayer = async () => {
      try {
        // Load Player.js library
        await loadPlayerJs();

        if (!mounted || !containerRef.current || !window.playerjs) return;

        // Clear container
        containerRef.current.innerHTML = '';

        // Create iframe with unique src (append timestamp to avoid conflicts)
        // Add loop=false to prevent video from looping on end
        // Keep autoplay=false - we control play via Player.js API
        const iframe = document.createElement('iframe');
        const uniqueId = Date.now();
        iframe.src = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?t=${uniqueId}&loop=false&autoplay=false&preload=true`;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        // IMPORTANT: 'autoplay' permission is required for programmatic play() to work
        iframe.allow =
          'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;

        containerRef.current.appendChild(iframe);
        iframeRef.current = iframe;

        // Initialize Player.js
        const player = new window.playerjs.Player(iframe);
        playerRef.current = player;

        // Set up event listeners
        player.on('ready', () => {
          if (DEBUG_BUNNY) {
            console.log('[useBunnyPlayer] Player ready event received');
          }
          if (!mounted) return;

          player.getDuration((duration) => {
            if (!mounted) return;
            if (DEBUG_BUNNY) {
              console.log(
                '[useBunnyPlayer] Duration received:',
                duration,
                'setting isReady=true',
              );
            }
            setIsReady(true);
            callbacksRef.current.onReady?.(duration);
          });
        });

        player.on('timeupdate', (data: unknown) => {
          if (!mounted) return;
          const { seconds } = data as { seconds: number; duration: number };
          callbacksRef.current.onTimeUpdate?.(seconds);
        });

        player.on('play', () => {
          if (DEBUG_BUNNY) {
            console.log('[useBunnyPlayer] Play event received from player');
          }
          if (!mounted) return;
          setIsPlaying(true);
          callbacksRef.current.onPlay?.();
        });

        player.on('pause', () => {
          if (!mounted) return;
          setIsPlaying(false);
          callbacksRef.current.onPause?.();
        });

        player.on('ended', () => {
          if (!mounted) return;
          setIsPlaying(false);
          callbacksRef.current.onEnded?.();
        });

        player.on('error', () => {
          if (!mounted) return;
          callbacksRef.current.onError?.(new Error('Video playback error'));
        });
      } catch (error) {
        if (!mounted) return;
        callbacksRef.current.onError?.(
          error instanceof Error
            ? error
            : new Error('Failed to initialize player'),
        );
      }
    };

    initPlayer();

    // Cleanup
    return () => {
      mounted = false;
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
      playerRef.current = null;
      iframeRef.current = null;
      setIsReady(false);
      setIsPlaying(false);
    };
  }, [videoId, libraryId]);

  // Player controls
  const play = useCallback(() => {
    if (DEBUG_BUNNY) {
      console.log(
        '[useBunnyPlayer] play() called, playerRef.current:',
        !!playerRef.current,
        'isReady:',
        isReady,
      );
    }
    if (playerRef.current) {
      playerRef.current.play();
      if (DEBUG_BUNNY) {
        console.log('[useBunnyPlayer] play() executed on player');
      }
    } else {
      if (DEBUG_BUNNY) {
        console.log('[useBunnyPlayer] play() skipped - no player ref');
      }
    }
  }, [isReady]);

  // Play with audio fade in for smoother resume after questions
  const playWithFade = useCallback((duration = 2000): void => {
    const player = playerRef.current;
    if (!player) return;

    // Clear any existing fade interval
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    // Target volume is what was stored before fade-out, or full volume (1)
    const targetVolume = originalVolumeRef.current || 1;

    // Start at volume 0 and fade in
    player.setVolume(0);
    player.play();

    const steps = 20; // More steps for smoother fade
    const stepDuration = duration / steps;
    const volumeStep = targetVolume / steps;
    let currentStep = 0;

    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      const newVolume = Math.min(targetVolume, volumeStep * currentStep);
      player.setVolume(newVolume);

      if (currentStep >= steps) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
        // Ensure we're at target volume
        player.setVolume(targetVolume);
      }
    }, stepDuration);
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pause();
  }, []);

  // Pause with audio fade out for smoother transitions
  const pauseWithFade = useCallback((duration = 200): Promise<void> => {
    return new Promise((resolve) => {
      const player = playerRef.current;
      if (!player) {
        resolve();
        return;
      }

      // Clear any existing fade interval
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }

      // Get current volume and store it
      player.getVolume((currentVolume) => {
        originalVolumeRef.current = currentVolume;

        const steps = 10; // Number of fade steps
        const stepDuration = duration / steps;
        const volumeStep = currentVolume / steps;
        let currentStep = 0;

        fadeIntervalRef.current = setInterval(() => {
          currentStep++;
          const newVolume = Math.max(
            0,
            currentVolume - volumeStep * currentStep,
          );
          player.setVolume(newVolume);

          if (currentStep >= steps) {
            if (fadeIntervalRef.current) {
              clearInterval(fadeIntervalRef.current);
              fadeIntervalRef.current = null;
            }
            // Actually pause the video
            player.pause();
            // Restore original volume (so it's ready for next play)
            player.setVolume(originalVolumeRef.current);
            resolve();
          }
        }, stepDuration);
      });
    });
  }, []);

  const seekTo = useCallback((seconds: number): Promise<void> => {
    return new Promise((resolve) => {
      if (playerRef.current) {
        playerRef.current.setCurrentTime(seconds);
        // Player.js doesn't have a callback for setCurrentTime, resolve after small delay
        setTimeout(resolve, 100);
      } else {
        resolve();
      }
    });
  }, []);

  const getCurrentTime = useCallback((): Promise<number> => {
    return new Promise((resolve) => {
      if (playerRef.current) {
        playerRef.current.getCurrentTime((time) => {
          resolve(time);
        });
      } else {
        resolve(0);
      }
    });
  }, []);

  const getDuration = useCallback((): Promise<number> => {
    return new Promise((resolve) => {
      if (playerRef.current) {
        playerRef.current.getDuration((duration) => {
          resolve(duration);
        });
      } else {
        resolve(0);
      }
    });
  }, []);

  return {
    containerRef,
    play,
    playWithFade,
    pause,
    pauseWithFade,
    seekTo,
    getCurrentTime,
    getDuration,
    isPlaying,
    isReady,
  };
}
