import { LogLevel } from '@/utils/logger';

/**
 * Logging configuration for different environments
 */

export const loggingConfig = {
  // Development settings
  development: {
    level: LogLevel.DEBUG,
    categories: {
      // Core services - Less verbose in dev
      service: LogLevel.INFO,
      'service:init': LogLevel.WARN,
      'service:registry': LogLevel.WARN,

      // Transport and timing - Critical for debugging
      transport: LogLevel.INFO,
      'transport:timing': LogLevel.WARN,
      'transport:drift': LogLevel.WARN,
      'transport:position': LogLevel.WARN,

      // Audio processing
      audio: LogLevel.INFO,
      'audio:engine': LogLevel.INFO,
      'audio:processor': LogLevel.WARN,
      'audio:event': LogLevel.WARN,

      // Worklet - Very verbose, limit in dev
      worklet: LogLevel.WARN,
      'worklet:timing': LogLevel.ERROR,

      // UI Components
      ui: LogLevel.INFO,
      'ui:widget': LogLevel.INFO,
      'ui:controls': LogLevel.INFO,

      // Sample loading
      samples: LogLevel.INFO,
      'samples:detail': LogLevel.WARN,

      // Pattern scheduling
      pattern: LogLevel.INFO,
      'pattern:scheduler': LogLevel.WARN,

      // Exercise loading
      exercise: LogLevel.INFO,

      // General
      performance: LogLevel.WARN,
      network: LogLevel.INFO,
      storage: LogLevel.INFO,
    },
  },

  // Production settings
  production: {
    level: LogLevel.WARN,
    categories: {
      // Only errors and critical warnings in production
      service: LogLevel.ERROR,
      transport: LogLevel.ERROR,
      audio: LogLevel.ERROR,
      worklet: LogLevel.NONE,
      ui: LogLevel.WARN,
      samples: LogLevel.ERROR,
      pattern: LogLevel.ERROR,
      exercise: LogLevel.WARN,
      performance: LogLevel.WARN,
      network: LogLevel.WARN,
      storage: LogLevel.WARN,
    },
  },

  // Debug presets for specific scenarios
  presets: {
    // Timing issues
    'debug-timing': {
      transport: LogLevel.VERBOSE,
      'transport:timing': LogLevel.VERBOSE,
      'transport:drift': LogLevel.DEBUG,
      worklet: LogLevel.DEBUG,
      'worklet:timing': LogLevel.VERBOSE,
    },

    // Audio issues
    'debug-audio': {
      audio: LogLevel.VERBOSE,
      'audio:engine': LogLevel.DEBUG,
      'audio:processor': LogLevel.DEBUG,
      'audio:event': LogLevel.VERBOSE,
      samples: LogLevel.DEBUG,
    },

    // Performance profiling
    'debug-performance': {
      performance: LogLevel.VERBOSE,
      'transport:timing': LogLevel.INFO,
      worklet: LogLevel.INFO,
    },

    // Quiet mode - minimal logging
    quiet: {
      '*': LogLevel.ERROR,
    },
  },
};

// Helper to apply configuration
export function applyLoggingConfig(
  logger: any,
  env: 'development' | 'production' = 'development',
) {
  const config = loggingConfig[env];

  // Set base level
  logger.setLevel(config.level);

  // Apply category-specific levels
  Object.entries(config.categories).forEach(([category, level]) => {
    if (level === LogLevel.NONE) {
      logger.disableCategories(category);
    } else {
      // This would need a method to set category-specific levels
      // For now, we enable/disable based on threshold
      if (level > config.level) {
        logger.disableCategories(category);
      }
    }
  });
}

// Helper to apply debug preset
export function applyDebugPreset(
  logger: any,
  preset: keyof typeof loggingConfig.presets,
) {
  const presetConfig = loggingConfig.presets[preset];
  if (!presetConfig) {
    logger.warn(`Unknown debug preset: ${preset}`);
    return;
  }

  // Enable verbose logging for the preset categories
  Object.entries(presetConfig).forEach(([category, level]) => {
    logger.enableCategories(category);
    // Would need category-specific level setting
  });

  logger.info(`🐛 Applied debug preset: ${preset}`);
}
