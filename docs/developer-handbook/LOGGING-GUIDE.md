# BassNotion Logging Guide

## Overview

BassNotion uses a centralized logging system that allows fine-grained control over console output. This is especially useful for reducing noise in production while maintaining detailed logs during development.

## Quick Start

### Adjusting Log Levels in Browser Console

```javascript
// Set overall log level
logger.setLevel(LogLevel.WARN); // Only warnings and errors
logger.setLevel(LogLevel.INFO); // Normal operation (default)
logger.setLevel(LogLevel.DEBUG); // Detailed debugging
logger.setLevel(LogLevel.VERBOSE); // Everything including timing

// Disable noisy categories
logger.disableCategories(
  'timing',
  'drift',
  'transport:position',
  'worklet:timing',
);

// Enable specific categories for debugging
logger.enableCategories('transport', 'audio');

// Disable all timing-related logs
logger.disableCategories(
  'timing',
  'transport:timing',
  'worklet:timing',
  'transport:position',
);

// Production mode - minimal logging
logger.setLevel(LogLevel.ERROR);
logger.disableCategories('*');
logger.enableCategories('audio', 'transport');
```

## Log Categories

### Core Services

- `service` - General service operations
- `service:init` - Service initialization
- `service:registry` - Service registry operations
- `core` - Core services coordination

### Transport & Timing

- `transport` - Transport operations (play, pause, stop)
- `transport:timing` - High-frequency timing updates
- `transport:drift` - Drift compensation
- `transport:position` - Position updates
- `timing` - General timing operations

### Audio System

- `audio` - General audio operations
- `audio:engine` - Audio engine operations
- `audio:processor` - Instrument processors
- `audio:event` - Audio event routing

### Worklet

- `worklet` - AudioWorklet operations
- `worklet:timing` - AudioWorklet timing updates (very verbose)

### UI Components

- `ui` - General UI operations
- `ui:controls` - Control interactions
- `ui:widget` - Widget operations

### Other

- `samples` - Sample loading
- `samples:detail` - Detailed sample loading
- `pattern` - Pattern operations
- `pattern:scheduler` - Pattern scheduling
- `exercise` - Exercise loading
- `performance` - Performance metrics
- `network` - Network operations
- `storage` - Storage operations

## Presets

### Debug Timing Issues

```javascript
// Enable all timing-related logs
logger.setLevel(LogLevel.VERBOSE);
logger.enableCategories(
  'transport',
  'transport:timing',
  'transport:drift',
  'worklet',
  'worklet:timing',
);
```

### Debug Audio Issues

```javascript
// Enable audio-related logs
logger.setLevel(LogLevel.DEBUG);
logger.enableCategories(
  'audio',
  'audio:engine',
  'audio:processor',
  'audio:event',
  'samples',
);
```

### Quiet Mode

```javascript
// Minimal logging
logger.setLevel(LogLevel.ERROR);
logger.disableCategories('*');
```

### Production Mode

```javascript
// Balanced production logging
logger.setLevel(LogLevel.WARN);
logger.disableCategories(
  'timing',
  'transport:timing',
  'transport:position',
  'worklet',
  'service:init',
  'samples:detail',
);
```

## Environment Variables

The logger automatically configures itself based on the environment:

- **Development**: `LogLevel.INFO` with most categories enabled
- **Production**: `LogLevel.WARN` with verbose categories disabled

## Advanced Configuration

### Persistent Settings

Logger settings are saved to localStorage and persist across sessions:

```javascript
// View current configuration
logger.getConfig();

// Configure display options
logger.configure({
  useEmojis: false, // Disable emojis
  showTimestamp: true, // Show timestamps
  useColors: false, // Disable colors
});
```

### Category-Specific Control

```javascript
// Enable all categories
logger.enableCategories('*');

// Enable specific categories only
logger.disableCategories('*');
logger.enableCategories('transport', 'audio', 'ui');

// Check if a category is enabled
logger.getConfig().enabledCategories; // Set of enabled categories
logger.getConfig().disabledCategories; // Set of disabled categories
```

## Troubleshooting

### Too Much Console Output

1. Disable timing logs:

   ```javascript
   logger.disableCategories(
     'timing',
     'transport:timing',
     'transport:position',
     'worklet:timing',
   );
   ```

2. Set higher log level:
   ```javascript
   logger.setLevel(LogLevel.WARN);
   ```

### Not Seeing Expected Logs

1. Check log level:

   ```javascript
   logger.getConfig().level; // Current level
   ```

2. Enable specific category:
   ```javascript
   logger.enableCategories('transport', 'audio');
   ```

### Reset to Defaults

```javascript
// Clear localStorage and reload
localStorage.removeItem('bassnotion:logger:config');
location.reload();
```
