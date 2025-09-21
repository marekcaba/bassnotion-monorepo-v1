/**
 * Lazy Loading with Preload Support
 *
 * Enhanced lazy loading that supports preloading components
 * before they are actually rendered
 */

import { lazy, ComponentType, LazyExoticComponent } from 'react';

export interface PreloadableComponent<T extends ComponentType<any>>
  extends LazyExoticComponent<T> {
  preload: () => Promise<void>;
}

/**
 * Create a lazy component with preload capability
 */
export function lazyWithPreload<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
): PreloadableComponent<T> {
  let preloadedComponent: Promise<{ default: T }> | null = null;

  const loadComponent = () => {
    if (!preloadedComponent) {
      preloadedComponent = importFn();
    }
    return preloadedComponent;
  };

  const LazyComponent = lazy(loadComponent) as PreloadableComponent<T>;

  LazyComponent.preload = loadComponent;

  return LazyComponent;
}

/**
 * Preload multiple components in parallel
 */
export async function preloadComponents(
  components: Array<PreloadableComponent<any>>,
): Promise<void> {
  await Promise.all(components.map((component) => component.preload()));
}

/**
 * Preload component when user hovers over trigger element
 */
export function preloadOnHover(
  component: PreloadableComponent<any>,
  triggerRef: React.RefObject<HTMLElement>,
): () => void {
  if (!triggerRef.current) return () => {};

  const handleMouseEnter = () => {
    component.preload();
  };

  triggerRef.current.addEventListener('mouseenter', handleMouseEnter);

  return () => {
    triggerRef.current?.removeEventListener('mouseenter', handleMouseEnter);
  };
}

/**
 * Preload component when browser is idle
 */
export function preloadWhenIdle(
  component: PreloadableComponent<any>,
): () => void {
  if (!('requestIdleCallback' in window)) {
    // Fallback for browsers that don't support requestIdleCallback
    const timeoutId = setTimeout(() => {
      component.preload();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }

  const handle = requestIdleCallback(
    () => {
      component.preload();
    },
    { timeout: 2000 },
  );

  return () => cancelIdleCallback(handle);
}

/**
 * Preload component based on viewport intersection
 */
export function preloadOnIntersection(
  component: PreloadableComponent<any>,
  targetRef: React.RefObject<HTMLElement>,
  options?: IntersectionObserverInit,
): () => void {
  if (!targetRef.current) return () => {};

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          component.preload();
          observer.disconnect();
        }
      });
    },
    {
      rootMargin: '50px',
      ...options,
    },
  );

  observer.observe(targetRef.current);

  return () => observer.disconnect();
}
