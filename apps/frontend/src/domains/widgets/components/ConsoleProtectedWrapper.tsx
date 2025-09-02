'use client';

import { useEffect, ReactNode } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// Capture console methods before any other code runs
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

interface ConsoleProtectedWrapperProps {
  children: ReactNode;
  enableLogs?: boolean;
}

export function ConsoleProtectedWrapper({
  children,
  enableLogs = true,
}: ConsoleProtectedWrapperProps) {
  const { correlationId, logger } = useCorrelation('ConsoleProtectedWrapper');
  useEffect(() => {
    if (!enableLogs) return;

    // Restore console methods on mount
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;

    logger.info('✅ Console methods protected and restored');

    // Check periodically if console is overridden
    const interval = setInterval(() => {
      if (console.log !== originalConsole.log) {
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
        console.info = originalConsole.info;
        console.debug = originalConsole.debug;
        originalConsole.log('🔧 Console was overridden - restored it!');
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [enableLogs]);

  return <>{children}</>;
}
