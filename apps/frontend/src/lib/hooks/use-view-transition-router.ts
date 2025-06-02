import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

type TransitionNavigateOptions = {
  skipTransition?: boolean; // Optional flag to skip the animation for specific navigations
};

/**
 * Custom hook for navigation with CSS View Transitions API
 * 
 * Provides smooth page transition animations with zoom-in/zoom-out effects.
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
    (
      href: string,
      options?: TransitionNavigateOptions
    ) => {
      // Check if the browser supports the View Transitions API.
      // If not, or if the animation is explicitly skipped, perform regular navigation.
      if (!document.startViewTransition || options?.skipTransition) {
        router.push(href);
        return;
      }

      // Start the View Transition.
      // The callback inside startViewTransition is executed when the browser captures the snapshot of the old state.
      document.startViewTransition(() => {
        // Here, we perform the actual navigation using the Next.js router.
        // The browser will then capture the snapshot of the new state and animate the transition.
        router.push(href);
      });
    },
    [router] // Dependency on the router object to ensure the hook updates correctly.
  );

  return { navigateWithTransition };
} 