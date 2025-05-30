'use client';

import { useEffect, useRef, useCallback } from 'react';
import { authService } from '../api/auth';
import { useAuth } from './use-auth';

interface UseIdleTimeoutOptions {
  /** Timeout in milliseconds (default: 30 minutes) */
  timeout?: number;
  /** Events to listen for user activity */
  events?: string[];
  /** Whether idle timeout is enabled */
  enabled?: boolean;
  /** Callback when user becomes idle */
  onIdle?: () => void;
  /** Warning time before logout (in milliseconds) */
  warningTime?: number;
  /** Callback for warning */
  onWarning?: () => void;
}

export function useIdleTimeout(options: UseIdleTimeoutOptions = {}) {
  const {
    timeout = 30 * 60 * 1000, // 30 minutes
    events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ],
    enabled = true,
    onIdle,
    warningTime = 5 * 60 * 1000, // 5 minutes warning
    onWarning,
  } = options;

  const { reset } = useAuth();
  const idleTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const warningTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastActivity = useRef<number>(Date.now());

  const handleLogout = useCallback(async () => {
    try {
      await authService.signOut();
      reset();
      onIdle?.();
    } catch (error) {
      console.error('Error during idle logout:', error);
      // Force reset even if logout fails
      reset();
      onIdle?.();
    }
  }, [reset, onIdle]);

  const handleWarning = useCallback(() => {
    onWarning?.();
  }, [onWarning]);

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    lastActivity.current = Date.now();

    // Clear existing timers
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
    }
    if (warningTimer.current) {
      clearTimeout(warningTimer.current);
    }

    // Set warning timer
    if (warningTime > 0 && warningTime < timeout) {
      warningTimer.current = setTimeout(handleWarning, timeout - warningTime);
    }

    // Set idle timer
    idleTimer.current = setTimeout(handleLogout, timeout);
  }, [enabled, timeout, warningTime, handleLogout, handleWarning]);

  const resetIdleTimer = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!enabled) {
      // Clear timers if disabled
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
      }
      if (warningTimer.current) {
        clearTimeout(warningTimer.current);
      }
      return;
    }

    // Start the timer
    resetTimer();

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, resetIdleTimer, true);
    });

    return () => {
      // Cleanup
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
      }
      if (warningTimer.current) {
        clearTimeout(warningTimer.current);
      }

      events.forEach((event) => {
        document.removeEventListener(event, resetIdleTimer, true);
      });
    };
  }, [enabled, events, resetIdleTimer, resetTimer]);

  return {
    resetIdleTimer,
    getLastActivity: () => lastActivity.current,
    getRemainingTime: () => {
      const elapsed = Date.now() - lastActivity.current;
      return Math.max(0, timeout - elapsed);
    },
  };
}
