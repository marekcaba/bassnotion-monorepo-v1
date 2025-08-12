/**
 * Logging configuration for the playback domain
 * Controls log verbosity during initialization and runtime
 */

import { logger, LogLevel } from '../utils/logger';

// Environment-based configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
// Enable verbose logging with ?verbose=true in URL or NEXT_PUBLIC_VERBOSE_LOGGING env var
const isVerboseEnabled = typeof window !== 'undefined' 
  ? new URLSearchParams(window.location.search).has('verbose') || process.env.NEXT_PUBLIC_VERBOSE_LOGGING === 'true'
  : false;

/**
 * Configure logging for the application
 */
export function configureLogging() {
  // Set base log level
  if (isTest) {
    logger.setLevel(LogLevel.ERROR);
  } else if (isVerboseEnabled) {
    // Allow verbose logging when explicitly enabled
    logger.setLevel(LogLevel.VERBOSE);
  } else if (isDevelopment) {
    // Set to ERROR in development - only critical messages
    logger.setLevel(LogLevel.ERROR);
  } else {
    logger.setLevel(LogLevel.ERROR);
  }

  // Enable compact initialization in all environments
  logger.setCompactInitialization(true);

  // Don't log configuration - we want minimal output
}

/**
 * Temporarily set log level for a specific operation
 */
export function withLogLevel<T>(
  level: LogLevel,
  operation: () => T | Promise<T>
): T | Promise<T> {
  const originalLevel = logger.getLevel();
  logger.setLevel(level);

  try {
    const result = operation();
    
    // Handle async operations
    if (result instanceof Promise) {
      return result.finally(() => {
        logger.setLevel(originalLevel);
      });
    }
    
    logger.setLevel(originalLevel);
    return result;
  } catch (error) {
    logger.setLevel(originalLevel);
    throw error;
  }
}

/**
 * Run initialization with reduced logging
 */
export async function withQuietInitialization<T>(
  operation: () => Promise<T>
): Promise<T> {
  const originalLevel = logger.getLevel();
  
  // Set to WARN level during initialization
  logger.setLevel(LogLevel.WARN);
  logger.setCompactInitialization(true);

  try {
    const result = await operation();
    logger.setLevel(originalLevel);
    return result;
  } catch (error) {
    logger.setLevel(originalLevel);
    throw error;
  }
}

// Configure logging on module load
if (typeof window !== 'undefined') {
  configureLogging();
}