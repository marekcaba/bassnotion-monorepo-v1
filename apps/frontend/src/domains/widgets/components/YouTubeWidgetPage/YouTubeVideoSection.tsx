'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { ArrowLeft } from 'lucide-react';
import type { Tutorial } from '@bassnotion/contracts';
import { CreatorInfoSection } from './CreatorInfoSection';

interface YouTubeVideoSectionProps {
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
    if (!url) return null;

    // If it's already just an ID (11 characters, alphanumeric with - and _)
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return url;
    }

    // Otherwise try to extract from URL
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
  // Extract YouTube video ID from URL or use as-is if it's already an ID
  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;

    // If it's already just an ID (11 characters, alphanumeric with - and _)
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return url;
    }

    // Otherwise try to extract from URL
    const regex =
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match?.[1] ?? null;
  };

  const videoId = getYouTubeVideoId(videoUrl);

  if (!videoId) {
    console.warn('Invalid YouTube URL or ID:', videoUrl);
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

export function YouTubeVideoSection({
  tutorialData,
}: YouTubeVideoSectionProps) {
  const { navigateWithTransition } = useViewTransitionRouter();
  const [playing, setPlaying] = useState(false);

  // Build video URL from youtube_id if youtube_url is not provided
  let videoUrl = tutorialData?.youtube_url;

  // If no youtube_url but we have youtube_id, construct the URL
  if (!videoUrl && tutorialData?.youtube_id) {
    videoUrl = `https://www.youtube.com/watch?v=${tutorialData.youtube_id}`;
  }

  // Fallback to default if neither is available
  if (!videoUrl) {
    videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  }

  // Reset playing state when video URL changes
  React.useEffect(() => {
    setPlaying(false);
  }, [videoUrl]);

  return (
    <div className="space-y-4">
      {/* YouTube Video Player - Standalone */}
      <div className="relative">
        <div className="aspect-video bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-xl overflow-hidden relative group shadow-2xl">
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

      {/* Creator Info Section - 80% width under video */}
      <CreatorInfoSection tutorialData={tutorialData} />
    </div>
  );
}
