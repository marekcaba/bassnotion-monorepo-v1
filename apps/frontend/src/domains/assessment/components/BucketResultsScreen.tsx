'use client';

/**
 * BucketResultsScreen
 *
 * Displays personalized assessment results with coach insight
 * and 3-day learning plan.
 * Styled to match V1 assessment warm theme.
 */

import type {
  CoachInsightTemplate,
  SegmentAssessmentResult,
} from '@bassnotion/contracts';
import { CoachInsightCard } from './CoachInsightCard';
import { ThreeDayPlan } from './ThreeDayPlan';
import { Loader2, ArrowRight } from 'lucide-react';

export interface BucketResultsScreenProps {
  coachInsight: CoachInsightTemplate | null;
  result: SegmentAssessmentResult | null;
  onComplete: () => void;
  isSubmitting: boolean;
}

export function BucketResultsScreen({
  coachInsight,
  result,
  onComplete,
  isSubmitting,
}: BucketResultsScreenProps) {
  // Get bucket display name
  const getBucketDisplayName = (bucket: string): string => {
    const bucketNames: Record<string, string> = {
      true_beginner: 'Complete Beginner',
      solid_beginner: 'Solid Beginner',
      beginner_with_gaps: 'Beginner with Gaps',
      intermediate_theory_gaps: 'Intermediate (Theory Focus)',
      solid_intermediate: 'Solid Intermediate',
    };
    return bucketNames[bucket] || bucket;
  };

  const bucket =
    result?.bucket || coachInsight?.targetBucket || 'beginner_with_gaps';

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          {/* Subtle decorative element */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-amber-500/50" />
            <span
              className="text-xs uppercase tracking-[0.2em] text-amber-500/70"
              style={{ fontFamily: 'var(--font-inter), sans-serif' }}
            >
              Your Results
            </span>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-500/50" />
          </div>

          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white mb-6 tracking-tight"
            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
          >
            Your Personalized{' '}
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              Learning Path
            </span>
          </h1>

          {/* Skill Level Badge */}
          <div
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-lg shadow-lg shadow-amber-500/20 mb-4"
            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
          >
            <span>{getBucketDisplayName(bucket)}</span>
          </div>

          <p
            className="text-neutral-400 max-w-2xl mx-auto leading-relaxed"
            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
          >
            Based on your responses, we&apos;ve created a personalized learning
            path just for you. Here&apos;s what we&apos;ve discovered about your
            bass journey.
          </p>
        </div>

        {/* Coach Insight Card */}
        {coachInsight && (
          <CoachInsightCard insight={coachInsight} className="mb-8" />
        )}

        {/* 3-Day Plan */}
        {coachInsight && (
          <ThreeDayPlan
            day1Title={coachInsight.day1Title || 'Day 1: Foundation'}
            day1Description={
              coachInsight.day1Description ||
              'Start with the basics and build a solid foundation.'
            }
            day2Title={coachInsight.day2Title || 'Day 2: Practice'}
            day2Description={
              coachInsight.day2Description ||
              'Apply what you learned with guided exercises.'
            }
            day3Title={coachInsight.day3Title || 'Day 3: Play'}
            day3Description={
              coachInsight.day3Description ||
              'Put it all together with a real song.'
            }
            className="mb-8"
          />
        )}

        {/* CTA Section */}
        <div className="text-center mt-12">
          <button
            onClick={onComplete}
            disabled={isSubmitting}
            className="group relative px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium text-lg transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0 inline-flex items-center gap-2"
            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="relative z-10">Saving your plan...</span>
              </>
            ) : (
              <>
                <span className="relative z-10">
                  {coachInsight?.ctaText || 'Start Your Journey'}
                </span>
                <ArrowRight className="w-5 h-5 relative z-10" />
              </>
            )}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>

          <p
            className="text-neutral-500 mt-4 text-sm"
            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
          >
            Your progress will be saved to your account
          </p>
        </div>
      </div>
    </div>
  );
}
