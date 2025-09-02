// Quick script to reduce console noise in development
// Run this in the browser console

// Option 1: Production-like logging (minimal)
logger.setLevel(LogLevel.WARN);
logger.disableCategories('*');
logger.enableCategories('audio', 'transport', 'error');

// Option 2: Development logging (balanced)
// logger.setLevel(LogLevel.INFO);
// logger.disableCategories('timing', 'transport:timing', 'transport:position', 'worklet:timing', 'transport:drift', 'useTrack', 'useTransport');

// Option 3: Quiet specific noisy components
// logger.disableCategories('useTrack', 'useTransport', 'GlobalControls', 'useWidgetSync', 'HarmonyWidgetV2');

console.log('✅ Logger configured for reduced verbosity');
console.log('Current settings:', logger.getConfig());
EOF < /dev/null