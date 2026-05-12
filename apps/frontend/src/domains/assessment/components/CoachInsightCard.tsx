'use client';

/**
 * CoachInsightCard
 *
 * Displays personalized coach insight with avatar and message.
 * Styled to match V1 assessment warm theme.
 */

import type { CoachInsightTemplate } from '@bassnotion/contracts';
import { cn } from '@/lib/utils';

export interface CoachInsightCardProps {
  insight: CoachInsightTemplate;
  className?: string;
}

export function CoachInsightCard({
  insight,
  className,
}: CoachInsightCardProps) {
  // Default avatar if none provided
  const avatarUrl =
    insight.coachAvatarUrl || '/images/coach-avatar-default.png';

  return (
    <div className={cn('relative', className)}>
      {/* Subtle glow behind card */}
      <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 rounded-2xl blur-xl opacity-50" />

      <div className="relative bg-neutral-900/80 backdrop-blur-sm rounded-xl p-6 ring-1 ring-white/10">
        {/* Coach Header */}
        <div className="flex items-start gap-4 mb-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold overflow-hidden shadow-lg shadow-amber-500/20">
              {insight.coachAvatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={insight.coachName}
                  className="w-full h-full object-cover"
                />
              ) : (
                insight.coachName.charAt(0)
              )}
            </div>
          </div>

          {/* Coach info and title */}
          <div className="flex-1">
            <div
              className="flex items-center gap-2 mb-1"
              style={{ fontFamily: 'var(--font-inter), sans-serif' }}
            >
              <span className="text-amber-400 font-semibold">
                {insight.coachName}
              </span>
              <span className="text-neutral-500">says:</span>
            </div>
            <h3
              className="text-xl font-semibold text-white tracking-tight"
              style={{ fontFamily: 'var(--font-inter), sans-serif' }}
            >
              {insight.insightTitle}
            </h3>
          </div>
        </div>

        {/* Insight Body */}
        <div className="pl-20">
          <p
            className="text-neutral-300 leading-relaxed whitespace-pre-wrap"
            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
          >
            {insight.insightBody}
          </p>

          {/* Skill Check Acknowledgment */}
          {insight.skillCheckAcknowledgment && (
            <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p
                className="text-amber-300 text-sm italic"
                style={{ fontFamily: 'var(--font-inter), sans-serif' }}
              >
                {insight.skillCheckAcknowledgment}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
