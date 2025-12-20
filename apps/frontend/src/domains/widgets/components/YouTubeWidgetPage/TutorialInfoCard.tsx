'use client';

import React from 'react';
import { ZoneCard, ZoneCardContent } from '@/ui-libraries';
import type { Tutorial } from '@bassnotion/contracts';
import { logSkeletonDebug } from '@/utils/skeletonDebug';

interface TutorialInfoCardProps {
  tutorialData?: Tutorial;
}

// SKELETON-DEBUG: Component mount tracking
let tutorialInfoCardRenderCount = 0;

export function TutorialInfoCard({ tutorialData }: TutorialInfoCardProps) {
  tutorialInfoCardRenderCount++;
  logSkeletonDebug('📄', 'TutorialInfoCard', tutorialInfoCardRenderCount, {
    hasTutorialData: !!tutorialData,
    title: tutorialData?.title,
  });

  // Use tutorialData or fallback to default
  const title = tutorialData?.title || 'Come Together';
  const description =
    tutorialData?.description ||
    'Learn advanced modal thinking and tension/release techniques';
  const difficulty =
    tutorialData?.difficulty || tutorialData?.level || 'advanced';

  // Core concept data (editable in admin mode)
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

  return (
    <div className="relative">
      {/* Unified Tutorial + Core Concept Card */}
      <ZoneCard className="zone-card bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl overflow-hidden">
        {/* Difficulty Tag - Top Right Corner of Card */}
        <div className="absolute top-4 right-4 z-10">
          <span className="bg-orange-500 text-white px-2 py-0.5 rounded-full text-xs font-medium shadow-lg">
            {difficulty}
          </span>
        </div>

        <ZoneCardContent className="p-6">
          {/* Tutorial Header Section */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent mb-3">
              {title}
            </h1>
            <p className="text-slate-400 text-base">{description}</p>
          </div>

          {/* Core Concept Section */}
          <div className="border-t border-slate-700/50 pt-6">
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
        </ZoneCardContent>
      </ZoneCard>
    </div>
  );
}

/**
 * Skeleton loading state for TutorialInfoCard
 * Matches the exact layout of the real component for smooth transition
 */
export function TutorialInfoCardSkeleton() {
  return (
    <div className="relative">
      <ZoneCard className="zone-card bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl overflow-hidden">
        {/* Difficulty Tag Skeleton */}
        <div className="absolute top-4 right-4 z-10">
          <div className="skeleton-shimmer w-16 h-5 rounded-full" />
        </div>

        <ZoneCardContent className="p-6">
          {/* Title + Description Skeleton */}
          <div className="mb-6">
            <div className="skeleton-shimmer h-9 w-3/4 rounded-lg mb-3" />
            <div className="skeleton-shimmer h-5 w-full rounded mb-2" />
            <div className="skeleton-shimmer h-5 w-2/3 rounded" />
          </div>

          {/* Core Concept Section Skeleton */}
          <div className="border-t border-slate-700/50 pt-6">
            <div className="skeleton-shimmer h-6 w-32 rounded mb-3" />
            <div className="skeleton-shimmer h-4 w-full rounded mb-2" />
            <div className="skeleton-shimmer h-4 w-5/6 rounded mb-4" />

            {/* Bullet Points Skeleton */}
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="skeleton-shimmer w-2 h-2 rounded-full flex-shrink-0" />
                  <div
                    className={`skeleton-shimmer h-4 rounded skeleton-delay-${i}`}
                    style={{ width: `${60 + i * 10}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </ZoneCardContent>
      </ZoneCard>
      <span className="sr-only">Loading tutorial information...</span>
    </div>
  );
}
