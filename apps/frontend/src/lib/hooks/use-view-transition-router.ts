import { useRouter } from 'next/navigation';
import { useCallback, useRef } from 'react';

type TransitionNavigateOptions = {
  skipTransition?: boolean;
};

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
      ease: [0.27, 0, 0.51, 1]
    }
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
      ease: [0.27, 0, 0.51, 1]
    }
  }
};

const STYLE_ID = 'bassnotion-view-transition-styles';

function generateTransitionCSS(phase: 'exit' | 'enter', config: typeof TRANSITION_CONFIG.exit) {
  const animationName = `view-transition-${phase}`;
  const easing = `cubic-bezier(${config.transition.ease.join(',')})`;
  
  const startState = phase === 'exit' 
    ? `opacity: ${config.opacity}; transform: translateX(${config.x}) translateY(${config.y}) scale(${config.scale}) rotate(${config.rotate}deg);`
    : `opacity: 0; transform: translateX(${config.x}) translateY(${config.y}) scale(${config.scale}) rotate(${config.rotate}deg);`;
    
  const endState = phase === 'exit'
    ? `opacity: 0; transform: translateX(${config.x}) translateY(${config.y}) scale(${config.scale}) rotate(${config.rotate}deg);`
    : `opacity: ${config.opacity}; transform: translateX(${config.x}) translateY(${config.y}) scale(${config.scale}) rotate(${config.rotate}deg);`;

  return `
    @keyframes ${animationName} {
      0% { ${startState} }
      100% { ${endState} }
    }
    
    ::view-transition-${phase === 'enter' ? 'new' : 'old'}(root) {
      animation-name: ${animationName};
      animation-duration: ${config.transition.duration}s;
      animation-delay: ${config.transition.delay}s;
      animation-timing-function: ${easing};
      animation-fill-mode: both;
    }
  `;
}

function injectTransitionStyles() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      performance.mark('bassnotion-vt-style');
      
      // Remove existing styles
      const existingStyle = document.getElementById(STYLE_ID);
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }

      // Create new style element
      const style = document.createElement('style');
      style.id = STYLE_ID;
      
      let css = `
        @media (prefers-reduced-motion) {
          ::view-transition-group(*),
          ::view-transition-old(*),
          ::view-transition-new(*) {
            animation: none !important;
          }
        }
        
        ::view-transition-old(*),
        ::view-transition-new(*) {
          mix-blend-mode: normal;
          backface-visibility: hidden;
        }
      `;
      
      css += generateTransitionCSS('exit', TRANSITION_CONFIG.exit);
      css += generateTransitionCSS('enter', TRANSITION_CONFIG.enter);
      
      style.textContent = css;
      document.head.appendChild(style);
      
      resolve();
    });
  });
}

function cleanupTransitionStyles() {
  requestAnimationFrame(() => {
    performance.mark('bassnotion-vt-remove');
    const style = document.getElementById(STYLE_ID);
    if (style) {
      document.head.removeChild(style);
    }
  });
}

function supportsViewTransitions() {
  return !!document.startViewTransition;
}

// Framer Commerce style transition function
async function executeViewTransition(
  navigationCallback: () => void,
  transitionConfig: typeof TRANSITION_CONFIG
) {
  if (!supportsViewTransitions()) {
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
    .catch(() => {});

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

/**
 * Custom hook for navigation with CSS View Transitions API
 * 
 * Implements Framer Commerce style transitions with dynamic CSS generation,
 * proper navigation waiting, and cleanup for professional page transitions.
 */
export function useViewTransitionRouter() {
  const router = useRouter();

  const navigateWithTransition = useCallback(
    (href: string, options?: TransitionNavigateOptions) => {
      // Skip transition if explicitly requested or not supported
      if (options?.skipTransition || !supportsViewTransitions()) {
        router.push(href);
        return;
      }

      // Execute Framer Commerce style transition
      return executeViewTransition(
        () => router.push(href),
        TRANSITION_CONFIG
      );
    },
    [router],
  );

  return { navigateWithTransition };
}
