// Debug utilities for tracking infinite re-render issues
import React from 'react';
import { createStructuredLogger } from '@bassnotion/contracts';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

const logger = createStructuredLogger('DebugUtils');

export function deepCompareAndLog(
  label: string,
  obj1: any,
  obj2: any,
  maxDepth = 3,
): boolean {
  const changes = findObjectChanges(obj1, obj2, '', maxDepth);

  if (changes.length > 0) {
    logger.info(`🔍 ${label} CHANGES DETECTED:`, changes);
    return true;
  }

  return false;
}

function findObjectChanges(
  obj1: any,
  obj2: any,
  path = '',
  maxDepth = 3,
  currentDepth = 0,
): string[] {
  const changes: string[] = [];

  // Prevent infinite recursion
  if (currentDepth >= maxDepth) {
    return changes;
  }

  // Handle null/undefined cases
  if (obj1 === null && obj2 === null) return changes;
  if (obj1 === null || obj2 === null) {
    changes.push(`${path}: ${obj1} -> ${obj2}`);
    return changes;
  }

  // Handle primitive types
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    if (obj1 !== obj2) {
      changes.push(`${path}: ${obj1} -> ${obj2}`);
    }
    return changes;
  }

  // Handle arrays
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) {
      changes.push(`${path}.length: ${obj1.length} -> ${obj2.length}`);
    }

    const minLength = Math.min(obj1.length, obj2.length);
    for (let i = 0; i < minLength; i++) {
      const subChanges = findObjectChanges(
        obj1[i],
        obj2[i],
        `${path}[${i}]`,
        maxDepth,
        currentDepth + 1,
      );
      changes.push(...subChanges);
    }
    return changes;
  }

  // Handle objects
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  const allKeys = new Set([...keys1, ...keys2]);

  for (const key of allKeys) {
    const newPath = path ? `${path}.${key}` : key;

    if (!(key in obj1)) {
      changes.push(`${newPath}: undefined -> ${obj2[key]}`);
    } else if (!(key in obj2)) {
      changes.push(`${newPath}: ${obj1[key]} -> undefined`);
    } else {
      // Special handling for function references
      if (typeof obj1[key] === 'function' && typeof obj2[key] === 'function') {
        if (obj1[key] !== obj2[key]) {
          changes.push(`${newPath}: [Function] identity changed`);
        }
      } else {
        const subChanges = findObjectChanges(
          obj1[key],
          obj2[key],
          newPath,
          maxDepth,
          currentDepth + 1,
        );
        changes.push(...subChanges);
      }
    }
  }

  return changes;
}

// Hook to track object changes between renders
export function useObjectChangeTracker(
  label: string,
  obj: any,
  enabled = true,
) {
  const prevObjRef = React.useRef(obj);

  React.useEffect(() => {
    if (!enabled) return;

    const hasChanges = deepCompareAndLog(label, prevObjRef.current, obj);
    if (hasChanges) {
      logger.info(`🔍 ${label} object identity changed:`, {
        prev: prevObjRef.current,
        current: obj,
        sameReference: prevObjRef.current === obj,
      });
    }

    prevObjRef.current = obj;
  });
}

// Hook to track why a component re-rendered
export function useWhyDidYouUpdate(name: string, props: Record<string, any>) {
  const previousProps = React.useRef<Record<string, any>>();
  const renderCount = React.useRef(0);
  renderCount.current++;

  React.useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changedProps: Record<string, any> = {};

      allKeys.forEach((key) => {
        if (previousProps.current![key] !== props[key]) {
          // Special handling for objects to show what changed inside
          if (
            typeof props[key] === 'object' &&
            props[key] !== null &&
            previousProps.current![key] !== null
          ) {
            const subKeys = Object.keys({
              ...previousProps.current![key],
              ...props[key],
            });
            const subChanges: Record<string, any> = {};
            subKeys.forEach((subKey) => {
              if (previousProps.current![key][subKey] !== props[key][subKey]) {
                subChanges[subKey] = {
                  from: previousProps.current![key][subKey],
                  to: props[key][subKey],
                };
              }
            });
            if (Object.keys(subChanges).length > 0) {
              changedProps[key] = {
                type: 'object',
                changes: subChanges,
              };
            }
          } else {
            changedProps[key] = {
              from: previousProps.current![key],
              to: props[key],
            };
          }
        }
      });

      if (Object.keys(changedProps).length) {
        logger.info(
          `🔄 [${name}] Re-rendered because these props changed:`,
          changedProps,
        );
      } else if (renderCount.current % 10 === 0) {
        // Log when no props changed but component still re-rendered
        logger.info(
          `🤔 [${name}] Re-rendered WITHOUT prop changes (render #${renderCount.current})`,
          {
            timestamp: new Date().toISOString(),
            stack: new Error().stack?.split('\n').slice(2, 5).join(' <- '),
          },
        );
      }
    }

    previousProps.current = props;
  });
}
