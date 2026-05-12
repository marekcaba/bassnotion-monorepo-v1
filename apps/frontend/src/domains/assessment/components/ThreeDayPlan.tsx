'use client';

/**
 * ThreeDayPlan
 *
 * Displays the personalized 3-day learning plan.
 * Styled to match V1 assessment warm theme.
 */

import { cn } from '@/lib/utils';
import { Calendar, Music, PlayCircle } from 'lucide-react';

export interface ThreeDayPlanProps {
  day1Title: string;
  day1Description: string;
  day2Title: string;
  day2Description: string;
  day3Title: string;
  day3Description: string;
  className?: string;
}

export function ThreeDayPlan({
  day1Title,
  day1Description,
  day2Title,
  day2Description,
  day3Title,
  day3Description,
  className,
}: ThreeDayPlanProps) {
  const days = [
    {
      number: 1,
      title: day1Title,
      description: day1Description,
      icon: Calendar,
    },
    {
      number: 2,
      title: day2Title,
      description: day2Description,
      icon: Music,
    },
    {
      number: 3,
      title: day3Title,
      description: day3Description,
      icon: PlayCircle,
    },
  ];

  return (
    <div className={cn('relative', className)}>
      {/* Subtle glow behind card */}
      <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 rounded-2xl blur-xl opacity-50" />

      <div className="relative bg-neutral-900/80 backdrop-blur-sm rounded-xl p-6 ring-1 ring-white/10">
        {/* Header */}
        <h3
          className="text-xl font-semibold text-white mb-6 text-center tracking-tight"
          style={{ fontFamily: 'var(--font-inter), sans-serif' }}
        >
          Your 3-Day Quick Start Plan
        </h3>

        {/* Days */}
        <div className="grid md:grid-cols-3 gap-4">
          {days.map((day) => (
            <div
              key={day.number}
              className="relative bg-neutral-800/50 rounded-xl p-5 border border-neutral-700/50 transition-all duration-200 hover:border-amber-500/30"
            >
              {/* Day number badge - warm amber gradient */}
              <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold shadow-lg shadow-amber-500/20">
                {day.number}
              </div>

              {/* Content */}
              <div className="pt-4">
                {/* Icon */}
                <day.icon className="w-8 h-8 text-amber-400/70 mb-3" />

                {/* Title */}
                <h4
                  className="text-lg font-semibold text-white mb-2"
                  style={{ fontFamily: 'var(--font-inter), sans-serif' }}
                >
                  {day.title}
                </h4>

                {/* Description */}
                <p
                  className="text-neutral-400 text-sm leading-relaxed"
                  style={{ fontFamily: 'var(--font-inter), sans-serif' }}
                >
                  {day.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Encouragement */}
        <p
          className="text-center text-neutral-500 text-sm mt-6"
          style={{ fontFamily: 'var(--font-inter), sans-serif' }}
        >
          Complete these 3 days and you&apos;ll be amazed at your progress!
        </p>
      </div>
    </div>
  );
}
