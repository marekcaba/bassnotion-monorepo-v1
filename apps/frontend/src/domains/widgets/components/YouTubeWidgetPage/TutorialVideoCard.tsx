'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { useYouTubeChannelData } from '../../hooks/useYouTubeChannelData';
import type { Tutorial } from '@bassnotion/contracts';

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
    <div className="absolute inset-0 cursor-pointer group" onClick={onPlay}>
      <img
        src={thumbnailUrl}
        alt="Video thumbnail"
        className="w-full h-full object-cover"
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
}: {
  tutorialData?: ExtendedTutorialData;
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

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
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
            className="w-10 h-10 rounded-full object-cover border-2 border-slate-600"
          />
        </a>
      ) : (
        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-sm font-medium">
          {creator.name.charAt(0).toUpperCase()}
        </div>
      )}

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
        <p className="text-slate-400 text-xs">
          {hasSubscriberCount
            ? subscriberCount
            : isLoading
              ? 'Loading...'
              : subscriberCount || 'Subscribe'}
        </p>
      </div>

      <div className="flex-shrink-0">
        {creator.channelUrl ? (
          <Button
            size="sm"
            className="bg-white hover:bg-gray-100 text-black font-medium px-4 py-2 rounded-full transition-colors duration-200"
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
      {/* Card 1: Title + Description + Core Concept */}
      <div className="relative px-6 py-6 space-y-4 bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl">
        {/* Difficulty Tag - Top Right Corner */}
        <div className="absolute top-4 right-4 z-10">
          <span className="bg-orange-500 text-white px-2 py-0.5 rounded-full text-xs font-medium shadow-lg">
            {difficulty}
          </span>
        </div>

        {/* Title Header */}
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
            {title}
          </h1>
        </div>

        {/* Description */}
        <p className="text-slate-400 text-base">{description}</p>

        {/* Core Concept Section */}
        <div className="border-t border-slate-700/50 pt-4">
          <h3 className="text-xl font-semibold text-white mb-3">
            Core Concept
          </h3>
          <p className="text-slate-400 text-base leading-relaxed mb-4">
            {coreConcept.description}
          </p>

          {/* Core Concept Bullet Points */}
          <div className="space-y-2">
            {Array.isArray(coreConcept.points) &&
              coreConcept.points.map((point, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-green-300"
                >
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-sm">{point}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Card 2: Video + Creator Info */}
      <div className="rounded-2xl overflow-hidden">
        {/* Embedded Video (full width) */}
        <div className="aspect-video bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 overflow-hidden relative group shadow-xl">
          {!playing ? (
            <CustomYouTubeThumbnail
              videoUrl={videoUrl}
              onPlay={() => setPlaying(true)}
            />
          ) : (
            <SimpleYouTubePlayer videoUrl={videoUrl} playing={playing} />
          )}
        </div>

        {/* Creator Info / Subscribe (with padding) */}
        <div className="px-6 pt-4 pb-6 bg-slate-800/40 backdrop-blur-xl">
          <CreatorInfo tutorialData={tutorialData} />
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
      {/* Card 1: Title + Description + Core Concept skeleton */}
      <div className="relative px-6 py-6 space-y-4 bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl">
        <div className="absolute top-4 right-4 z-10">
          <div className="skeleton-shimmer w-16 h-5 rounded-full" />
        </div>

        {/* Title skeleton */}
        <div className="skeleton-shimmer h-9 w-3/4 rounded-lg" />

        {/* Description skeleton */}
        <div className="skeleton-shimmer h-5 w-full rounded mb-2" />
        <div className="skeleton-shimmer h-5 w-2/3 rounded" />

        {/* Core concept skeleton */}
        <div className="border-t border-slate-700/50 pt-4">
          <div className="skeleton-shimmer h-6 w-32 rounded mb-3" />
          <div className="skeleton-shimmer h-4 w-full rounded mb-2" />
          <div className="skeleton-shimmer h-4 w-5/6 rounded mb-4" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="skeleton-shimmer w-2 h-2 rounded-full" />
                <div
                  className="skeleton-shimmer h-4 rounded"
                  style={{ width: `${60 + i * 10}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Card 2: Video + Creator Info skeleton */}
      <div className="rounded-2xl overflow-hidden">
        {/* Video skeleton (full width) */}
        <div className="aspect-video skeleton-shimmer" />

        {/* Creator info skeleton (with padding) */}
        <div className="px-6 pt-4 pb-6 bg-slate-800/40 backdrop-blur-xl">
          <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
            <div className="skeleton-shimmer w-10 h-10 rounded-full" />
            <div className="flex-1">
              <div className="skeleton-shimmer h-4 w-32 rounded mb-1" />
              <div className="skeleton-shimmer h-3 w-24 rounded" />
            </div>
            <div className="skeleton-shimmer w-20 h-8 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
