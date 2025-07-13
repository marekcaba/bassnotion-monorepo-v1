'use client';

import React, { useEffect, useState } from 'react';
import { UsePlaybackIntegrationReturn } from '../../../hooks/usePlaybackIntegration';
import { SyncedWidget } from '../../base';
import type { SyncedWidgetRenderProps } from '../../base';
import { VolumeKnob } from './VolumeKnob';

interface MetronomeWidgetProps {
  bpm: number;
  isPlaying: boolean;
  isVisible: boolean;
  onTogglePlay: () => void;
  onBpmChange: (bpm: number) => void;
  onToggleVisibility: () => void;

  /** Optional playback integration for sync with Core Playback Engine */
  playbackIntegration?: UsePlaybackIntegrationReturn;
}

interface MetronomeDot {
  id: number;
  isActive: boolean;
  isCurrent: boolean;
}

const initialDots: MetronomeDot[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  isActive: i < 4, // First 4 dots are active for compact view
  isCurrent: i === 0, // First dot is current
}));

export function MetronomeWidget({
  bpm,
  isPlaying,
  isVisible,
  onTogglePlay,
  onBpmChange,
  onToggleVisibility,
  playbackIntegration,
}: MetronomeWidgetProps) {
  if (!isVisible) return null;

  return (
    <SyncedWidget
      widgetId="metronome-widget"
      widgetName="Metronome"
      syncOptions={{
        subscribeTo: ['PLAYBACK_STATE', 'TEMPO_CHANGE'],
        debugMode: false,
      }}
    >
      {(syncProps: SyncedWidgetRenderProps) => {
        const [metronomeDots, setMetronomeDots] = useState(initialDots);
        const [volume, setVolume] = useState(80);
        const [isMuted, setIsMuted] = useState(false);
        const [isExpanded, setIsExpanded] = useState(false);
        const [beats, setBeats] = useState(4);
        const [noteValue, setNoteValue] = useState(4);
        const [mutedBeats, setMutedBeats] = useState<Set<number>>(new Set());
        const [polyrhythmEnabled, setPolyrhythmEnabled] = useState(false);
        const [polyrhythmRatio, setPolyrhythmRatio] = useState({
          main: 4,
          poly: 3,
        });

        // Use synchronized state with fallbacks
        const currentTempo =
          syncProps.tempo || playbackIntegration?.state.tempo || bpm;
        const isEnginePlay =
          syncProps.isPlaying ||
          playbackIntegration?.state.isPlaying ||
          isPlaying;

        // Debug log (disabled to reduce console noise)
        // console.log('🎵 MetronomeWidget: Sync state updated:', {
        //   syncTempo,
        //   currentTempo,
        //   propBpm,
        //   playbackTempo: syncProps.sync.tempo,
        //   isConnected: syncProps.sync.isConnected,
        //   source: 'useEffect',
        // });

        // Calculate interval based on BPM
        const beatInterval = 60000 / currentTempo; // milliseconds per beat

        // Update dots array when beats change
        useEffect(() => {
          setMetronomeDots(
            Array.from({ length: beats }, (_, i) => ({
              id: i + 1,
              isActive: true,
              isCurrent: i === 0,
            })),
          );
        }, [beats]);

        // Simulate metronome animation
        useEffect(() => {
          if (!isEnginePlay) return;

          const interval = setInterval(() => {
            setMetronomeDots((prev) => {
              const currentIndex = prev.findIndex((dot) => dot.isCurrent);
              const nextIndex = (currentIndex + 1) % beats;

              return prev.map((dot, index) => ({
                ...dot,
                isCurrent: index === nextIndex,
              }));
            });
          }, beatInterval);

          return () => clearInterval(interval);
        }, [isEnginePlay, beatInterval, beats]);

        const handleBpmChange = (
          event: React.ChangeEvent<HTMLInputElement>,
        ) => {
          const newBpm = parseInt(event.target.value, 10);
          if (newBpm >= 60 && newBpm <= 200) {
            onBpmChange(newBpm);

            // Emit tempo change event to sync with other widgets
            syncProps.sync.actions.emitEvent(
              'TEMPO_CHANGE',
              {
                tempo: newBpm,
                source: 'metronome-widget',
              },
              'high',
            );

            // Sync with Core Playback Engine if available
            if (playbackIntegration) {
              playbackIntegration.controls.setTempo(newBpm);
            }
          }
        };

        const handlePlayToggle = () => {
          if (playbackIntegration) {
            // Use Core Playback Engine controls
            if (isEnginePlay) {
              playbackIntegration.controls.pause();
            } else {
              playbackIntegration.controls.play();
            }
          } else {
            // Emit sync event to coordinate with other widgets
            syncProps.sync.actions.emitEvent(
              'PLAYBACK_STATE',
              {
                isPlaying: !isEnginePlay,
                source: 'metronome-widget',
              },
              'high',
            );
            onTogglePlay();
          }
        };

        return (
          <div
            className={`relative bg-slate-800 rounded-2xl px-4 py-1 h-24 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 select-none ${
              volume === 0 || isMuted
                ? 'bg-slate-850 grayscale brightness-100'
                : ''
            }`}
          >
            <div className="flex items-center justify-between h-full">
              {/* Volume Knob */}
              <div className="flex justify-center items-center w-20 h-16">
                <VolumeKnob
                  value={volume}
                  onChange={(val) => {
                    console.log('Metronome volume:', val);
                    setVolume(val);
                    if (val > 0) {
                      setIsMuted(false);
                    }
                  }}
                  color="bg-emerald-400"
                  size={45}
                  isMuted={isMuted}
                  onMuteToggle={() => {
                    setIsMuted(!isMuted);
                  }}
                />
              </div>

              {/* Title/Subtitle OR Settings Panel */}
              <div className="flex-1">
                <div className="flex items-center justify-between px-4 py-2">
                  {!isExpanded ? (
                    <>
                      {/* Title and Subtitle */}
                      <div className="flex-1">
                        <h3
                          className={`font-semibold text-sm transition-all duration-300 ${
                            volume === 0 ? 'text-slate-600' : 'text-white'
                          }`}
                        >
                          Metronome
                        </h3>
                        <p
                          className={`text-xs transition-all duration-300 ${
                            volume === 0 ? 'text-slate-600' : 'text-slate-400'
                          }`}
                        >
                          {currentTempo} BPM
                        </p>
                      </div>

                      {/* Clickable Indicator */}
                      <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                          volume === 0 ? 'opacity-50' : ''
                        }`}
                      >
                        {/* Compact metronome dots - reflects settings */}
                        <div
                          className={`grid gap-1 ${beats <= 4 ? `grid-cols-${beats}` : 'grid-cols-4'}`}
                        >
                          {Array.from({ length: beats }, (_, i) => (
                            <div
                              key={i}
                              className={`
                                  w-2 h-2 rounded-full transition-all duration-200
                                  ${
                                    mutedBeats.has(i)
                                      ? 'bg-slate-600'
                                      : metronomeDots[i]?.isCurrent &&
                                          isEnginePlay
                                        ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50'
                                        : 'bg-emerald-500'
                                  }
                                `}
                            />
                          ))}
                        </div>
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Settings content in horizontal layout with 3 components */}
                      <div className="flex items-center justify-between flex-1">
                        {/* 1. Time Signature Control */}
                        <div className="flex items-center gap-1">
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => setBeats(Math.min(8, beats + 1))}
                              className="w-4 h-4 rounded bg-slate-800 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] transition-all duration-200 text-emerald-400 text-xs flex items-center justify-center"
                            >
                              +
                            </button>
                            <button
                              onClick={() => setBeats(Math.max(1, beats - 1))}
                              className="w-4 h-4 rounded bg-slate-800 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] transition-all duration-200 text-emerald-400 text-xs flex items-center justify-center"
                            >
                              -
                            </button>
                          </div>
                          <div className="flex items-center">
                            <span className="text-base font-mono text-emerald-400 w-4 text-center">
                              {beats}
                            </span>
                            <span className="text-base text-emerald-400/50 mx-0.5">
                              /
                            </span>
                            <span className="text-base font-mono text-emerald-400 w-5 text-center">
                              {noteValue}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() =>
                                setNoteValue(
                                  noteValue === 16
                                    ? 4
                                    : noteValue === 8
                                      ? 16
                                      : 8,
                                )
                              }
                              className="w-4 h-4 rounded bg-slate-800 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] transition-all duration-200 text-emerald-400 text-xs flex items-center justify-center"
                            >
                              +
                            </button>
                            <button
                              onClick={() =>
                                setNoteValue(
                                  noteValue === 4
                                    ? 16
                                    : noteValue === 8
                                      ? 4
                                      : 8,
                                )
                              }
                              className="w-4 h-4 rounded bg-slate-800 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] transition-all duration-200 text-emerald-400 text-xs flex items-center justify-center"
                            >
                              -
                            </button>
                          </div>
                        </div>

                        {/* 2. Interactive Beat Dots - Fixed width container */}
                        <div className="flex items-center justify-center flex-1 px-3">
                          <div className="grid grid-cols-4 gap-2">
                            {Array.from({ length: beats }, (_, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  const newMuted = new Set(mutedBeats);
                                  if (newMuted.has(i)) {
                                    newMuted.delete(i);
                                  } else {
                                    newMuted.add(i);
                                  }
                                  setMutedBeats(newMuted);
                                }}
                                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                                  mutedBeats.has(i)
                                    ? 'bg-slate-700 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)]'
                                    : metronomeDots[i]?.isCurrent &&
                                        isEnginePlay
                                      ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50'
                                      : 'bg-emerald-600 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)]'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        {/* 3. Polyrhythm Circle */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setPolyrhythmEnabled(!polyrhythmEnabled)
                            }
                            className={`w-12 h-12 rounded-full relative transition-all duration-200 ${
                              polyrhythmEnabled
                                ? 'bg-slate-900 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)]'
                                : 'bg-slate-800 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)]'
                            }`}
                          >
                            {/* Outer circle dots */}
                            {Array.from(
                              { length: polyrhythmRatio.main },
                              (_, i) => {
                                const angle =
                                  (i / polyrhythmRatio.main) * 360 - 90;
                                const x =
                                  18 * Math.cos((angle * Math.PI) / 180) + 24;
                                const y =
                                  18 * Math.sin((angle * Math.PI) / 180) + 24;
                                return (
                                  <div
                                    key={`outer-${i}`}
                                    className={`absolute w-2 h-2 rounded-full transition-all duration-200 ${
                                      polyrhythmEnabled
                                        ? 'bg-emerald-400'
                                        : 'bg-slate-600'
                                    }`}
                                    style={{ left: x - 4, top: y - 4 }}
                                  />
                                );
                              },
                            )}
                            {/* Inner circle dots */}
                            {polyrhythmEnabled &&
                              Array.from(
                                { length: polyrhythmRatio.poly },
                                (_, i) => {
                                  const angle =
                                    (i / polyrhythmRatio.poly) * 360 - 90;
                                  const x =
                                    10 * Math.cos((angle * Math.PI) / 180) + 24;
                                  const y =
                                    10 * Math.sin((angle * Math.PI) / 180) + 24;
                                  return (
                                    <div
                                      key={`inner-${i}`}
                                      className="absolute w-1.5 h-1.5 rounded-full bg-purple-400"
                                      style={{ left: x - 3, top: y - 3 }}
                                    />
                                  );
                                },
                              )}
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-mono text-emerald-400">
                              {polyrhythmRatio.main}:{polyrhythmRatio.poly}
                            </span>
                          </button>

                          {polyrhythmEnabled && (
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() =>
                                  setPolyrhythmRatio((prev) => ({
                                    ...prev,
                                    poly: Math.min(8, prev.poly + 1),
                                  }))
                                }
                                className="w-4 h-4 rounded bg-slate-800 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] transition-all duration-200 text-purple-400 text-xs flex items-center justify-center"
                              >
                                +
                              </button>
                              <button
                                onClick={() =>
                                  setPolyrhythmRatio((prev) => ({
                                    ...prev,
                                    poly: Math.max(2, prev.poly - 1),
                                  }))
                                }
                                className="w-4 h-4 rounded bg-slate-800 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] transition-all duration-200 text-purple-400 text-xs flex items-center justify-center"
                              >
                                -
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => setIsExpanded(false)}
                        className="w-5 h-5 rounded-md bg-slate-800 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] transition-all duration-200 text-slate-400 text-xs flex items-center justify-center self-start mt-1 ml-4"
                        title="Close settings"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }}
    </SyncedWidget>
  );
}
