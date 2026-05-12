'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { LearningJourney, UserJourney } from '@bassnotion/contracts';
import { JourneyRoadmap } from './JourneyRoadmap';

interface JourneySectionProps {
  className?: string;
}

interface JourneyData {
  journey: LearningJourney;
  userJourney: UserJourney;
}

export function JourneySection({ className }: JourneySectionProps) {
  const router = useRouter();
  const [data, setData] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's journey
  useEffect(() => {
    const fetchJourney = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/journey/my`,
          {
            credentials: 'include',
          },
        );

        if (!response.ok) {
          if (response.status === 404) {
            // No journey assigned yet
            setData(null);
            return;
          }
          throw new Error('Failed to fetch journey');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Failed to load journey:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchJourney();
  }, []);

  // No journey assigned - show CTA to take assessment
  if (!loading && !data && !error) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-6',
          className,
        )}
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Your Journey</h3>
            <p className="text-sm text-gray-400">
              Complete the assessment to get your personalized learning path
            </p>
          </div>
        </div>

        <p className="text-gray-400 mb-6">
          Take our quick skill assessment to unlock a personalized learning
          journey tailored to your goals, preferred techniques, and music
          interests.
        </p>

        <button
          onClick={() => router.push('/assessment')}
          className={cn(
            'w-full py-3 rounded-xl font-semibold',
            'bg-gradient-to-r from-blue-500 to-purple-600 text-white',
            'hover:from-blue-600 hover:to-purple-700',
            'transition-all duration-200',
          )}
        >
          Start Assessment
        </button>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-gray-800 bg-gray-900/50 p-6',
          className,
        )}
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gray-800 animate-pulse" />
          <div className="flex-1">
            <div className="h-5 bg-gray-800 rounded w-1/3 mb-2 animate-pulse" />
            <div className="h-4 bg-gray-800 rounded w-1/2 animate-pulse" />
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-gray-800/50 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-red-500/30 bg-red-500/10 p-6',
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <svg
            className="w-6 h-6 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-red-300">Failed to load your journey</p>
        </div>
      </div>
    );
  }

  // Journey loaded
  if (!data) return null;

  const { journey, userJourney } = data;
  const completedCount = userJourney.completedMilestones?.length || 0;
  const totalCount = journey.milestones.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-6',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Your Journey</h3>
            <p className="text-sm text-gray-400">{journey.name}</p>
          </div>
        </div>

        {/* Progress badge */}
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            {Math.round(progress)}%
          </div>
          <div className="text-xs text-gray-400">
            {completedCount}/{totalCount} milestones
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Journey roadmap */}
      <JourneyRoadmap
        journey={journey}
        currentMilestoneId={userJourney.currentMilestoneId}
        completedMilestones={userJourney.completedMilestones}
        compact
        showAnimation={false}
      />

      {/* View details button */}
      <button
        onClick={() => router.push('/journey')}
        className={cn(
          'mt-6 w-full py-3 rounded-xl font-medium text-sm',
          'bg-gray-800 hover:bg-gray-700 text-white',
          'transition-colors duration-200',
        )}
      >
        View Full Journey
      </button>
    </div>
  );
}
