import { logger, LogLevel } from './logger';
import { applyLoggingConfig } from '@/config/logging.config';

// Import logger to ensure it's initialized
import './logger';

/**
 * Initialize logger with environment-specific configuration
 */
export function initializeLogger() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  // Apply base configuration
  applyLoggingConfig(logger, isProduction ? 'production' : 'development');

  // Production-specific settings
  if (isProduction) {
    // Disable all verbose logging in production
    logger.disableCategories(
      'transport:timing',
      'transport:position',
      'transport:drift',
      'worklet',
      'worklet:timing',
      'audio:processor',
      'samples:detail',
      'service:init',
      'service:registry',
    );

    // Only show warnings and errors
    logger.setLevel(LogLevel.WARN);

    // Disable emojis in production
    logger.configure({
      useEmojis: false,
      showTimestamp: false,
    });
  } else {
    // Development settings - DRASTICALLY REDUCED LOGGING
    logger.configure({
      useEmojis: true,
      showTimestamp: false,
      useColors: true,
    });

    // Enable more categories for development debugging
    logger.enableCategories(
      'info',
      'warn',
      'error',
      'critical',
      'transport',
      'audio',
      'ui',
    );

    // Set to INFO level to see more logs in development
    logger.setLevel(LogLevel.INFO);
  }

  // Log initialization - Single line only!
  if (isDevelopment) {
    logger.info(
      '🎵 Bassicology initialized (quiet mode) - Use logger.setLevel(LogLevel.INFO) for more logs',
    );
  }
}

// Auto-initialize on import - only on client side
if (typeof window !== 'undefined') {
  initializeLogger();
}
