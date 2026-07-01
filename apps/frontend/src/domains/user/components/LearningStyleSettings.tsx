'use client';

import { useState, useCallback } from 'react';
import { Check, Waves, Compass, Lock } from 'lucide-react';
import type { LearningStyle } from '@bassnotion/contracts';
import { cn } from '@/lib/utils';
import { useToast } from '@/shared/hooks/use-toast';
import { useUpdateLearningStyle } from '../hooks/use-user-profile';

interface LearningStyleOption {
  value: LearningStyle;
  title: string;
  description: string;
  icon: React.ElementType;
  accentColor: string;
  pulseColor: string;
}

const LEARNING_STYLES: LearningStyleOption[] = [
  {
    value: 'free_flow',
    title: 'Free Flow',
    description:
      'Complete the path at your own pace. Recommendations available but never required.',
    icon: Waves,
    accentColor: 'from-emerald-500/20 to-teal-500/10',
    pulseColor: 'bg-emerald-500',
  },
  {
    value: 'guided_practice',
    title: 'Guided Practice',
    description:
      'Get nudges to complete recommended sessions between checkpoints.',
    icon: Compass,
    accentColor: 'from-amber-500/20 to-orange-500/10',
    pulseColor: 'bg-amber-500',
  },
  {
    value: 'strict_mode',
    title: 'Strict Mode',
    description:
      'Must complete recommended sessions before proceeding to next checkpoint.',
    icon: Lock,
    accentColor: 'from-rose-500/20 to-pink-500/10',
    pulseColor: 'bg-rose-500',
  },
];

interface LearningStyleSettingsProps {
  currentStyle: LearningStyle;
  onUpdate?: (style: LearningStyle) => void;
}

export function LearningStyleSettings({
  currentStyle,
  onUpdate,
}: LearningStyleSettingsProps) {
  const [selected, setSelected] = useState<LearningStyle>(currentStyle);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updatingStyle, setUpdatingStyle] = useState<LearningStyle | null>(
    null,
  );
  // Save through the mutation hook → refreshes the shared profile cache on success.
  const updateLearningStyle = useUpdateLearningStyle();
  const { toast } = useToast();

  const handleSelect = useCallback(
    async (style: LearningStyle) => {
      if (style === selected || isUpdating) return;

      // Optimistic UI: Update immediately, revert on failure
      const previousStyle = selected;
      setSelected(style);
      setIsUpdating(true);
      setUpdatingStyle(style);

      try {
        await updateLearningStyle.mutateAsync(style);
        onUpdate?.(style);

        const selectedOption = LEARNING_STYLES.find((s) => s.value === style);
        toast({
          title: 'Learning style updated',
          description: `Your learning style is now set to ${selectedOption?.title}`,
          variant: 'success',
        });
      } catch (error) {
        // Revert on failure
        setSelected(previousStyle);
        toast({
          title: 'Failed to update',
          description:
            error instanceof Error ? error.message : 'Please try again',
          variant: 'destructive',
        });
      } finally {
        setIsUpdating(false);
        setUpdatingStyle(null);
      }
    },
    [selected, isUpdating, onUpdate, toast],
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Learning Style</h2>
        <p className="mt-1 text-sm text-gray-400">
          Choose how you want to progress through your learning journey
        </p>
      </div>

      {/* Options Grid */}
      <div className="grid gap-3">
        {LEARNING_STYLES.map((style) => {
          const isSelected = selected === style.value;
          const isLoading = updatingStyle === style.value;
          const Icon = style.icon;

          return (
            <button
              key={style.value}
              onClick={() => handleSelect(style.value)}
              disabled={isUpdating}
              className={cn(
                'group relative flex items-start gap-4 rounded-xl border p-4 text-left transition-all duration-300',
                'hover:border-zinc-600 hover:bg-zinc-800/50',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc700] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900',
                isSelected
                  ? 'border-[#ffc700]/50 bg-gradient-to-br ' + style.accentColor
                  : 'border-zinc-700/50 bg-zinc-800/30',
                isUpdating && !isLoading && 'opacity-50 cursor-not-allowed',
              )}
            >
              {/* Selection Indicator */}
              <div
                className={cn(
                  'relative flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 mt-0.5',
                  isSelected
                    ? 'border-[#ffc700] bg-[#ffc700]'
                    : 'border-zinc-600 bg-transparent group-hover:border-zinc-500',
                )}
              >
                {isLoading ? (
                  <div className="size-3 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
                ) : isSelected ? (
                  <Check className="size-3.5 text-zinc-900" strokeWidth={3} />
                ) : null}

                {/* Pulse effect on selected */}
                {isSelected && !isLoading && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#ffc700]/30" />
                )}
              </div>

              {/* Icon */}
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-lg transition-all duration-300',
                  isSelected
                    ? 'bg-zinc-900/50 text-[#ffc700]'
                    : 'bg-zinc-700/30 text-zinc-500 group-hover:text-zinc-400',
                )}
              >
                <Icon className="size-5" />
              </div>

              {/* Content */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      'font-medium leading-none transition-colors duration-300',
                      isSelected ? 'text-white' : 'text-zinc-300',
                    )}
                  >
                    {style.title}
                  </p>
                  {style.value === 'free_flow' && (
                    <span className="inline-flex items-center rounded-full bg-zinc-700/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                      default
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    'text-sm leading-relaxed transition-colors duration-300',
                    isSelected ? 'text-zinc-300' : 'text-zinc-500',
                  )}
                >
                  {style.description}
                </p>
              </div>

              {/* Hover glow effect */}
              <div
                className={cn(
                  'absolute inset-0 -z-10 rounded-xl opacity-0 blur-xl transition-opacity duration-500',
                  'group-hover:opacity-100',
                  isSelected ? style.pulseColor + '/10' : 'bg-zinc-500/5',
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
