import { useRouter } from 'next/navigation';
import { createStructuredLogger } from '@bassnotion/contracts';
import { useCallback, useEffect } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

const logger = createStructuredLogger('ViewTransitionRouter');

// Enhanced CSS management inspired by Framer Commerce
const STYLE_ID = 'bassnotion-view-transition-styles';

// Framer Commerce inspired transition configuration
const TRANSITION_CONFIG = {
  exit: {
    x: '0px',
    y: '0px',
    scale: 1,
    opacity: 1,
    rotate: 0,
    transition: {
      type: 'tween',
      delay: 0,
      duration: 0.2,
      ease: [0.27, 0, 0.51, 1],
    },
  },
  enter: {
    x: '0px',
    y: '0px',
    scale: 1,
    opacity: 0,
    rotate: 0,
    transition: {
      type: 'tween',
      delay: 0,
      duration: 0.2,
      ease: [0.27, 0, 0.51, 1],
    },
  },
};

const cssManager = {
  pendingRules: {} as Record<string, Record<string, string> | string>,
  style: null as HTMLStyleElement | null,

  set(selector: string, values: Record<string, string>) {
    const existingRule = this.pendingRules[selector];
    if (typeof existingRule === 'object' && existingRule) {
      this.pendingRules[selector] = { ...existingRule, ...values };
    } else {
      this.pendingRules[selector] = values;
    }
  },

  commit() {
    // TODO: Review non-null assertion - consider null safety
    if (!this.style) {
      this.style = document.createElement('style');
      this.style.id = STYLE_ID;
    }

    let cssText = '';
    for (const selector in this.pendingRules) {
      const rule = this.pendingRules[selector];

      if (typeof rule === 'string') {
        // Raw CSS text (for keyframes)
        cssText += rule + '\n';
      } else if (rule) {
        // CSS properties object
        cssText += `${selector} {\n`;
        for (const [property, value] of Object.entries(rule)) {
          cssText += `  ${property}: ${value};\n`;
        }
        cssText += '}\n';
      }
    }

    this.style.textContent = cssText;
    document.head.appendChild(this.style);
    this.pendingRules = {};
  },

  remove() {
    if (this.style && this.style.parentElement) {
      this.style.parentElement.removeChild(this.style);
      this.style = null;
    }
    this.pendingRules = {};
  },

  clear() {
    this.pendingRules = {};
  },

  setRaw(key: string, cssText: string) {
    this.pendingRules[key] = cssText;
  },
};

function injectTransitionStyles() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      performance.mark('bassnotion-vt-style');

      // Use enhanced CSS manager
      cssManager.set('@media (prefers-reduced-motion)', {
        '::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*)':
          'animation: none !important;',
      });

      cssManager.set('::view-transition-old(*), ::view-transition-new(*)', {
        'mix-blend-mode': 'normal',
        'backface-visibility': 'hidden',
      });

      // Seamless crossfade: old stays visible while new fades in on top
      // This prevents any background flash during transition
      const fadeInKeyframes = `
        @keyframes view-transition-fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `;

      const fadeOutKeyframes = `
        @keyframes view-transition-fade-out {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `;

      // Old page stays fully visible, then fades out after new page is visible
      cssManager.set('::view-transition-old(root)', {
        'animation-name': 'view-transition-fade-out',
        'animation-duration': '0.1s',
        'animation-delay': '0.2s',
        'animation-timing-function': 'ease-out',
        'animation-fill-mode': 'both',
      });

      // New page fades in on top of the old page
      cssManager.set('::view-transition-new(root)', {
        'animation-name': 'view-transition-fade-in',
        'animation-duration': '0.2s',
        'animation-delay': '0s',
        'animation-timing-function': 'ease-out',
        'animation-fill-mode': 'both',
      });

      // Inject keyframes as text (they can't be set via object syntax)
      cssManager.setRaw('@keyframes-fade-in', fadeInKeyframes);
      cssManager.setRaw('@keyframes-fade-out', fadeOutKeyframes);

      cssManager.commit();
      resolve();
    });
  });
}

function cleanupTransitionStyles() {
  requestAnimationFrame(() => {
    performance.mark('bassnotion-vt-remove');
    cssManager.remove();
  });
}

/* 
function supportsViewTransitions() {
  // TODO: Review non-null assertion - consider null safety
  return !!document.startViewTransition;
}

// Framer Commerce style transition function
// Currently unused but kept for future extensibility
async function executeViewTransition(
  navigationCallback: () => void,
  _transitionConfig: typeof TRANSITION_CONFIG,
) {
  // TODO: Review non-null assertion - consider null safety
  if (!document.startViewTransition) {
    navigationCallback();
    return;
  }

  // Inject styles first (Framer pattern)
  await injectTransitionStyles();

  performance.mark('bassnotion-vt');

  // Create promise for navigation completion (Framer pattern)
  let resolveNavigation: (() => void) | undefined;
  const navigationPromise = new Promise<void>((resolve) => {
    resolveNavigation = resolve;
  });

  // Start the View Transition (Framer pattern)
  const transition = document.startViewTransition(async () => {
    performance.mark('bassnotion-vt-freeze');

    // Execute navigation
    navigationCallback();

    // Wait for navigation completion (this is the key Framer pattern)
    await navigationPromise;
  });

  // Resolve navigation after a short delay to allow Next.js routing
  setTimeout(() => {
    if (resolveNavigation) {
      resolveNavigation();
    }
  }, 50);

  // Handle transition completion
  transition.updateCallbackDone
    .then(() => {
      performance.mark('bassnotion-vt-unfreeze');
    })
    .catch(() => {
      // Handle error silently
    });

  // Clean up after transition finishes
  Promise.all([transition.ready, transition.finished])
    .then(() => {
      performance.mark('bassnotion-vt-finished');
      cleanupTransitionStyles();
    })
    .catch(() => {
      cleanupTransitionStyles();
    });

  return transition;
}
*/

// Utility function for delays
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Transition queue management inspired by Framer Commerce
let currentTransition: ViewTransition | null = null;
let isTransitioning = false;

function handleTransitionInterrupt() {
  if (currentTransition && isTransitioning) {
    try {
      currentTransition.skipTransition();
    } catch (_error) {
      // skipTransition might not be available or transition might be finished
      logger.debug('Transition skip failed:', _error);
    }
  }
}

// Performance monitoring inspired by Framer Commerce
interface TransitionStats {
  totalDuration: number;
  cssInjection: number;
  navigationTime: number;
  cleanupTime: number;
  interrupted: boolean;
  preHeated: boolean;
}

const transitionStats: TransitionStats[] = [];

function recordTransitionStats(): TransitionStats {
  const measures = performance.getEntriesByType('measure');
  const marks = performance.getEntriesByType('mark');

  const vtMeasure = measures.find(
    (m) => m.name === 'bassnotion-view-transition',
  );
  const _preheatMeasure = measures.find((m) => m.name === 'bassnotion-preheat');
  const styleTime =
    marks.find((m) => m.name === 'bassnotion-vt-style')?.startTime || 0;
  const removeTime =
    marks.find((m) => m.name === 'bassnotion-vt-remove')?.startTime || 0;
  const startTime =
    marks.find((m) => m.name === 'bassnotion-vt-start')?.startTime || 0;

  const stats: TransitionStats = {
    totalDuration: vtMeasure?.duration || 0,
    cssInjection: styleTime - startTime,
    navigationTime: 0, // Could be enhanced to track router.push timing
    cleanupTime: removeTime - startTime,
    interrupted: false,
    preHeated: isPreHeated,
  };

  transitionStats.push(stats);

  // Keep only last 10 transitions
  if (transitionStats.length > 10) {
    transitionStats.shift();
  }

  return stats;
}

// Export for debugging - only in browser environment
if (typeof window !== 'undefined') {
  (window as any).__bassnotionTransitionStats = () => {
    const measures = performance.getEntriesByType('measure');
    const _preheatMeasure = measures.find(
      (m) => m.name === 'bassnotion-preheat',
    );

    logger.info('Pre-heating Status:', isPreHeated ? 'Complete' : 'Pending');
    if (_preheatMeasure) {
      logger.info('Pre-heat Time:', `${_preheatMeasure.duration.toFixed(2)}ms`);
    }
    console.table(transitionStats);
    const avg =
      transitionStats.reduce((acc, s) => acc + s.totalDuration, 0) /
      transitionStats.length;
    logger.info(`Average transition time: ${avg.toFixed(2)}ms`);

    const preHeatedCount = transitionStats.filter((s) => s.preHeated).length;
    logger.info(
      `Pre-heated transitions: ${preHeatedCount}/${transitionStats.length}`,
    );
  };
}

// Pre-heating system for smooth first transitions
let isPreHeated = false;
let preHeatPromise: Promise<void> | null = null;

async function preHeatTransitions(): Promise<void> {
  if (isPreHeated || preHeatPromise) {
    return preHeatPromise || Promise.resolve();
  }

  preHeatPromise = new Promise<void>((resolve) => {
    const executePreHeat = async () => {
      // TODO: Review non-null assertion - consider null safety
      if (!document.startViewTransition) {
        isPreHeated = true;
        resolve();
        return;
      }

      try {
        performance.mark('bassnotion-preheat-start');

        // Pre-inject styles to avoid cold start
        await injectTransitionStyles();

        // Trigger an invisible dummy transition to initialize the system
        const dummyTransition = document.startViewTransition(async () => {
          // Minimal DOM change that doesn't affect visual layout
          const marker = document.createElement('div');
          marker.style.cssText =
            'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
          marker.id = 'vt-preheat-marker';
          document.body.appendChild(marker);

          await delay(1); // Minimal delay for DOM update

          marker.remove();
        });

        // Wait for the dummy transition to complete
        await dummyTransition.finished;

        performance.mark('bassnotion-preheat-end');
        performance.measure(
          'bassnotion-preheat',
          'bassnotion-preheat-start',
          'bassnotion-preheat-end',
        );

        isPreHeated = true;
      } catch (_error) {
        logger.warn('Pre-heating failed, transitions will still work:', _error);
        isPreHeated = true; // Mark as done to avoid retrying
      }

      resolve();
    };

    executePreHeat();
  });

  return preHeatPromise;
}

// Auto pre-heat on module load (client-side only)
if (typeof window !== 'undefined') {
  // Use requestIdleCallback for non-blocking pre-heating
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => preHeatTransitions(), { timeout: 2000 });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => preHeatTransitions(), 100);
  }
}

/**
 * Hook for manually pre-heating the transition system
 * Call this in your main app component for guaranteed smooth first transitions
 */
export function useTransitionPreHeat() {
  useEffect(() => {
    preHeatTransitions();
  }, []);

  return { preHeatTransitions, isPreHeated: () => isPreHeated };
}

/**
 * Custom hook for navigation with CSS View Transitions API
 *
 * Implements Framer Commerce style transitions with dynamic CSS generation,
 * proper navigation waiting, and cleanup for professional page transitions.
 */
export function useViewTransitionRouter() {
  const router = useRouter();

  const navigateWithTransition = useCallback(
    async (url: string) => {
      const currentPath =
        typeof window !== 'undefined' ? window.location.pathname : '';

      // Guard: Don't navigate if already on the target URL
      if (currentPath === url) {
        logger.debug('Already on target URL, skipping navigation:', url);
        return;
      }

      logger.debug('Navigating with transition:', {
        from: currentPath,
        to: url,
      });

      // TODO: Review non-null assertion - consider null safety
      if (!document.startViewTransition) {
        logger.debug('View transitions not supported, using router.push');
        router.push(url);
        return;
      }

      try {
        // Handle rapid navigation clicks - interrupt current transition
        if (currentTransition && isTransitioning) {
          logger.debug('Interrupting current transition');
          handleTransitionInterrupt();
        }

        // Ensure system is pre-heated before first transition
        await preHeatTransitions();

        performance.mark('bassnotion-vt-start');

        // Skip style injection if already pre-heated (styles are already injected)
        // TODO: Review non-null assertion - consider null safety
        if (!isPreHeated) {
          await injectTransitionStyles();
        }

        isTransitioning = true;

        logger.debug('Starting view transition to:', url);
        currentTransition = document.startViewTransition(async () => {
          await delay(50);
          logger.debug('Executing router.push to:', url);
          router.push(url);
          await delay(50);
        });

        // Clean up transition state when finished
        currentTransition.finished.finally(() => {
          isTransitioning = false;
          currentTransition = null;
          // Don't cleanup styles immediately if pre-heated (keep them for next transition)
          // TODO: Review non-null assertion - consider null safety
          if (!isPreHeated) {
            cleanupTransitionStyles();
          }
          performance.mark('bassnotion-vt-end');
          performance.measure(
            'bassnotion-view-transition',
            'bassnotion-vt-start',
            'bassnotion-vt-end',
          );

          // Record performance stats
          recordTransitionStats();
        });

        await currentTransition.finished;
      } catch (error) {
        logger.error('View transition failed:', error);
        isTransitioning = false;
        currentTransition = null;
        cleanupTransitionStyles();
        router.push(url);
      }
    },
    [router],
  );

  return { navigateWithTransition };
}
