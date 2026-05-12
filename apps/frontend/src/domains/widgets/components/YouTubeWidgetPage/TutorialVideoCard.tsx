'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Lock, CheckCircle, Play, Pause, Sparkles } from 'lucide-react';
import { useYouTubeChannelData } from '../../hooks/useYouTubeChannelData';
import { useRewardPreview } from '../../hooks/useRewardPreview';
import { safeString, getExerciseId } from './utils';
import { LOCKED_DIFFICULTIES, REQUIRED_COMPLETIONS } from './constants';
import type { Tutorial } from '@bassnotion/contracts';
import type { PracticeCompletions } from '@/domains/widgets/hooks/usePracticeCompletions';

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
  exercises?: any[];
  practiceCompletions?: PracticeCompletions;
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
// Shows play button only if there's a YouTube video to play
function CustomYouTubeThumbnail({
  videoUrl,
  customThumbnailUrl,
  onPlay,
  hasYouTubeVideo,
}: {
  videoUrl: string;
  customThumbnailUrl?: string;
  onPlay: () => void;
  hasYouTubeVideo: boolean;
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

  // If no custom thumbnail and no YouTube video, show placeholder
  if (!customThumbnailUrl && !videoId) {
    return (
      <div className="absolute inset-0 bg-slate-800 flex items-center justify-center rounded-2xl">
        <p className="text-white/60">No thumbnail available</p>
      </div>
    );
  }

  // Prefer custom thumbnail URL over YouTube auto-generated thumbnail
  const youtubeThumbnailUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : '';
  const thumbnailUrl = customThumbnailUrl || youtubeThumbnailUrl;

  // If custom thumbnail but no YouTube video - show static image (no play button)
  if (customThumbnailUrl && !hasYouTubeVideo) {
    return (
      <div className="absolute inset-0 rounded-2xl overflow-hidden">
        <img
          src={thumbnailUrl}
          alt="Tutorial thumbnail"
          className="w-full h-full object-cover rounded-2xl"
        />
      </div>
    );
  }

  // Has YouTube video - show thumbnail with play button
  return (
    <div className="absolute inset-0 cursor-pointer group rounded-2xl overflow-hidden" onClick={onPlay}>
      <img
        src={thumbnailUrl}
        alt="Video thumbnail"
        className="w-full h-full object-cover rounded-2xl"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          // Only fallback to YouTube thumbnails if not using custom thumbnail
          if (!customThumbnailUrl && videoId) {
            if (target.src.includes('maxresdefault')) {
              target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            } else if (target.src.includes('hqdefault')) {
              target.src = `https://img.youtube.com/vi/${videoId}/sddefault.jpg`;
            }
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

export function TutorialVideoCard({
  tutorialData,
  exercises = [],
  practiceCompletions = {},
}: TutorialVideoCardProps) {
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

  // Derive progress data from exercises and practiceCompletions
  const progressData = useMemo(() => {
    const filtered = exercises.filter((ex) => ex?.id && ex?.title);
    const unlocked: any[] = [];
    const locked: any[] = [];

    filtered.forEach((exercise) => {
      const diff = safeString(exercise.difficulty).toLowerCase();
      if (LOCKED_DIFFICULTIES.includes(diff)) {
        locked.push(exercise);
      } else {
        unlocked.push(exercise);
      }
    });

    const rewardExercise = locked[0] || null;

    const totalRequired = unlocked.length * REQUIRED_COMPLETIONS;
    const totalCompleted = unlocked.reduce((sum, exercise) => {
      const exId = getExerciseId(exercise);
      return sum + Math.min(practiceCompletions[exId]?.count || 0, REQUIRED_COMPLETIONS);
    }, 0);
    const progressPercent = totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0;
    const completedExerciseCount = unlocked.filter((ex) => {
      const exId = getExerciseId(ex);
      return (practiceCompletions[exId]?.count || 0) >= REQUIRED_COMPLETIONS;
    }).length;
    const remainingCount = unlocked.length - completedExerciseCount;

    return {
      unlocked,
      locked,
      rewardExercise,
      progressPercent,
      completedExerciseCount,
      remainingCount,
      allExercises: filtered,
    };
  }, [exercises, practiceCompletions]);

  // Audio preview for the locked reward exercise
  const { isPlaying: isPreviewPlaying, isLoading: isPreviewLoading, canPreview, togglePreview } =
    useRewardPreview(progressData.rewardExercise);

  // Video URL logic - check if there's actually a YouTube video
  const hasYouTubeVideo = !!(tutorialData?.youtube_url || tutorialData?.youtube_id);
  let videoUrl = tutorialData?.youtube_url || '';
  if (!videoUrl && tutorialData?.youtube_id) {
    videoUrl = `https://www.youtube.com/watch?v=${tutorialData.youtube_id}`;
  }

  // Reset playing state when video URL changes
  React.useEffect(() => {
    setPlaying(false);
  }, [videoUrl]);

  return (
    <div className="space-y-4">
      {/* Hero Card: Video with Creator Overlay + Title/Description/Core Concept */}
      <div className="relative bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl shadow-black/20 overflow-hidden">
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/10 pointer-events-none" />
        {/* Video Section with Creator Overlay */}
        <div className="relative">
          {/* Embedded Video or Static Thumbnail */}
          <div className="aspect-[21/9] bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 overflow-hidden relative group rounded-2xl">
            {!playing ? (
              <CustomYouTubeThumbnail
                videoUrl={videoUrl}
                customThumbnailUrl={tutorialData?.thumbnail_url}
                onPlay={() => setPlaying(true)}
                hasYouTubeVideo={hasYouTubeVideo}
              />
            ) : (
              <SimpleYouTubePlayer videoUrl={videoUrl} playing={playing} />
            )}
          </div>

          {/* Creator Info Overlay - Only show when there's a YouTube video */}
          {/* pointer-events-none allows clicks to pass through to thumbnail, pointer-events-auto on CreatorInfo keeps buttons clickable */}
          {/* Fades out when video is playing to not obstruct YouTube controls */}
          {hasYouTubeVideo && (
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
          )}

          {/* Level Badge Overlay - Only show when there's NO YouTube video (thumbnail only) */}
          {!hasYouTubeVideo && difficulty && (
            <div
              className="absolute bottom-0 left-0 right-0 pointer-events-none rounded-b-2xl"
              style={{
                background: `linear-gradient(to top, rgba(0,0,0,${gradientSettings.fromOpacity / 100}), rgba(0,0,0,${gradientSettings.viaOpacity / 100}) ${gradientSettings.viaPosition}%, transparent)`,
                padding: `${gradientSettings.paddingTop * 4}px 16px ${gradientSettings.paddingBottom * 4}px 16px`,
              }}
            >
              <div className="flex items-center justify-end">
                <span
                  className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize shadow-lg ${
                    difficulty === 'beginner'
                      ? 'bg-green-600 text-white'
                      : difficulty === 'intermediate'
                        ? 'bg-yellow-600 text-white'
                        : difficulty === 'advanced'
                          ? 'bg-red-600 text-white'
                          : 'bg-purple-600 text-white'
                  }`}
                >
                  {difficulty}
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Content Section: Title + Description + Core Concept */}
        <div className="px-6 py-5 space-y-4">
          {/* Title Header */}
          <h1 className="text-[36px] leading-tight font-bold bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
            {title}
          </h1>

          {/* Description */}
          <p className="text-slate-400 text-[18px] leading-relaxed">{description}</p>

          {/* Exercise Chain Section — Always visible */}
          <div className="border-t border-slate-700/50 pt-4 space-y-4">
            {progressData.rewardExercise ? (
              <>
                {/* Reward Header */}
                <div className="flex items-center gap-3">
                  {/* Large lock icon */}
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-5 h-5 text-purple-400" />
                  </div>

                  {/* Two rows: label + groove name */}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">
                      Final Reward
                    </span>
                    <h3 className="text-lg font-semibold text-white leading-tight truncate">
                      {safeString(progressData.rewardExercise.title) || 'Locked Groove'}
                    </h3>
                  </div>

                  {/* Unlock message on the right */}
                  <p className="text-xs text-slate-400 text-right flex-shrink-0">
                    {progressData.remainingCount > 0
                      ? `Complete ${progressData.remainingCount} more to unlock`
                      : 'Unlocked!'}
                  </p>
                </div>

                {/* Audio Preview */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePreview}
                    disabled={!canPreview || isPreviewLoading}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-shadow disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                    aria-label={isPreviewPlaying ? 'Stop preview' : 'Play preview'}
                  >
                    {isPreviewPlaying ? (
                      <Pause className="w-4 h-4 text-white" />
                    ) : (
                      <Play className="w-4 h-4 text-white ml-0.5" />
                    )}
                  </button>

                  {/* Waveform Bars */}
                  <div className="flex items-end gap-[3px] h-6">
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className={`w-[3px] rounded-full transition-all duration-200 ${
                          isPreviewPlaying
                            ? 'bg-purple-400 animate-waveform'
                            : 'bg-slate-600 h-1'
                        }`}
                        style={
                          isPreviewPlaying
                            ? { animationDelay: `${i * 0.1}s` }
                            : undefined
                        }
                      />
                    ))}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 truncate">
                      Hear what you&apos;re working toward
                    </p>
                    <p className="text-[10px] text-slate-500">0:05 preview</p>
                  </div>
                </div>

                {/* Exercise Progress Strip */}
                <div className="flex items-center gap-0">
                  {progressData.allExercises.map((exercise, index) => {
                    const exId = getExerciseId(exercise);
                    const diff = safeString(exercise.difficulty).toLowerCase();
                    const isLocked = LOCKED_DIFFICULTIES.includes(diff);
                    const completedCount = practiceCompletions[exId]?.count || 0;
                    const isCompleted = completedCount >= REQUIRED_COMPLETIONS;

                    return (
                      <React.Fragment key={exId}>
                        {/* Connecting line (between circles) */}
                        {index > 0 && (
                          <div
                            className={`flex-1 h-[2px] ${
                              (() => {
                                const prevExercise = progressData.allExercises[index - 1];
                                const prevId = getExerciseId(prevExercise);
                                const prevCompleted = (practiceCompletions[prevId]?.count || 0) >= REQUIRED_COMPLETIONS;
                                return prevCompleted ? 'bg-emerald-500/60' : 'bg-slate-700';
                              })()
                            }`}
                          />
                        )}

                        {/* Exercise circle */}
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                              isLocked
                                ? 'border-purple-500/50 bg-purple-900/30'
                                : isCompleted
                                  ? 'border-emerald-500 bg-emerald-900/40'
                                  : completedCount > 0
                                    ? 'border-amber-500/60 bg-amber-900/20'
                                    : 'border-slate-600 bg-slate-800/50'
                            }`}
                          >
                            {isLocked ? (
                              <Lock className="w-3 h-3 text-purple-400" />
                            ) : isCompleted ? (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <span
                                className={
                                  completedCount > 0
                                    ? 'text-amber-400'
                                    : 'text-slate-500'
                                }
                              >
                                {index + 1}
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[9px] ${
                              isLocked
                                ? 'text-purple-400 font-semibold uppercase'
                                : 'text-slate-500'
                            }`}
                          >
                            {isLocked ? 'Unlock' : `Ex ${index + 1}`}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Placeholder when no exercises exist — still shows Final Reward concept */
              <>
                {/* Reward Header — same structure as when exercises exist */}
                <div className="flex items-center gap-3">
                  {/* Large lock icon */}
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-5 h-5 text-purple-400" />
                  </div>

                  {/* Two rows: label + groove name */}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">
                      Final Reward
                    </span>
                    <h3 className="text-lg font-semibold text-white leading-tight truncate">
                      The Groove
                    </h3>
                  </div>

                  {/* Coming soon message on the right */}
                  <p className="text-xs text-slate-400 text-right flex-shrink-0">
                    Exercises coming soon
                  </p>
                </div>

                {/* Audio Preview placeholder — disabled state */}
                <div className="flex items-center gap-3 opacity-50">
                  <button
                    disabled
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/50 to-violet-600/50 flex items-center justify-center shadow-lg shadow-purple-500/10 cursor-not-allowed flex-shrink-0"
                    aria-label="Preview not available"
                  >
                    <Play className="w-4 h-4 text-white/70 ml-0.5" />
                  </button>

                  {/* Waveform Bars — static */}
                  <div className="flex items-end gap-[3px] h-6">
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className="w-[3px] rounded-full bg-slate-600 h-1"
                      />
                    ))}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 truncate">
                      Preview available soon
                    </p>
                    <p className="text-[10px] text-slate-600">0:05 preview</p>
                  </div>
                </div>

                {/* Exercise Progress Strip — placeholder dots */}
                <div className="flex items-center gap-0">
                  {[1, 2, 3].map((index) => (
                    <React.Fragment key={index}>
                      {/* Connecting line (between circles) */}
                      {index > 1 && (
                        <div className="flex-1 h-[2px] border-t-2 border-dashed border-slate-700/50" />
                      )}

                      {/* Exercise circle placeholder */}
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-dashed border-slate-600/50 bg-slate-800/30">
                          <span className="text-slate-500">{index}</span>
                        </div>
                        <span className="text-[9px] text-slate-600">
                          Ex {index}
                        </span>
                      </div>
                    </React.Fragment>
                  ))}

                  {/* Connecting line to reward */}
                  <div className="flex-1 h-[2px] border-t-2 border-dashed border-slate-700/50" />

                  {/* Reward circle */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-dashed border-purple-500/30 bg-purple-900/20">
                      <Lock className="w-3 h-3 text-purple-400/50" />
                    </div>
                    <span className="text-[9px] text-purple-400/70 font-semibold uppercase">
                      Unlock
                    </span>
                  </div>
                </div>
              </>
            )}
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
      <div className="relative bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl shadow-black/20 overflow-hidden">
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/10 pointer-events-none" />
        {/* Video section with creator overlay skeleton */}
        <div className="relative">
          {/* Video skeleton */}
          <div className="aspect-[21/9] skeleton-shimmer" />

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

          {/* Final Reward skeleton */}
          <div className="border-t border-slate-700/50 pt-4 space-y-4">
            {/* Reward header skeleton */}
            <div>
              <div className="skeleton-shimmer h-3 w-24 rounded mb-2" />
              <div className="skeleton-shimmer h-5 w-40 rounded mb-1" />
              <div className="skeleton-shimmer h-3 w-48 rounded" />
            </div>
            {/* Audio preview skeleton */}
            <div className="flex items-center gap-3">
              <div className="skeleton-shimmer w-10 h-10 rounded-full" />
              <div className="flex items-end gap-[3px] h-6">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="skeleton-shimmer w-[3px] h-1 rounded-full" />
                ))}
              </div>
              <div className="flex-1">
                <div className="skeleton-shimmer h-3 w-36 rounded mb-1" />
                <div className="skeleton-shimmer h-2 w-16 rounded" />
              </div>
            </div>
            {/* Progress strip skeleton */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <React.Fragment key={i}>
                  {i > 1 && <div className="flex-1 h-[2px] skeleton-shimmer" />}
                  <div className="skeleton-shimmer w-7 h-7 rounded-full" />
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
