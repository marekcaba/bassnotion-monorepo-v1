'use client';

import { useCallback, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { getCachedAudio } from '../hooks/useAssessmentAudioPreloader';

export interface AudioPlayerRef {
  stop: () => void;
}

interface AudioPlayerProps {
  url: string;
  label?: string;
  className?: string;
}

const FADE_DURATION_MS = 150; // Longer fade for more noticeable effect
const FADE_STEPS = 15;

/**
 * Resolve audio URL - handles both full URLs and Supabase storage paths
 */
function resolveAudioUrl(url: string): string {
  // If it's already a full URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
    return url;
  }

  // Otherwise, it's a Supabase storage path - resolve it
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    // Fallback to local path during development
    return `/audio/${url}`;
  }
  return `${supabaseUrl}/storage/v1/object/public/audio-samples/${url}`;
}

/**
 * Fade audio volume over duration
 */
function fadeVolume(
  audio: HTMLAudioElement,
  fromVolume: number,
  toVolume: number,
  durationMs: number,
  onComplete?: () => void
): void {
  const steps = FADE_STEPS;
  const stepDuration = durationMs / steps;
  const volumeStep = (toVolume - fromVolume) / steps;
  let currentStep = 0;

  const interval = setInterval(() => {
    currentStep++;
    audio.volume = Math.max(0, Math.min(1, fromVolume + volumeStep * currentStep));

    if (currentStep >= steps) {
      clearInterval(interval);
      audio.volume = toVolume;
      onComplete?.();
    }
  }, stepDuration);
}

export const AudioPlayer = forwardRef<AudioPlayerRef, AudioPlayerProps>(
  function AudioPlayer({ url, label, className }, ref) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Resolve the full audio URL at runtime
    const resolvedUrl = useMemo(() => resolveAudioUrl(url), [url]);

    // Stop audio with fade out - exposed via ref
    const stopAudio = useCallback(() => {
      const audio = audioRef.current;
      if (!audio) return;

      if (!audio.paused) {
        fadeVolume(audio, audio.volume, 0, FADE_DURATION_MS, () => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1; // Reset volume for next play
          setIsPlaying(false);
        });
      } else {
        audio.currentTime = 0;
        setIsPlaying(false);
      }
    }, []);

    // Expose stop method via ref
    useImperativeHandle(ref, () => ({
      stop: stopAudio
    }), [stopAudio]);

    const handlePlay = useCallback(() => {
      if (!audioRef.current) {
        // Try to use cached audio first (FAANG pattern - instant playback)
        const cachedAudio = getCachedAudio(url);

        let audio: HTMLAudioElement;
        if (cachedAudio) {
          // Use preloaded audio - instant playback!
          audio = cachedAudio;
          console.log('[AudioPlayer] Using preloaded audio for:', url);
        } else {
          // Fallback: Create new audio element (will need to load)
          audio = new Audio(resolvedUrl);
          console.log('[AudioPlayer] Creating new audio (not preloaded):', url);
        }

        audio.volume = 0; // Start at 0 for fade in
        audioRef.current = audio;

        audio.addEventListener('playing', () => {
          setIsPlaying(true);
          setIsLoading(false);
          // Fade in
          fadeVolume(audio, 0, 1, FADE_DURATION_MS);
        });

        audio.addEventListener('ended', () => {
          setIsPlaying(false);
          audio.volume = 1; // Reset volume
        });

        audio.addEventListener('pause', () => {
          setIsPlaying(false);
        });

        audio.addEventListener('error', () => {
          setIsLoading(false);
          setIsPlaying(false);
        });
      }

      const audio = audioRef.current;

      if (isPlaying) {
        // Fade out then stop
        fadeVolume(audio, audio.volume, 0, FADE_DURATION_MS, () => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1; // Reset for next play
        });
      } else {
        setIsLoading(true);
        audio.currentTime = 0;
        audio.volume = 0; // Start at 0 for fade in
        audio.play().catch(() => {
          setIsLoading(false);
        });
      }
    }, [url, resolvedUrl, isPlaying]);

  return (
    <button
      onClick={handlePlay}
      disabled={isLoading}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-xl',
        'bg-gradient-to-r from-amber-500/20 to-orange-500/20',
        'border border-amber-500/30',
        'text-amber-300 hover:text-amber-200',
        'transition-all duration-200',
        'hover:from-amber-500/30 hover:to-orange-500/30',
        'hover:border-amber-500/50',
        'active:scale-95',
        isPlaying && 'from-amber-500/40 to-orange-500/40 border-amber-500/60',
        isLoading && 'opacity-70 cursor-wait',
        className,
      )}
      aria-label={isPlaying ? 'Stop audio' : 'Play audio'}
    >
      {/* Play/Stop icon */}
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      ) : isPlaying ? (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      ) : (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      )}

      {/* Label */}
      <span className="text-sm font-medium">
        {label || (isPlaying ? 'Playing...' : 'Play Audio')}
      </span>

      {/* Sound wave animation when playing */}
      {isPlaying && (
        <div className="flex items-center gap-0.5 ml-1">
          <div className="w-1 h-3 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="w-1 h-4 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
          <div className="w-1 h-2 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </button>
  );
});
