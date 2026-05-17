'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import type { Tutorial } from '@bassnotion/contracts';
import { useYouTubeChannelData } from '../../hooks/useYouTubeChannelData';

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

// Inline Creator Info for overlay
function CreatorInfoOverlay({ tutorialData }: { tutorialData?: Tutorial }) {
  const defaultCreator = {
    name: 'Rick Astley',
    channelUrl: 'https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw',
    avatarUrl: '',
  };

  const creator = tutorialData?.creator_name
    ? {
        name: tutorialData.creator_name,
        channelUrl: tutorialData.creator_channel_url || '',
        avatarUrl: tutorialData.creator_avatar_url || '',
      }
    : defaultCreator;

  const hasSubscriberCount =
    tutorialData?.creator_subscriber_count &&
    tutorialData.creator_subscriber_count > 0;

  const { subscriberCount: apiSubscriberCount, isLoading } =
    useYouTubeChannelData(
      hasSubscriberCount ? undefined : creator.channelUrl,
      creator.name,
    );

  const formatSubscriberCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M subscribers`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K subscribers`;
    }
    return `${count} subscribers`;
  };

  const subscriberCount = hasSubscriberCount
    ? formatSubscriberCount(tutorialData.creator_subscriber_count!)
    : apiSubscriberCount;

  if (!creator || !creator.name) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      {/* Avatar */}
      {creator.avatarUrl ? (
        <a
          href={creator.channelUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0"
        >
          <img
            src={creator.avatarUrl}
            alt={`${creator.name} avatar`}
            className="w-10 h-10 rounded-full object-cover border-2 border-white/40"
          />
        </a>
      ) : (
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium bg-white/20 text-white">
          {creator.name.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Creator Name & Subscriber Count */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {creator.channelUrl ? (
            <a
              href={creator.channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-blue-300 text-sm font-medium transition-colors duration-200 truncate"
            >
              {creator.name}
            </a>
          ) : (
            <p className="text-white text-sm font-medium truncate">
              {creator.name}
            </p>
          )}
        </div>
        <p className="text-white/70 text-xs">
          {hasSubscriberCount
            ? subscriberCount
            : isLoading
              ? 'Loading...'
              : subscriberCount || 'Subscribe'}
        </p>
      </div>

      {/* Subscribe Button */}
      <div className="flex-shrink-0">
        {creator.channelUrl ? (
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-1.5 rounded-full transition-colors duration-200 text-sm shadow-lg"
            onClick={() =>
              window.open(creator.channelUrl, '_blank', 'noopener,noreferrer')
            }
          >
            Subscribe
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-gray-500 hover:bg-gray-600 text-white font-medium px-4 py-2 rounded-full"
            disabled
          >
            Subscribe
          </Button>
        )}
      </div>
    </div>
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
    <div className="relative rounded-xl overflow-hidden shadow-2xl">
      {/* YouTube Video Player with Creator Overlay */}
      <div className="aspect-video bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 relative group">
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

      {/* Creator Info Overlay - Bottom of video */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4 pt-12">
        <CreatorInfoOverlay tutorialData={tutorialData} />
      </div>
    </div>
  );
}
