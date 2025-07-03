'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { ArrowLeft } from 'lucide-react';
import type { Tutorial } from '@bassnotion/contracts';

interface MainCardProps {
  tutorialData?: Tutorial;
}

// Custom YouTube Thumbnail Component
interface CustomYouTubeThumbnailProps {
  videoUrl: string;
  onPlay: () => void;
}

// Simple YouTube iframe component
interface SimpleYouTubePlayerProps {
  videoUrl: string;
  playing: boolean;
}

function SimpleYouTubePlayer({ videoUrl, playing }: SimpleYouTubePlayerProps) {
  const getYouTubeVideoId = (url: string): string | null => {
    const regex =
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match?.[1] ?? null;
  };

  const videoId = getYouTubeVideoId(videoUrl);

  if (!videoId || !playing) {
    return null;
  }

  // Simple YouTube iframe embed - ToS compliant
  return (
    <iframe
      src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
      className="w-full h-full"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      frameBorder="0"
      title="YouTube video player"
    />
  );
}

function CustomYouTubeThumbnail({
  videoUrl,
  onPlay,
}: CustomYouTubeThumbnailProps) {
  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string): string | null => {
    const regex =
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match?.[1] ?? null;
  };

  const videoId = getYouTubeVideoId(videoUrl);

  if (!videoId) {
    return (
      <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
        <p className="text-white">Invalid YouTube URL</p>
      </div>
    );
  }

  // YouTube provides multiple thumbnail qualities: maxresdefault, hqdefault, mqdefault, sddefault
  // Try maxresdefault first, but have robust fallbacks
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  return (
    <div className="absolute inset-0 cursor-pointer group" onClick={onPlay}>
      {/* YouTube Thumbnail */}
      <img
        src={thumbnailUrl}
        alt="Video thumbnail"
        className="w-full h-full object-cover"
        onError={(e) => {
          // Fallback to lower quality if maxres fails
          const target = e.target as HTMLImageElement;
          if (target.src.includes('maxresdefault')) {
            target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          } else if (target.src.includes('hqdefault')) {
            // Final fallback to standard default
            target.src = `https://img.youtube.com/vi/${videoId}/sddefault.jpg`;
          }
        }}
      />

      {/* Play Button Overlay with Smooth Transitions */}
      <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-all duration-300 ease-in-out">
        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-2xl group-hover:bg-red-700 group-hover:scale-110 transform transition-all duration-300 ease-out">
          <div className="w-0 h-0 border-l-[16px] border-l-white border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1"></div>
        </div>
      </div>
    </div>
  );
}

export function MainCard({ tutorialData }: MainCardProps) {
  const { navigateWithTransition } = useViewTransitionRouter();
  const [playing, setPlaying] = useState(false);

  // Use tutorialData or fallback to default
  const title = tutorialData?.title || 'Modal Interchange for Bass Players';
  const artist = tutorialData?.artist || 'Rich Brown';
  const difficulty = tutorialData?.difficulty || 'beginner';
  const duration = tutorialData?.duration || '15:30';
  const videoUrl =
    tutorialData?.youtube_url || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  // Creator data from tutorial or fallback
  const defaultCreator = {
    name: 'Rick Astley',
    channelUrl: 'https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw',
    avatarUrl:
      'https://yt3.ggpht.com/ytc/AIdro_kGrq_Vgk8_3AvvjTJPb_Qp2Kk8z4f4z4f4z4f4z4f4z4f4z4f4z4f4z4f4z4f4z4=s176-c-k-c0x00ffffff-no-rj',
  };

  const creator = tutorialData?.creator_name
    ? {
        name: tutorialData.creator_name,
        channelUrl: tutorialData.creator_channel_url || '',
        avatarUrl: tutorialData.creator_avatar_url || '',
      }
    : defaultCreator;

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
          {/* Video Player Container */}
          <div className="relative m-6 mb-4">
            <div className="aspect-video bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-xl overflow-hidden relative group">
              {/* Simple YouTube Player - ToS Compliant */}
              {!playing ? (
                <CustomYouTubeThumbnail
                  videoUrl={videoUrl}
                  onPlay={() => setPlaying(true)}
                />
              ) : (
                <SimpleYouTubePlayer videoUrl={videoUrl} playing={playing} />
              )}
            </div>
          </div>

          {/* Title Section */}
          <div className="px-6 pb-4">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent mb-2">
              {title}
            </h1>
            <p className="text-slate-400 text-lg">
              Learn advanced modal thinking and tension/release techniques
            </p>
            <p className="text-slate-500 mt-1">with {artist}</p>
          </div>

          {/* Video Details */}
          <div className="px-6 pb-4">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <div className="flex items-center gap-4">
                <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-medium">
                  {difficulty}
                </span>
                <span>Duration: {duration}</span>
                <span>{artist} • Bass Tutorial</span>
              </div>
            </div>
          </div>

          {/* Creator Attribution - Inside the card */}
          {creator && creator.name && (
            <div className="px-6 pb-6">
              <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                {creator.avatarUrl ? (
                  <a
                    href={creator.channelUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <img
                      src={creator.avatarUrl}
                      alt={`${creator.name} avatar`}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        // Hide avatar if it fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </a>
                ) : (
                  <a
                    href={creator.channelUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                      {creator.name
                        .split(' ')
                        .map((word) => word[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                  </a>
                )}
                <div className="flex-1">
                  <p className="text-slate-300 text-sm">Created by</p>
                  {creator.channelUrl ? (
                    <a
                      href={creator.channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white font-medium hover:text-blue-300 transition-colors"
                    >
                      {creator.name}
                    </a>
                  ) : (
                    <span className="text-white font-medium">
                      {creator.name}
                    </span>
                  )}
                </div>
                {creator.channelUrl && (
                  <a
                    href={creator.channelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 bg-slate-700/50 rounded"
                  >
                    Follow
                  </a>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
