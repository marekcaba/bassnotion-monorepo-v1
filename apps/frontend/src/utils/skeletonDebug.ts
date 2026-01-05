/**
 * Skeleton Debug Utility
 *
 * Provides a shared baseline timestamp for all skeleton debug logs.
 * This ensures all component render times are measured from the same starting point.
 *
 * Note: Logs are controlled by VERBOSE_DEBUG flag.
 * Enable with NEXT_PUBLIC_VERBOSE_DEBUG=true in .env.local
 */

import { isVerboseDebugEnabled } from '@/config/debug';

// Initialize the baseline on module load
const SKELETON_DEBUG_KEY = '__SKELETON_DEBUG_START';

// Initialize baseline if not already set
if (typeof window !== 'undefined' && !(window as any)[SKELETON_DEBUG_KEY]) {
  (window as any)[SKELETON_DEBUG_KEY] = performance.now();
}

/**
 * Get the elapsed time since skeleton debug baseline was initialized
 */
export function getSkeletonDebugTime(): string {
  if (typeof window !== 'undefined' && (window as any)[SKELETON_DEBUG_KEY]) {
    return (performance.now() - (window as any)[SKELETON_DEBUG_KEY]).toFixed(0);
  }
  return '0';
}

/**
 * Reset the skeleton debug baseline (call when navigating to a new page)
 */
export function resetSkeletonDebugBaseline(): void {
  if (typeof window !== 'undefined') {
    (window as any)[SKELETON_DEBUG_KEY] = performance.now();
  }
}

/**
 * Log a skeleton debug message with consistent formatting.
 * Only logs when VERBOSE_DEBUG is enabled.
 */
export function logSkeletonDebug(
  emoji: string,
  component: string,
  renderCount: number,
  data?: Record<string, any>
): void {
  if (isVerboseDebugEnabled() && renderCount <= 5) {
    console.log(
      `${emoji} [SKELETON-DEBUG] ${component} render #${renderCount} at +${getSkeletonDebugTime()}ms`,
      data ?? {}
    );
  }
}
