/**
 * Silence all console output except for our specific messages
 */

const allowedMessages = [
  '✅ Tone.JS initialized',
  '✅ Widgets loaded',
  '🎚️', // Allow DAW-related logs
  '🎵', // Allow music-related logs
  '🚀', // Allow PreloadInitializer logs
  '🎹', // Allow PreloadStrategy piano logs
  '[AudioContextManager]', // Allow AudioContextManager logs
  'ToneProvider:', // Allow ToneProvider logs
  'PreloadInitializer:', // Allow preload logs
  'PreloadStrategy:', // Allow preload strategy logs
];

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

let isSilenced = false;

export function silenceConsole() {
  if (isSilenced) return;
  isSilenced = true;
  
  // Override console methods
  console.log = (...args: any[]) => {
    const message = args.join(' ');
    if (allowedMessages.some(allowed => message.includes(allowed))) {
      originalConsole.log(...args);
    }
  };

  console.warn = () => {};
  console.info = () => {};
  console.debug = () => {};
}

export function restoreConsole() {
  if (!isSilenced) return;
  isSilenced = false;
  
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
  
  console.log('🔊 Console output restored for testing');
}