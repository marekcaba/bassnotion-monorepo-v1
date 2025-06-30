'use client';

import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  RotateCcw,
} from 'lucide-react';
import { UsePlaybackIntegrationReturn } from '../../../hooks/usePlaybackIntegration';

interface PlaybackControlsProps {
  /** Playback integration instance */
  playbackIntegration: UsePlaybackIntegrationReturn;

  /** Master volume (0-100) */
  masterVolume: number;

  /** Whether master is muted */
  isMasterMuted: boolean;

  /** Individual source volumes */
  sourceVolumes: {
    bass: number;
    youtube: number;
    metronome: number;
    drums: number;
  };

  /** Individual source mutes */
  sourceMutes: {
    bass: boolean;
    youtube: boolean;
    metronome: boolean;
    drums: boolean;
  };

  /** Callbacks */
  onMasterVolumeChange: (volume: number) => void;
  onMasterMuteToggle: () => void;
  onSourceVolumeChange: (source: string, volume: number) => void;
  onSourceMuteToggle: (source: string) => void;
  onSeek?: (position: number) => void;
}

export function PlaybackControls({
  playbackIntegration,
  masterVolume,
  isMasterMuted,
  sourceVolumes,
  sourceMutes,
  onMasterVolumeChange,
  onMasterMuteToggle,
  onSourceVolumeChange,
  onSourceMuteToggle,
  onSeek: _onSeek,
}: PlaybackControlsProps) {
  const { state, controls } = playbackIntegration;

  const handlePlay = async () => {
    try {
      await controls.play();
    } catch (error) {
      console.error('❌ Failed to start playback:', error);
    }
  };

  const handlePause = () => {
    controls.pause();
  };

  const handleStop = () => {
    controls.stop();
  };

  const handleReset = () => {
    controls.reset();
  };

  const handleMasterVolumeChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const volume = parseInt(event.target.value, 10);
    onMasterVolumeChange(volume);
    controls.setVolume('master', volume);
  };

  const handleSourceVolumeChange =
    (source: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const volume = parseInt(event.target.value, 10);
      onSourceVolumeChange(source, volume);
      controls.setVolume(source, volume);
    };

  if (!state.isInitialized) {
    return (
      <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-center text-slate-400">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3" />
            Initializing playback engine...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state.error) {
    return (
      <Card className="bg-red-900/30 backdrop-blur-xl border border-red-700/50">
        <CardContent className="p-4">
          <div className="text-red-300 text-sm">
            ❌ Playback Error: {state.error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-lg">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Volume2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">
              🎛️ Global Playback Controls
            </h3>
            <p className="text-xs text-slate-300">
              Tempo: {state.tempo} BPM | Latency: {state.latency.toFixed(1)}ms
            </p>
          </div>
        </div>

        {/* Main Transport Controls */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            size="lg"
            onClick={handlePlay}
            disabled={state.isPlaying}
            className="bg-green-600 hover:bg-green-500 text-white disabled:opacity-50"
          >
            <Play className="w-5 h-5" />
          </Button>

          <Button
            size="lg"
            onClick={handlePause}
            disabled={!state.isPlaying}
            className="bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50"
          >
            <Pause className="w-5 h-5" />
          </Button>

          <Button
            size="lg"
            onClick={handleStop}
            className="bg-red-600 hover:bg-red-500 text-white"
          >
            <Square className="w-5 h-5" />
          </Button>

          <div className="w-px h-8 bg-slate-600 mx-2" />

          <Button
            size="sm"
            onClick={handleReset}
            variant="ghost"
            className="text-slate-300 hover:text-white"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-slate-300 hover:text-white"
            disabled
          >
            <SkipBack className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-slate-300 hover:text-white"
            disabled
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        {/* Master Volume Control */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={onMasterMuteToggle}
              className="text-slate-300 hover:text-white p-1"
            >
              {isMasterMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
            <label className="text-sm text-slate-200 font-medium min-w-fit">
              Master
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={isMasterMuted ? 0 : masterVolume}
              onChange={handleMasterVolumeChange}
              disabled={isMasterMuted}
              className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            />
            <span className="text-xs text-slate-300 min-w-[35px] text-right">
              {isMasterMuted ? '0%' : `${masterVolume}%`}
            </span>
          </div>
        </div>

        {/* Individual Source Controls */}
        <div className="space-y-3">
          {Object.entries(sourceVolumes).map(([source, volume]) => {
            const isMuted = sourceMutes[source as keyof typeof sourceMutes];
            const sourceLabels = {
              bass: '🎸 Bass',
              youtube: '📺 YouTube',
              metronome: '🥁 Metronome',
              drums: '🥁 Drums',
            };

            return (
              <div key={source} className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onSourceMuteToggle(source)}
                  className="text-slate-300 hover:text-white p-1"
                >
                  {isMuted ? (
                    <VolumeX className="w-3 h-3" />
                  ) : (
                    <Volume2 className="w-3 h-3" />
                  )}
                </Button>
                <label className="text-xs text-slate-300 min-w-[70px]">
                  {sourceLabels[source as keyof typeof sourceLabels]}
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={handleSourceVolumeChange(source)}
                  disabled={isMuted}
                  className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
                <span className="text-xs text-slate-400 min-w-[30px] text-right">
                  {isMuted ? '0%' : `${volume}%`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Status Indicator */}
        <div className="mt-4 pt-3 border-t border-slate-700">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  state.isPlaying
                    ? 'bg-green-400 animate-pulse'
                    : 'bg-slate-500'
                }`}
              />
              <span className="text-slate-400">
                {state.isPlaying ? 'Playing' : 'Stopped'}
              </span>
            </div>
            <span className="text-slate-500">Core Playback Engine v2.1</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
