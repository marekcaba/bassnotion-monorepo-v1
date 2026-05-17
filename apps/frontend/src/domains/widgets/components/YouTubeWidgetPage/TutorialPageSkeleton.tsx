'use client';

import React from 'react';
import { TutorialVideoCardSkeleton } from './TutorialVideoCard';
import { ExerciseControlPanelSkeleton } from './ExerciseControlPanel';
import { TransportClockSkeleton } from './components/TransportClock';
import { FretboardCardSkeleton } from './FretboardCard/FretboardCard';
import { ExerciseSelectorCardSkeleton } from './components/ExerciseSelectorCard';
import { FourWidgetsCardSkeleton } from './components/FourWidgetsCard';

/**
 * Skeleton for ExerciseSelector
 * Inlined here after removing the standalone ExerciseSelector component
 * (functionality in ExerciseSelectorCard)
 */
function ExerciseSelectorSkeleton() {
  return (
    <div className="relative bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-black/20">
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/10 pointer-events-none" />

      {/* Header */}
      <div className="relative px-5 py-4 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-3">
          <div className="skeleton-shimmer w-10 h-10 rounded-xl" />
          <div>
            <div className="skeleton-shimmer w-24 h-5 rounded mb-1.5" />
            <div className="skeleton-shimmer w-16 h-3 rounded" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative p-4">
        {/* Exercise list skeleton */}
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{ animationDelay: `${i * 100}ms` }}
              className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="skeleton-shimmer w-7 h-7 rounded-lg" />
                <div className="skeleton-shimmer flex-1 h-4 rounded max-w-[160px]" />
                <div className="skeleton-shimmer w-2.5 h-2.5 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        {/* Description box skeleton */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="skeleton-shimmer w-32 h-5 rounded" />
            <div className="skeleton-shimmer w-20 h-5 rounded-md" />
          </div>
          <div className="skeleton-shimmer w-full h-4 rounded mb-2" />
          <div className="skeleton-shimmer w-3/4 h-4 rounded mb-4" />
          <div className="flex gap-5 pt-3 border-t border-white/10">
            <div className="skeleton-shimmer w-16 h-3 rounded" />
            <div className="skeleton-shimmer w-16 h-3 rounded" />
            <div className="skeleton-shimmer w-16 h-3 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for HomeNavbar
 * Shows 3 navigation button placeholders on desktop, hamburger on mobile
 */
function HomeNavbarSkeleton() {
  return (
    <nav className="w-full bg-transparent py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        {/* Desktop Navigation skeleton - 3 buttons */}
        <div className="hidden md:flex items-center gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-shimmer h-4 w-16 rounded" />
          ))}
        </div>
        {/* Mobile hamburger skeleton */}
        <div className="md:hidden skeleton-shimmer w-6 h-6 rounded" />
      </div>
    </nav>
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
    <div className="min-h-screen">
      {/* Header with Logo Skeleton - matches YouTubeWidgetPageContent header */}
      <header className="w-full pt-8 sm:pt-12 pb-5 flex justify-center">
        <div className="skeleton-shimmer w-[180px] sm:w-[260px] md:w-[320px] lg:w-[400px] xl:w-[480px] h-[45px] sm:h-[65px] md:h-[80px] lg:h-[100px] xl:h-[120px] rounded-lg" />
      </header>

      {/* Navbar Skeleton */}
      <HomeNavbarSkeleton />

      {/* Mobile-first central container - matches YouTubeWidgetPageContent */}
      <div className="mx-auto px-4 py-6 w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
        <div className="space-y-4">
          {/* 0. User Indicator and Admin Controls */}
          {/* Only show back button - user indicator hidden when not logged in */}
          <div className="flex justify-between items-center gap-3">
            {/* Back button skeleton */}
            <div className="skeleton-shimmer w-9 h-9 rounded-md" />
            {/* Empty spacer - no user indicator shown for non-logged in users */}
            <div className="w-9" />
          </div>

          {/* 1. Tutorial Video Card (Title + Description + Core Concept + Video + Creator) */}
          <TutorialVideoCardSkeleton />

          {/* 2. Exercise Control Panel (NEW - compact selector with controls) */}
          <ExerciseControlPanelSkeleton />

          {/* 3. Exercise Selector (OLD - kept for comparison) */}
          <ExerciseSelectorSkeleton />

          {/* 4. Transport Clock with Timeline Loop Strip */}
          <TransportClockSkeleton />

          {/* 5. Interactive Fretboard Card */}
          <FretboardCardSkeleton />

          {/* 6. Exercise Selector Card */}
          <ExerciseSelectorCardSkeleton />

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
