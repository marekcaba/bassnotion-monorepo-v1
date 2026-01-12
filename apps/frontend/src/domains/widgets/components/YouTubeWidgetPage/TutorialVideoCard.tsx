'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { useYouTubeChannelData } from '../../hooks/useYouTubeChannelData';
import type { Tutorial } from '@bassnotion/contracts';

// Gradient settings type for the creator overlay
interface GradientSettings {
  fromOpacity: number;
  viaOpacity: number;
  viaPosition: number;
  paddingTop: number;
  paddingBottom: number;
}

// Extended tutorial data that may include additional fields from the API
interface ExtendedTutorialData extends Tutorial {
  level?: string;
  coreConcept?: {
    description?: string;
    bulletPoints?: string[];
    points?: string[];
  };
  core_concept_description?: string;
  core_concept_points?: string[];
}

interface TutorialVideoCardProps {
  tutorialData?: ExtendedTutorialData;
}

// Simple YouTube iframe component
function SimpleYouTubePlayer({
  videoUrl,
  playing,
}: {
  videoUrl: string;
  playing: boolean;
}) {
  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return url;
    }
    const regex =
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match?.[1] ?? null;
  };

  const videoId = getYouTubeVideoId(videoUrl);

  if (!videoId || !playing) {
    return null;
  }

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

// Custom YouTube Thumbnail Component
function CustomYouTubeThumbnail({
  videoUrl,
  onPlay,
}: {
  videoUrl: string;
  onPlay: () => void;
}) {
  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return url;
    }
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

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  return (
    <div className="absolute inset-0 cursor-pointer group rounded-2xl overflow-hidden" onClick={onPlay}>
      <img
        src={thumbnailUrl}
        alt="Video thumbnail"
        className="w-full h-full object-cover rounded-2xl"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          if (target.src.includes('maxresdefault')) {
            target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          } else if (target.src.includes('hqdefault')) {
            target.src = `https://img.youtube.com/vi/${videoId}/sddefault.jpg`;
          }
        }}
      />
      <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-all duration-300 ease-in-out">
        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-2xl group-hover:bg-red-700 group-hover:scale-110 transform transition-all duration-300 ease-out">
          <div className="w-0 h-0 border-l-[16px] border-l-white border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1"></div>
        </div>
      </div>
    </div>
  );
}

// Inline Creator Info Section
function CreatorInfo({
  tutorialData,
  isOverlay = false,
}: {
  tutorialData?: ExtendedTutorialData;
  isOverlay?: boolean;
}) {
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
      creator.name
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

  // Overlay style: transparent background, white text
  // Non-overlay style: dark background, standard styling
  const containerClass = isOverlay
    ? 'flex items-center gap-3'
    : 'flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg';

  const avatarBorderClass = isOverlay
    ? 'border-2 border-white/40'
    : 'border-2 border-slate-600';

  const avatarFallbackClass = isOverlay
    ? 'bg-white/20 text-white'
    : 'bg-slate-700 text-slate-400';

  const subscriberTextClass = isOverlay
    ? 'text-white/70 text-xs'
    : 'text-slate-400 text-xs';

  return (
    <div className={containerClass}>
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
            className={`w-10 h-10 rounded-full object-cover ${avatarBorderClass}`}
          />
        </a>
      ) : (
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${avatarFallbackClass}`}>
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
        <p className={subscriberTextClass}>
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
            className={isOverlay
              ? 'bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-1.5 rounded-full transition-colors duration-200 text-sm shadow-lg'
              : 'bg-white hover:bg-gray-100 text-black font-medium px-4 py-2 rounded-full transition-colors duration-200'
            }
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

export function TutorialVideoCard({ tutorialData }: TutorialVideoCardProps) {
  const [playing, setPlaying] = useState(false);

  // Fixed gradient settings (no longer debug-adjustable)
  const gradientSettings: GradientSettings = {
    fromOpacity: 81,
    viaOpacity: 0,
    viaPosition: 100,
    paddingTop: 32,
    paddingBottom: 7,
  };

  // Tutorial data with fallbacks
  const title = tutorialData?.title || 'Come Together';
  const description =
    tutorialData?.description ||
    'Learn advanced modal thinking and tension/release techniques';
  const difficulty =
    tutorialData?.difficulty || tutorialData?.level || 'advanced';

  // Core concept data
  const defaultCoreConcept = {
    description:
      'Use different modes starting from the same root note (D) over a 2-5-1 progression to create intentional tension and release without shifting the root.',
    points: [
      'Modal interchange over static root notes',
      'Advanced tension and release techniques',
      'II-V-I progression variations',
    ],
  };

  const coreConcept = {
    description:
      tutorialData?.coreConcept?.description ||
      tutorialData?.core_concept_description ||
      defaultCoreConcept.description,
    points:
      tutorialData?.coreConcept?.bulletPoints ||
      tutorialData?.coreConcept?.points ||
      tutorialData?.core_concept_points ||
      defaultCoreConcept.points,
  };

  // Video URL logic
  let videoUrl = tutorialData?.youtube_url;
  if (!videoUrl && tutorialData?.youtube_id) {
    videoUrl = `https://www.youtube.com/watch?v=${tutorialData.youtube_id}`;
  }
  if (!videoUrl) {
    videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  }

  // Reset playing state when video URL changes
  React.useEffect(() => {
    setPlaying(false);
  }, [videoUrl]);

  return (
    <div className="space-y-4">
      {/* Hero Card: Video with Creator Overlay + Title/Description/Core Concept */}
      <div className="relative bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
        {/* Video Section with Creator Overlay */}
        <div className="relative">
          {/* Embedded Video */}
          <div className="aspect-video bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 overflow-hidden relative group rounded-2xl">
            {!playing ? (
              <CustomYouTubeThumbnail
                videoUrl={videoUrl}
                onPlay={() => setPlaying(true)}
              />
            ) : (
              <SimpleYouTubePlayer videoUrl={videoUrl} playing={playing} />
            )}
          </div>

          {/* Creator Info Overlay - Bottom of video with gradient */}
          {/* pointer-events-none allows clicks to pass through to thumbnail, pointer-events-auto on CreatorInfo keeps buttons clickable */}
          {/* Fades out when video is playing to not obstruct YouTube controls */}
          <div
            className={`absolute bottom-0 left-0 right-0 pointer-events-none transition-opacity duration-500 ease-out rounded-b-2xl ${
              playing ? 'opacity-0' : 'opacity-100'
            }`}
            style={{
              background: `linear-gradient(to top, rgba(0,0,0,${gradientSettings.fromOpacity / 100}), rgba(0,0,0,${gradientSettings.viaOpacity / 100}) ${gradientSettings.viaPosition}%, transparent)`,
              padding: `${gradientSettings.paddingTop * 4}px 16px ${gradientSettings.paddingBottom * 4}px 16px`,
            }}
          >
            <div className={`pointer-events-auto ${playing ? 'pointer-events-none' : ''}`}>
              <CreatorInfo tutorialData={tutorialData} isOverlay />
            </div>
          </div>

        </div>

        {/* Content Section: Title + Description + Core Concept */}
        <div className="px-6 py-5 space-y-4">
          {/* Title Header */}
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
            {title}
          </h1>

          {/* Description */}
          <p className="text-slate-400 text-sm">{description}</p>

          {/* Core Concept Section */}
          <div className="border-t border-slate-700/50 pt-4">
            <h3 className="text-lg font-semibold text-white mb-2">
              Core Concept
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-3">
              {coreConcept.description}
            </p>

            {/* Core Concept Bullet Points */}
            <div className="space-y-1.5">
              {Array.isArray(coreConcept.points) &&
                coreConcept.points.map((point, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 text-green-300"
                  >
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0"></div>
                    <span className="text-xs">{point}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton loading state for TutorialVideoCard
 */
export function TutorialVideoCardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Hero Card skeleton */}
      <div className="relative bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
        {/* Video section with creator overlay skeleton */}
        <div className="relative">
          {/* Video skeleton */}
          <div className="aspect-video skeleton-shimmer" />

          {/* Creator overlay skeleton */}
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0) 100%)',
              padding: '48px 16px 16px 16px',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="skeleton-shimmer w-10 h-10 rounded-full" />
              <div className="flex-1">
                <div className="skeleton-shimmer h-4 w-28 rounded mb-1" />
                <div className="skeleton-shimmer h-3 w-20 rounded" />
              </div>
              <div className="skeleton-shimmer w-20 h-8 rounded-full" />
            </div>
          </div>

          {/* Difficulty tag skeleton */}
          <div className="absolute top-3 right-3 z-10">
            <div className="skeleton-shimmer w-16 h-6 rounded-full" />
          </div>
        </div>

        {/* Content section skeleton */}
        <div className="px-6 py-5 space-y-4">
          {/* Title skeleton */}
          <div className="skeleton-shimmer h-7 w-3/4 rounded-lg" />

          {/* Description skeleton */}
          <div className="skeleton-shimmer h-4 w-full rounded" />

          {/* Core concept skeleton */}
          <div className="border-t border-slate-700/50 pt-4">
            <div className="skeleton-shimmer h-5 w-28 rounded mb-2" />
            <div className="skeleton-shimmer h-4 w-full rounded mb-1" />
            <div className="skeleton-shimmer h-4 w-5/6 rounded mb-3" />
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="skeleton-shimmer w-1.5 h-1.5 rounded-full" />
                  <div
                    className="skeleton-shimmer h-3 rounded"
                    style={{ width: `${50 + i * 10}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
