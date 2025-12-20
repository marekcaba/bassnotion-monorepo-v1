'use client';

import React from 'react';
import { TutorialInfoCardSkeleton } from './TutorialInfoCard';
import { ExerciseSelectorSkeleton } from './ExerciseSelector/ExerciseSelector';
import { TransportClockSkeleton } from './components/TransportClock';
import { FretboardCardSkeleton } from './FretboardCard/FretboardCard';
import { GlobalControlsCardSkeleton } from './components/GlobalControlsCard';
import { FourWidgetsCardSkeleton } from './components/FourWidgetsCard';

/**
 * Skeleton for YouTube Video Section
 * Matches the exact structure: aspect-video container + creator info bar below
 */
function YouTubeVideoSectionSkeleton() {
  return (
    <div className="space-y-4">
      {/* YouTube Video Player Skeleton - matches actual component structure */}
      <div className="relative">
        <div className="aspect-video bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-xl overflow-hidden relative shadow-2xl">
          {/* Thumbnail placeholder with play button */}
          <div className="absolute inset-0 skeleton-shimmer" />
          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center">
              <div className="w-0 h-0 border-l-[16px] border-l-slate-500 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Creator Info Section Skeleton - 90% width like actual component */}
      <div className="w-[90%] mx-auto">
        <div className="flex items-center gap-3 p-3 bg-slate-800/40 backdrop-blur-xl rounded-lg border border-slate-700/50 shadow-lg">
          {/* Avatar skeleton */}
          <div className="skeleton-shimmer w-10 h-10 rounded-full flex-shrink-0" />
          {/* Creator info skeleton */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="skeleton-shimmer h-4 w-32 rounded" />
            <div className="skeleton-shimmer h-3 w-24 rounded" />
          </div>
          {/* Subscribe button skeleton */}
          <div className="skeleton-shimmer h-9 w-24 rounded-full flex-shrink-0" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for Teaching Takeaway Card
 * Matches the emerald-themed card with key points
 */
function TeachingTakeawayCardSkeleton() {
  return (
    <div className="bg-emerald-900/20 backdrop-blur-xl border border-emerald-700/30 shadow-2xl rounded-xl">
      <div className="p-6">
        {/* Header Skeleton - icon box + title/subtitle */}
        <div className="flex items-center gap-3 mb-6">
          <div className="skeleton-shimmer w-12 h-12 rounded-xl" />
          <div>
            <div className="skeleton-shimmer h-7 w-48 rounded mb-2" />
            <div className="skeleton-shimmer h-4 w-56 rounded" />
          </div>
        </div>

        {/* Main Summary Skeleton - Core Learning box */}
        <div className="bg-emerald-800/20 rounded-xl p-6 mb-6 border border-emerald-600/20">
          <div className="skeleton-shimmer h-5 w-28 rounded mb-3" />
          <div className="skeleton-shimmer h-4 w-full rounded mb-2" />
          <div className="skeleton-shimmer h-4 w-full rounded mb-2" />
          <div className="skeleton-shimmer h-4 w-4/5 rounded mb-4" />

          {/* Stats Skeleton - 3 columns */}
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="text-center p-3 bg-emerald-700/20 rounded-lg"
              >
                <div className="skeleton-shimmer h-8 w-8 mx-auto rounded mb-1" />
                <div className="skeleton-shimmer h-3 w-16 mx-auto rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Key Points Skeleton - "What You'll Master" section */}
        <div className="space-y-4">
          <div className="skeleton-shimmer h-5 w-36 rounded mb-4" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`flex items-start gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30 skeleton-delay-${i}`}
            >
              <div className="skeleton-shimmer w-8 h-8 rounded-full flex-shrink-0" />
              <div className="flex-1 flex items-center gap-3">
                <div className="skeleton-shimmer w-5 h-5 rounded" />
                <div className="skeleton-shimmer h-4 w-48 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Practice Recommendation Skeleton */}
        <div className="mt-6 p-4 bg-gradient-to-r from-emerald-800/20 to-green-800/20 rounded-xl border border-emerald-600/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="skeleton-shimmer w-5 h-5 rounded" />
            <div className="skeleton-shimmer h-4 w-24 rounded" />
          </div>
          <div className="skeleton-shimmer h-3 w-full rounded mb-1" />
          <div className="skeleton-shimmer h-3 w-5/6 rounded" />
        </div>
      </div>
      <span className="sr-only">Loading teaching takeaways...</span>
    </div>
  );
}

/**
 * Full page skeleton for the tutorial page
 * Displays a complete skeleton layout matching the actual page structure
 * for smooth perceived loading experience (FAANG-style)
 */
export function TutorialPageSkeleton() {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, hsl(220 45% 20%) 0%, hsl(230 35% 10%) 40%, hsl(240 25% 5%) 100%)',
      }}
    >
      {/* Header with Logo Skeleton - matches YouTubeWidgetPageContent header */}
      <header className="w-full pt-8 sm:pt-12 pb-5 flex justify-center">
        <div className="skeleton-shimmer w-[180px] sm:w-[260px] md:w-[320px] lg:w-[400px] xl:w-[480px] h-[45px] sm:h-[65px] md:h-[80px] lg:h-[100px] xl:h-[120px] rounded-lg" />
      </header>

      {/* Mobile-first central container - matches YouTubeWidgetPageContent */}
      <div className="mx-auto px-4 py-6 w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
        <div className="space-y-4">
          {/* 0. User Indicator and Admin Controls */}
          <div className="flex justify-between items-center gap-3">
            {/* Back button skeleton */}
            <div className="skeleton-shimmer w-9 h-9 rounded-md" />
            {/* Admin controls + user indicator */}
            <div className="flex items-center gap-3">
              <div className="skeleton-shimmer w-16 h-8 rounded-md" />
              <div className="skeleton-shimmer w-9 h-9 rounded-full" />
            </div>
          </div>

          {/* 1. YouTube Video Section - with Creator Info below */}
          <YouTubeVideoSectionSkeleton />

          {/* 2. Tutorial Info Card */}
          <TutorialInfoCardSkeleton />

          {/* 3. Exercise Selector */}
          <ExerciseSelectorSkeleton />

          {/* 4. Transport Clock with Timeline Loop Strip */}
          <TransportClockSkeleton />

          {/* 5. Interactive Fretboard Card */}
          <FretboardCardSkeleton />

          {/* 6. Global Playback Controls Card */}
          <GlobalControlsCardSkeleton />

          {/* 7. Four Widgets Card */}
          <FourWidgetsCardSkeleton />

          {/* 8. Teaching Takeaway Card */}
          <TeachingTakeawayCardSkeleton />

          {/* 9. Debug toggle (minimal) */}
          <div className="text-center mt-4">
            <div className="skeleton-shimmer h-10 w-40 mx-auto rounded-lg" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading tutorial page...</span>
    </div>
  );
}
