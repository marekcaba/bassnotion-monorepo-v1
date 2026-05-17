import { useState, useEffect, useCallback, type RefObject } from 'react';

export type ActName = 'understand' | 'practice' | 'apply';

interface UseCurrentActParams {
  containerRef: RefObject<HTMLDivElement | null>;
  act1Ref: RefObject<HTMLDivElement | null>;
  act2Ref: RefObject<HTMLDivElement | null>;
  act3Ref: RefObject<HTMLDivElement | null>;
}

interface UseCurrentActResult {
  currentAct: ActName;
  scrollToAct: (act: ActName, options?: { instant?: boolean }) => void;
  setCurrentAct: (act: ActName) => void;
}

/**
 * Detects which act section is currently visible in the scroll-snap container
 * using IntersectionObserver, and provides a smooth-scroll navigation function.
 */
export function useCurrentAct({
  containerRef,
  act1Ref,
  act2Ref,
  act3Ref,
}: UseCurrentActParams): UseCurrentActResult {
  const [currentAct, setCurrentAct] = useState<ActName>('understand');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const refMap: [ActName, RefObject<HTMLDivElement | null>][] = [
      ['understand', act1Ref],
      ['practice', act2Ref],
      ['apply', act3Ref],
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const match = refMap.find(
              ([, ref]) => ref.current === entry.target,
            );
            if (match) {
              setCurrentAct(match[0]);
            }
          }
        }
      },
      {
        root: container,
        threshold: 0.5,
      },
    );

    for (const [, ref] of refMap) {
      if (ref.current) {
        observer.observe(ref.current);
      }
    }

    return () => observer.disconnect();
  }, [containerRef, act1Ref, act2Ref, act3Ref]);

  const scrollToAct = useCallback(
    (act: ActName, options?: { instant?: boolean }) => {
      const refMap: Record<ActName, RefObject<HTMLDivElement | null>> = {
        understand: act1Ref,
        practice: act2Ref,
        apply: act3Ref,
      };
      // Use 'auto' (instant) for initial mount, 'smooth' for user navigation
      const behavior = options?.instant ? 'auto' : 'smooth';
      refMap[act].current?.scrollIntoView({ behavior });
    },
    [act1Ref, act2Ref, act3Ref],
  );

  return { currentAct, scrollToAct, setCurrentAct };
}
