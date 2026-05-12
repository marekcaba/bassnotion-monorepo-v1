'use client';

/**
 * SegmentVideoPlayer
 *
 * Plays a single video segment using Bunny Stream.
 * Uses Player.js library for reliable event handling (same as V1).
 * Styled to match V1 assessment video container.
 */

import { useEffect, useRef } from 'react';
import type { VideoSegment } from '@bassnotion/contracts';

export interface SegmentVideoPlayerProps {
  segment: VideoSegment;
  onReady: (duration: number) => void;
  onTimeUpdate: (currentTime: number) => void;
  onEnded: () => void;
}

// Player.js library type (loaded from CDN)
interface PlayerJsPlayer {
  play: () => void;
  pause: () => void;
  getDuration: (callback: (duration: number) => void) => void;
  getCurrentTime: (callback: (time: number) => void) => void;
  on: (event: string, callback: (data?: unknown) => void) => void;
}

// Global playerjs constructor (loaded via script tag)
declare global {
  interface Window {
    playerjs?: {
      Player: new (iframe: HTMLIFrameElement) => PlayerJsPlayer;
    };
  }
}

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

export function SegmentVideoPlayer({
  segment,
  onReady,
  onTimeUpdate,
  onEnded,
}: SegmentVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerJsPlayer | null>(null);

  // Store callbacks in refs to avoid recreating player on callback changes
  const callbacksRef = useRef({ onReady, onTimeUpdate, onEnded });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = { onReady, onTimeUpdate, onEnded };
  }, [onReady, onTimeUpdate, onEnded]);

  // Initialize player
  useEffect(() => {
    if (!containerRef.current || !segment.videoId || !segment.videoLibraryId) return;

    let mounted = true;

    const initPlayer = async () => {
      try {
        // Load Player.js library
        await loadPlayerJs();

        if (!mounted || !containerRef.current || !window.playerjs) return;

        // Clear container
        containerRef.current.innerHTML = '';

        // Create iframe with unique src and autoplay
        const iframe = document.createElement('iframe');
        const uniqueId = Date.now();
        iframe.src = `https://iframe.mediadelivery.net/embed/${segment.videoLibraryId}/${segment.videoId}?t=${uniqueId}&autoplay=true&loop=false`;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;

        containerRef.current.appendChild(iframe);

        // Initialize Player.js
        const player = new window.playerjs.Player(iframe);
        playerRef.current = player;

        // Set up event listeners
        player.on('ready', () => {
          if (!mounted) return;

          player.getDuration((duration) => {
            if (!mounted) return;
            callbacksRef.current.onReady(duration || segment.durationSeconds || 0);
          });
        });

        player.on('timeupdate', (data: unknown) => {
          if (!mounted) return;
          const { seconds } = data as { seconds: number; duration: number };
          callbacksRef.current.onTimeUpdate(seconds);
        });

        player.on('ended', () => {
          if (!mounted) return;
          callbacksRef.current.onEnded();
        });
      } catch (error) {
        console.error('Failed to initialize segment player:', error);
      }
    };

    initPlayer();

    // Cleanup
    return () => {
      mounted = false;
      playerRef.current = null;
    };
  }, [segment.videoId, segment.videoLibraryId, segment.durationSeconds]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full bg-gray-900"
    />
  );
}
