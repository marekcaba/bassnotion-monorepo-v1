'use client';

import { useCallback } from 'react';
import {
  BookOpen,
  Library,
  ClipboardCheck,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/shared/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';

/** Color mapping for skill level badges */
const SKILL_LEVEL_STYLES: Record<string, string> = {
  beginner: 'bg-green-500/20 text-green-400 border-green-500/30',
  intermediate: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  advanced: 'bg-red-500/20 text-red-400 border-red-500/30',
};

/** Format a skill level string for display */
function formatSkillLevel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/** Format a goal/technique string for display (e.g., "finger-style" -> "Finger Style") */
function formatLabel(value: string): string {
  return value
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface QuickStartCard {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: string | null;
}

const QUICK_START_CARDS: QuickStartCard[] = [
  {
    title: 'Start a Tutorial',
    description: 'Select a tutorial from the sidebar to begin playing along',
    icon: BookOpen,
    action: null,
  },
  {
    title: 'Browse Library',
    description: 'Explore our full collection of bass tutorials',
    icon: Library,
    action: '/library',
  },
  {
    title: 'Take Assessment',
    description:
      'Discover your skill level and get personalized recommendations',
    icon: ClipboardCheck,
    action: '/assessment/v2',
  },
];

export function WelcomeScreen() {
  const { profile, isLoading } = useUserProfile();
  const { navigateWithTransition } = useViewTransitionRouter();

  const handleNavigate = useCallback(
    (path: string) => {
      navigateWithTransition(path);
    },
    [navigateWithTransition],
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#ffc700]" />
      </div>
    );
  }

  const displayName = profile?.displayName;
  const hasAssessment = profile?.assessmentCompleted;
  const skillLevel = profile?.skillLevel;
  const primaryGoal = profile?.primaryGoal;
  const techniques = profile?.preferredTechniques ?? [];
  const genres = profile?.preferredGenres ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 md:p-10">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">
          {displayName ? `Welcome back, ${displayName}!` : 'Welcome!'}
        </h1>
        <p className="mt-2 text-zinc-400">
          Your bass learning journey starts here
        </p>
      </div>

      {/* Assessment Results or CTA */}
      {hasAssessment ? (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100">
              Your Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Skill Level */}
            {skillLevel && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-400">Skill Level</span>
                <Badge
                  className={cn(
                    'text-xs',
                    SKILL_LEVEL_STYLES[skillLevel.toLowerCase()] ??
                      'bg-zinc-700 text-zinc-300',
                  )}
                >
                  {formatSkillLevel(skillLevel)}
                </Badge>
              </div>
            )}

            {/* Primary Goal */}
            {primaryGoal && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-400">Primary Goal</span>
                <span className="text-sm text-zinc-200">
                  {formatLabel(primaryGoal)}
                </span>
              </div>
            )}

            {/* Preferred Techniques */}
            {techniques.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm text-zinc-400">Techniques</span>
                <div className="flex flex-wrap gap-1.5">
                  {techniques.map((technique) => (
                    <span
                      key={technique}
                      className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                    >
                      {formatLabel(technique)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Preferred Genres */}
            {genres.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm text-zinc-400">Genres</span>
                <div className="flex flex-wrap gap-1.5">
                  {genres.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                    >
                      {formatLabel(genre)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card
          className="group cursor-pointer border-[#ffc700]/30 bg-zinc-900 transition-colors hover:border-[#ffc700]/50"
          onClick={() => handleNavigate('/assessment/v2')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-[#ffc700]">
              <ClipboardCheck className="size-5" />
              Take your skill assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-400">
              Answer a few questions to get personalized tutorial
              recommendations based on your skill level and goals.
            </p>
            <div className="mt-3 flex items-center gap-1 text-sm font-medium text-[#ffc700]">
              Get started
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Start Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_START_CARDS.map((card) => {
          const Icon = card.icon;
          const isClickable = card.action !== null;

          return (
            <Card
              key={card.title}
              className={cn(
                'border-zinc-800 bg-zinc-900 transition-colors',
                isClickable && 'cursor-pointer hover:border-zinc-700',
              )}
              onClick={
                isClickable ? () => handleNavigate(card.action!) : undefined
              }
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-zinc-100">
                  <Icon className="size-5 text-[#ffc700]" />
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400">{card.description}</p>
                {isClickable && (
                  <div className="mt-3 flex items-center gap-1 text-sm font-medium text-[#ffc700]">
                    Go
                    <ArrowRight className="size-3.5" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
