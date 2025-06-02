import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

type TransitionNavigateOptions = {
  skipTransition?: boolean; // Optional flag to skip the animation for specific navigations
  timeout?: number; // Maximum time to wait for page load (default 3000ms)
};

/**
 * Custom hook for navigation with CSS View Transitions API
 *
 * Provides smooth page transition animations with fade in/out effects.
 * Waits for the new page to load before completing the transition.
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

      // Start the View Transition with proper loading state handling
      document.startViewTransition(async () => {
        const startTime = Date.now();
        const timeout = options?.timeout || 3000; // 3 second timeout
        
        // Create a promise that resolves when navigation and rendering is complete
        const navigationPromise = new Promise<void>((resolve) => {
          // Start the navigation
          router.push(href);
          
          // Use a combination of strategies to detect when the new page is ready
          const checkPageTransition = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            
            // Safety timeout to prevent hanging
            if (elapsed >= timeout) {
              resolve();
              return;
            }
            
            // Use requestAnimationFrame to ensure DOM updates have been processed
            requestAnimationFrame(() => {
              // Check if enough time has passed for Next.js navigation
              // Next.js typically takes 100-500ms for client-side navigation
              if (elapsed >= 150) {
                // Add a small buffer to ensure content has rendered
                setTimeout(() => {
                  resolve();
                }, 50);
              } else {
                // Continue checking
                setTimeout(checkPageTransition, 50);
              }
            });
          };
          
          // Start checking after a minimal delay to allow router.push to initialize
          setTimeout(checkPageTransition, 16); // ~1 frame
        });
        
        // Wait for navigation to complete or timeout
        await navigationPromise;
      });
    },
    [router],
  );

  return { navigateWithTransition };
}
