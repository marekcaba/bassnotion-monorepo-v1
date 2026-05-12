import type { ChartConfig } from '@/shared/components/ui/chart';

export const exerciseCompletionConfig = {
  completions: {
    label: 'Completions',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

export const tempoProgressConfig = {
  currentBpm: {
    label: 'Current BPM',
    color: 'hsl(var(--chart-1))',
  },
  targetBpm: {
    label: 'Target BPM',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig;

export const journeyProgressConfig = {
  tutorials: {
    label: 'Tutorials',
    color: 'hsl(var(--chart-1))',
  },
  exercises: {
    label: 'Exercises',
    color: 'hsl(var(--chart-2))',
  },
  journey: {
    label: 'Journey',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig;

export const weeklyActivityConfig = {
  minutes: {
    label: 'Minutes',
    color: 'hsl(var(--chart-1))',
  },
  exercises: {
    label: 'Exercises',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;
