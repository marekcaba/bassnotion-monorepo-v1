import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

type TransitionNavigateOptions = {
  skipTransition?: boolean; // Optional flag to skip the animation for specific navigations
};

/**
 * Custom hook for navigation with CSS View Transitions API
 *
 * Provides smooth page transition animations with fade in/out effects.
 * Falls back to regular navigation for unsupported browsers.
 *
 * @example
 * ```tsx
 * const { navigateWithTransition } = useViewTransitionRouter();
 *
 * const handleClick = () => {
 *   navigateWithTransition('/dashboard');
 * };
 * ```
 */
export function useViewTransitionRouter() {
  const router = useRouter();

  const navigateWithTransition = useCallback(
    (href: string, options?: TransitionNavigateOptions) => {
      // Check if the browser supports the View Transitions API.
      // If not, or if the animation is explicitly skipped, perform regular navigation.
      if (!document.startViewTransition || options?.skipTransition) {
        router.push(href);
        return;
      }

      // Start the View Transition - let the browser handle timing
      document.startViewTransition(() => {
        // Simple navigation - the View Transitions API handles the rest
        router.push(href);
      });
    },
    [router],
  );

  return { navigateWithTransition };
}
