'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { UsePlaybackIntegrationReturn } from '../../hooks/usePlaybackIntegration';
import { SyncedWidget } from '../base/SyncedWidget.js';
import type { SyncedWidgetRenderProps } from '../base/SyncedWidget.js';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Volume2,
  Settings,
  Maximize,
  ArrowLeft,
} from 'lucide-react';

interface TutorialData {
  id: string;
  title: string;
  artist: string;
  difficulty: string;
  duration: string;
  videoUrl: string;
  concepts: string[];
}

interface MainCardProps {
  tutorialData?: TutorialData;
  /** Optional playback integration for sync with Core Playback Engine */
  playbackIntegration?: UsePlaybackIntegrationReturn;
}

export function MainCard({ tutorialData, playbackIntegration }: MainCardProps) {
  const { navigateWithTransition } = useViewTransitionRouter();
  const [currentTime, _setCurrentTime] = useState(0);
  const [duration] = useState(180); // 3:00 minutes
  const [playbackSpeed, _setPlaybackSpeed] = useState(1);

  // Use tutorialData or fallback to default
  const title = tutorialData?.title || 'Never Gonna Give You Up';
  const artist = tutorialData?.artist || 'Rick Astley';
  const difficulty = tutorialData?.difficulty || 'Intermediate';

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SyncedWidget
      widgetId="main-youtube-player"
      widgetName="YouTube Player"
      syncOptions={{
        subscribeTo: [
          'PLAYBACK_STATE',
          'TIMELINE_UPDATE',
          'TEMPO_CHANGE',
          'VOLUME_CHANGE',
        ],
        debugMode: process.env.NODE_ENV === 'development',
      }}
    >
      {(syncProps: SyncedWidgetRenderProps) => {
        // Use synchronized state with fallbacks
        const isEnginePlay = syncProps.isPlaying;
        const engineCurrentTime = syncProps.currentTime || currentTime;
        const progressPercentage = (engineCurrentTime / duration) * 100;

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
                currentTime: engineCurrentTime,
                source: 'youtube-player',
              },
              'high',
            );
          }
        };

        const handleTimelineSeek = (newTime: number) => {
          // Emit timeline update to sync all widgets
          syncProps.sync.actions.emitEvent(
            'TIMELINE_UPDATE',
            {
              currentTime: newTime,
              source: 'youtube-player',
            },
            'high',
          );
        };

        return (
          <div className="space-y-4">
            {/* Sync Status Indicator for Development */}
            {process.env.NODE_ENV === 'development' &&
              !syncProps.isConnected && (
                <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-2 text-yellow-200 text-sm">
                  ⚠️ Widget sync disconnected
                </div>
              )}

            {/* Back to Library Button */}
            <div className="flex items-center gap-3 text-slate-300">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateWithTransition('/library')}
                className="text-white/70 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Library
              </Button>
            </div>

            {/* Main Video Card */}
            <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl overflow-hidden">
              <CardContent className="p-0">
                {/* Title Section */}
                <div className="p-6 pb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-xl font-bold text-white">
                      📺 YouTube Player
                    </h2>
                    {/* Sync status indicator */}
                    <div
                      className={`w-2 h-2 rounded-full ${syncProps.isConnected ? 'bg-green-400' : 'bg-red-400'}`}
                      title={syncProps.isConnected ? 'Synced' : 'Sync error'}
                    />
                  </div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent mb-2">
                    Modal Interchange for Bass Players
                  </h1>
                  <p className="text-slate-400 text-lg">
                    Learn advanced modal thinking and tension/release techniques
                  </p>
                  <p className="text-slate-500 mt-1">with Rich Brown</p>
                </div>

                {/* Video Player Container */}
                <div className="relative mx-6 mb-6">
                  <div className="aspect-video bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-xl overflow-hidden relative group">
                    {/* Video Thumbnail/Placeholder */}
                    <div className="absolute inset-0 bg-gradient-to-br from-red-600/80 to-orange-600/80 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl font-bold text-white mb-2">
                          {artist.split(' ')[0]?.toUpperCase()}
                        </div>
                        <div className="text-6xl font-bold text-white mb-2">
                          {artist.split(' ')[1]?.toUpperCase() || ''}
                        </div>
                        <div className="text-xl text-white/80 mb-4">
                          {title.split(' ').slice(0, 2).join(' ').toUpperCase()}
                        </div>
                        <div className="text-xl text-white/80">
                          {title.split(' ').slice(2).join(' ').toUpperCase()}
                        </div>
                        <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded-full text-sm font-medium">
                          4K
                        </div>
                      </div>
                    </div>

                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button
                        size="lg"
                        className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 shadow-2xl transition-all duration-300 hover:scale-110"
                        onClick={handlePlayToggle}
                      >
                        {isEnginePlay ? (
                          <Pause className="w-8 h-8 text-white" />
                        ) : (
                          <Play className="w-8 h-8 text-white ml-1" />
                        )}
                      </Button>
                    </div>

                    {/* Video Controls Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6">
                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div
                          className="w-full bg-white/20 rounded-full h-1.5 mb-2 cursor-pointer"
                          onClick={(e) => {
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const percentage = x / rect.width;
                            const newTime = percentage * duration;
                            handleTimelineSeek(newTime);
                          }}
                        >
                          <div
                            className="bg-red-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-white text-sm">
                          <span>{formatTime(engineCurrentTime)}</span>
                          <span>{formatTime(duration)}</span>
                        </div>
                      </div>

                      {/* Control Buttons */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-white hover:text-red-400 hover:bg-white/10"
                            onClick={() =>
                              handleTimelineSeek(
                                Math.max(0, engineCurrentTime - 10),
                              )
                            }
                          >
                            <RotateCcw className="w-5 h-5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-white hover:text-red-400 hover:bg-white/10"
                            onClick={() =>
                              handleTimelineSeek(
                                Math.max(0, engineCurrentTime - 5),
                              )
                            }
                          >
                            <SkipBack className="w-5 h-5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-white hover:text-red-400 hover:bg-white/10"
                            onClick={() =>
                              handleTimelineSeek(
                                Math.min(duration, engineCurrentTime + 5),
                              )
                            }
                          >
                            <SkipForward className="w-5 h-5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-white hover:text-red-400 hover:bg-white/10"
                            onClick={() =>
                              handleTimelineSeek(
                                Math.min(duration, engineCurrentTime + 10),
                              )
                            }
                          >
                            <RotateCw className="w-5 h-5" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-white hover:bg-white/10"
                            onClick={() => {
                              // Emit volume change event
                              syncProps.sync.actions.emitEvent(
                                'VOLUME_CHANGE',
                                {
                                  masterVolume:
                                    syncProps.masterVolume > 0 ? 0 : 0.8,
                                  source: 'youtube-player',
                                },
                              );
                            }}
                          >
                            <Volume2 className="w-5 h-5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-white hover:bg-white/10"
                          >
                            <Settings className="w-5 h-5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-white hover:bg-white/10"
                          >
                            <Maximize className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Video Details */}
                <div className="px-6 pb-6">
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <div className="flex items-center gap-4">
                      <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-medium">
                        {difficulty}
                      </span>
                      <span>Tempo: {syncProps.tempo} BPM</span>
                      <span>3:00</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">Speed: {playbackSpeed}x</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }}
    </SyncedWidget>
  );
}
