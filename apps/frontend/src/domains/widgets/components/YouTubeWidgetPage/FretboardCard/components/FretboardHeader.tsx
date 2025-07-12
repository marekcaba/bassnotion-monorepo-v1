import React from 'react';
import { RotateCw, Volume2, VolumeX, Settings, BarChart3 } from 'lucide-react';
import type { StringCount } from '../types/fretboardTypes';
import type { PlaybackPosition } from '../../../../hooks/useAudioFretboard';

interface FretboardHeaderProps {
  syncStatus: string;
  tiltAngle: number;
  onTiltAngleChange: (angle: number) => void;
  hasSelectedDots: boolean;
  onReset: () => void;
  isAudioEnabled: boolean;
  isConnected: boolean;
  playbackPosition?: PlaybackPosition;
}

export const FretboardHeader: React.FC<FretboardHeaderProps> = ({
  syncStatus,
  tiltAngle,
  onTiltAngleChange,
  hasSelectedDots,
  onReset,
  isAudioEnabled,
  isConnected,
  playbackPosition,
}) => {
  return (
    <div className="relative mb-4">
      {/* Neumorphic Header Panel */}
      <div className="bg-slate-800 rounded-2xl px-4 py-3 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300">
        <div className="flex items-center justify-between">
          
          {/* Left Side - Sync Status */}
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full shadow-[1px_1px_2px_rgba(0,0,0,0.4),-1px_-1px_2px_rgba(255,255,255,0.1)] ${
                isConnected ? 'bg-green-400' : 'bg-red-400'
              }`}
              role="img"
              aria-label={isConnected ? 'Widget synchronized' : 'Widget sync error'}
              title={isConnected ? 'Synced' : 'Sync error'}
            />
            <div>
              <h3 className="font-semibold text-sm text-white">
                🎸 Interactive Fretboard
              </h3>
              <p className="text-xs text-slate-400">
                {syncStatus} • {hasSelectedDots ? 'Notes Selected' : 'Ready'}
              </p>
            </div>
          </div>

          {/* Center - Playback Status */}
          {playbackPosition?.isPlaying && playbackPosition.currentNote && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <div className="text-sm text-blue-300">
                <span className="font-medium">
                  {playbackPosition.currentNote.note}
                  {playbackPosition.currentNote.octave}
                </span>
                <span className="ml-2 text-xs">
                  {Math.round(playbackPosition.progress * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Right Side - Integrated Controls */}
          <div className="flex items-center gap-3">
            {/* Audio Status */}
            <div className="flex items-center gap-1">
              {isAudioEnabled ? (
                <Volume2 className="w-4 h-4 text-green-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
              <span className="text-xs text-slate-400">
                {isAudioEnabled ? 'Audio' : 'Muted'}
              </span>
            </div>

            {/* Reset Action */}
            {hasSelectedDots && (
              <button
                onClick={onReset}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-all duration-200 border border-slate-600/30"
                title="Clear Selection"
              >
                <RotateCw className="w-3 h-3 text-orange-400" />
                <span className="text-xs text-orange-400">Clear</span>
              </button>
            )}

            {/* Tilt Info */}
            <div className="flex items-center gap-1">
              <Settings className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">
                {tiltAngle}°
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
