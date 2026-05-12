'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { LearningJourney, JourneyMilestone } from '@bassnotion/contracts';

interface JourneyRoadmapProps {
  journey: LearningJourney;
  currentMilestoneId?: string;
  completedMilestones?: string[];
  compact?: boolean;
  showAnimation?: boolean;
}

// Milestone status
type MilestoneStatus = 'completed' | 'current' | 'locked';

function getMilestoneStatus(
  milestone: JourneyMilestone,
  currentMilestoneId?: string,
  completedMilestones?: string[],
): MilestoneStatus {
  if (completedMilestones?.includes(milestone.id)) {
    return 'completed';
  }
  if (milestone.id === currentMilestoneId) {
    return 'current';
  }
  return 'locked';
}

// Status configuration
const STATUS_CONFIG: Record<
  MilestoneStatus,
  { bgColor: string; borderColor: string; iconBg: string; textColor: string }
> = {
  completed: {
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    iconBg: 'bg-green-500',
    textColor: 'text-green-400',
  },
  current: {
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/50',
    iconBg: 'bg-blue-500',
    textColor: 'text-blue-400',
  },
  locked: {
    bgColor: 'bg-gray-800/30',
    borderColor: 'border-gray-700/30',
    iconBg: 'bg-gray-700',
    textColor: 'text-gray-500',
  },
};

export function JourneyRoadmap({
  journey,
  currentMilestoneId,
  completedMilestones = [],
  compact = false,
  showAnimation = true,
}: JourneyRoadmapProps) {
  const [visibleMilestones, setVisibleMilestones] = useState<number>(0);

  // Animate milestones appearing one by one
  useEffect(() => {
    if (!showAnimation) {
      setVisibleMilestones(journey.milestones.length);
      return;
    }

    let current = 0;
    const timer = setInterval(() => {
      current++;
      setVisibleMilestones(current);
      if (current >= journey.milestones.length) {
        clearInterval(timer);
      }
    }, 200);

    return () => clearInterval(timer);
  }, [journey.milestones.length, showAnimation]);

  // Calculate progress
  const progress =
    journey.milestones.length > 0
      ? (completedMilestones.length / journey.milestones.length) * 100
      : 0;

  return (
    <div className="w-full">
      {/* Journey header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-1">{journey.name}</h3>
        <p className="text-gray-400 text-sm">{journey.description}</p>
        {journey.estimatedWeeks && (
          <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-400">
            ~{journey.estimatedWeeks} weeks
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Progress</span>
          <span className="text-white font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Milestone roadmap */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-800" />

        {/* Milestones */}
        <div className="space-y-4">
          {journey.milestones.map((milestone, index) => {
            const status = getMilestoneStatus(
              milestone,
              currentMilestoneId,
              completedMilestones,
            );
            const config = STATUS_CONFIG[status];
            const isVisible = index < visibleMilestones;

            return (
              <div
                key={milestone.id}
                className={cn(
                  'relative pl-10 transition-all duration-300',
                  isVisible
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-4',
                )}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                {/* Milestone marker */}
                <div
                  className={cn(
                    'absolute left-0 w-8 h-8 rounded-full flex items-center justify-center',
                    'border-2 transition-colors duration-200',
                    config.iconBg,
                    status === 'locked' && 'opacity-50',
                  )}
                >
                  {status === 'completed' ? (
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : status === 'current' ? (
                    <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                  ) : (
                    <svg
                      className="w-4 h-4 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  )}
                </div>

                {/* Milestone content */}
                <div
                  className={cn(
                    'p-4 rounded-xl border transition-colors duration-200',
                    config.bgColor,
                    config.borderColor,
                    status === 'current' && 'ring-1 ring-blue-500/50',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4
                        className={cn(
                          'font-semibold mb-1',
                          status === 'locked' ? 'text-gray-400' : 'text-white',
                        )}
                      >
                        {milestone.title}
                      </h4>
                      {!compact && (
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {milestone.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-xs px-2 py-1 rounded-full font-medium',
                        config.textColor,
                        config.bgColor,
                      )}
                    >
                      {status === 'completed'
                        ? 'Done'
                        : status === 'current'
                          ? 'In Progress'
                          : 'Locked'}
                    </span>
                  </div>

                  {/* Tutorial count */}
                  {!compact && milestone.tutorialIds && milestone.tutorialIds.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                      {milestone.tutorialIds.length} tutorial
                      {milestone.tutorialIds.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
