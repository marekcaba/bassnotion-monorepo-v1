'use client';

/**
 * DrumEditorTransport Component
 *
 * Playback controls for the drum pattern editor.
 * Play, Stop, Loop toggle, and tempo control.
 */

import React, { useCallback } from 'react';
import { Play, Square, Repeat } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import type { DrumEditorTransportProps } from './types.js';
import { TEMPO_LIMITS } from './constants.js';

/**
 * DrumEditorTransport Component
 */
export function DrumEditorTransport({
  isPlaying,
  isLooping,
  tempo,
  onPlay,
  onStop,
  onToggleLoop,
  onTempoChange,
}: DrumEditorTransportProps) {
  // Handle tempo input change
  const handleTempoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value)) {
        onTempoChange(
          Math.max(TEMPO_LIMITS.min, Math.min(TEMPO_LIMITS.max, value)),
        );
      }
    },
    [onTempoChange],
  );

  // Handle play/stop toggle
  const handlePlayStop = useCallback(() => {
    if (isPlaying) {
      onStop();
    } else {
      onPlay();
    }
  }, [isPlaying, onPlay, onStop]);

  return (
    <div className="flex items-center gap-3 p-2.5 bg-zinc-900/80 rounded-lg border border-zinc-800">
      {/* Play/Stop Button */}
      <Button
        size="sm"
        onClick={handlePlayStop}
        className={`w-24 ${
          isPlaying
            ? 'bg-red-600 hover:bg-red-500 text-white'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
        }`}
      >
        {isPlaying ? (
          <>
            <Square className="h-4 w-4 mr-2" />
            Stop
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" />
            Play
          </>
        )}
      </Button>

      {/* Loop Toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleLoop}
        title={isLooping ? 'Looping enabled' : 'Looping disabled'}
        className={
          isLooping
            ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/50'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
        }
      >
        <Repeat className="h-4 w-4" />
      </Button>

      {/* Separator */}
      <div className="w-px h-6 bg-zinc-700" />

      {/* Tempo Control */}
      <div className="flex items-center gap-2">
        <Label
          htmlFor="tempo"
          className="text-xs text-zinc-400 whitespace-nowrap font-medium"
        >
          BPM
        </Label>
        <Input
          id="tempo"
          type="number"
          min={TEMPO_LIMITS.min}
          max={TEMPO_LIMITS.max}
          value={tempo}
          onChange={handleTempoChange}
          className="w-20 h-8 text-center bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-zinc-500 focus:ring-zinc-500"
        />
      </div>

      {/* Playback indicator */}
      {isPlaying && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Playing
        </div>
      )}
    </div>
  );
}
