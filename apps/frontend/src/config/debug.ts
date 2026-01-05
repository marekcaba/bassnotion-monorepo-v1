/**
 * Debug Configuration
 *
 * Centralized control for verbose debug logging across the application.
 * This allows keeping diagnostic logs in the codebase without cluttering
 * the console during normal development.
 *
 * Usage:
 *   import { VERBOSE_DEBUG } from '@/config/debug';
 *   if (VERBOSE_DEBUG) console.log('🔍 [DEBUG] Verbose message...');
 *
 * To enable verbose logging:
 *   1. Add NEXT_PUBLIC_VERBOSE_DEBUG=true to .env.local
 *   2. Restart the development server
 *
 * Or toggle at runtime (browser console):
 *   window.__enableVerboseDebug(true)
 */

/**
 * Feature flag for verbose debug logging.
 * Default: false (clean console)
 * Enable: Set NEXT_PUBLIC_VERBOSE_DEBUG=true in .env.local
 */
export const VERBOSE_DEBUG =
  process.env.NEXT_PUBLIC_VERBOSE_DEBUG === 'true';

// Runtime toggle support for browser console debugging
if (typeof window !== 'undefined') {
  // Allow runtime toggle via window.__enableVerboseDebug(true/false)
  (window as any).__enableVerboseDebug = (enabled: boolean) => {
    (window as any).__VERBOSE_DEBUG_OVERRIDE = enabled;
    console.log(
      `🔧 Verbose debug ${enabled ? 'ENABLED' : 'DISABLED'} (runtime override)`
    );
    console.log('Note: This only affects code that uses isVerboseDebugEnabled()');
  };

  // Expose current state for debugging
  (window as any).__isVerboseDebugEnabled = () => isVerboseDebugEnabled();
}

/**
 * Check if verbose debug is enabled (supports runtime override).
 * Use this function for logs that should support runtime toggling.
 * For static checks at module load, use VERBOSE_DEBUG constant directly.
 */
export function isVerboseDebugEnabled(): boolean {
  if (typeof window !== 'undefined' && (window as any).__VERBOSE_DEBUG_OVERRIDE !== undefined) {
    return (window as any).__VERBOSE_DEBUG_OVERRIDE;
  }
  return VERBOSE_DEBUG;
}

/**
 * Conditional verbose log helper.
 * Only logs when verbose debug is enabled.
 *
 * @param args - Arguments to pass to console.log
 */
export function verboseLog(...args: unknown[]): void {
  if (isVerboseDebugEnabled()) {
    console.log(...args);
  }
}
