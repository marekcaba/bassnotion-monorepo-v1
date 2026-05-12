/**
 * Debug utility to track console overrides
 */

// Store original console methods at the very beginning
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

// Track when console methods are overridden
let overrideCount = 0;
const overrideHistory: Array<{
  method: string;
  timestamp: number;
  stack: string;
}> = [];

// Create getter/setter traps for console methods
['log', 'warn', 'error', 'info', 'debug'].forEach((method) => {
  let currentValue = (console as any)[method];

  Object.defineProperty(console, method, {
    get() {
      return currentValue;
    },
    set(newValue) {
      overrideCount++;
      const stack = new Error().stack || 'No stack trace available';

      overrideHistory.push({
        method,
        timestamp: Date.now(),
        stack,
      });

      // Use the original console.log to report the override
      originalConsole.log(
        `🚨 Console.${method} was overridden! Override #${overrideCount}`,
      );
      originalConsole.log('Stack trace:', stack);

      currentValue = newValue;
    },
    configurable: true,
  });
});

// Export functions to check console state
export function getConsoleState() {
  return {
    overrideCount,
    overrideHistory,
    currentMethods: {
      log: console.log === originalConsole.log,
      warn: console.warn === originalConsole.warn,
      error: console.error === originalConsole.error,
      info: console.info === originalConsole.info,
      debug: console.debug === originalConsole.debug,
    },
  };
}

export function forceRestoreConsole() {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;

  originalConsole.log('✅ Console methods restored to original state');
}

// Log initial state
originalConsole.log('🔍 Console debug utility loaded');

// Make these available globally for debugging
if (typeof window !== 'undefined') {
  window.__debugConsole = {
    restore: forceRestoreConsole,
    original: originalConsole,
  };
}
