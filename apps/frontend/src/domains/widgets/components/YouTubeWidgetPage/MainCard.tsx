'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { UsePlaybackIntegrationReturn } from '../../hooks/usePlaybackIntegration';
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, _setCurrentTime] = useState(0);
  const [duration] = useState(180); // 3:00 minutes
  const [playbackSpeed, _setPlaybackSpeed] = useState(1);

  // Use Core Playback Engine state if available
  const isEnginePlay = playbackIntegration?.state.isPlaying || isPlaying;
  const engineCurrentTime =
    playbackIntegration?.state.currentTime || currentTime;

  // Use tutorialData or fallback to default
  const title = tutorialData?.title || 'Never Gonna Give You Up';
  const artist = tutorialData?.artist || 'Rick Astley';
  const difficulty = tutorialData?.difficulty || 'Intermediate';

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = (engineCurrentTime / duration) * 100;

  return (
    <div className="space-y-4">
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
                  onClick={() => {
                    // Sync with Core Playback Engine if available
                    if (playbackIntegration) {
                      if (isEnginePlay) {
                        playbackIntegration.controls.pause();
                      } else {
                        playbackIntegration.controls.play();
                      }
                    } else {
                      setIsPlaying(!isPlaying);
                    }
                  }}
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
                  <div className="w-full bg-white/20 rounded-full h-1.5 mb-2">
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
                    >
                      <RotateCcw className="w-5 h-5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:text-red-400 hover:bg-white/10"
                    >
                      <SkipBack className="w-5 h-5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:text-red-400 hover:bg-white/10"
                    >
                      <SkipForward className="w-5 h-5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:text-red-400 hover:bg-white/10"
                    >
                      <RotateCw className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white/10"
                    >
                      <Volume2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white/10"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white/10"
                    >
                      <Maximize className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Speed Control */}
            <div className="flex items-center justify-center mt-4">
              <div className="bg-slate-800/60 backdrop-blur-sm rounded-full px-4 py-2 border border-slate-600/50">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 text-sm">Speed</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-300 hover:text-white px-2"
                  >
                    -
                  </Button>
                  <div className="bg-slate-700 px-3 py-1 rounded-md min-w-[50px] text-center">
                    <span className="text-white font-medium">
                      {playbackSpeed}x
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-300 hover:text-white px-2"
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Tutorial Info Section */}
          <div className="p-6 pt-0">
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">
                  Tutorial Summary
                </h3>
                <div className="bg-orange-500/20 text-orange-300 px-3 py-1 rounded-full text-sm font-medium">
                  {difficulty}
                </div>
              </div>
              <p className="text-slate-300 leading-relaxed">
                This is a modal thinking + tension/release lesson by Rich Brown,
                taught inside a Scott's Bass Lessons course. It's aimed at
                intermediate to advanced players who already understand 2-5-1
                progressions and modes — but offers a unique concept: playing
                multiple modes over the same tonic to creatively navigate
                tension over a II-V-I.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
