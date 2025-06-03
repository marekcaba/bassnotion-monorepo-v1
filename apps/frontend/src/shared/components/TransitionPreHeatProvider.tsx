'use client';

import { useTransitionPreHeat } from '@/lib/hooks/use-view-transition-router';

interface TransitionPreHeatProviderProps {
  children: React.ReactNode;
}

/**
 * Global provider that ensures View Transitions are pre-heated
 * Place this high in your component tree for platform-wide smooth transitions
 */
export function TransitionPreHeatProvider({
  children,
}: TransitionPreHeatProviderProps) {
  // Initialize pre-heating globally
  useTransitionPreHeat();

  return <>{children}</>;
}
