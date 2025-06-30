/**
 * Device Detection Utilities for Mobile Audio Optimization
 *
 * Provides functions to detect device capabilities and optimize
 * audio settings for mobile devices.
 *
 * Part of Story 2.1: Core Audio Engine Foundation
 */

export interface DeviceCapabilities {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  supportsWebAudio: boolean;
  preferredSampleRate: number;
  preferredBufferSize: number;
  supportsAudioWorklet: boolean;
  estimatedLatency: number; // In milliseconds
  batteryOptimizationRecommended: boolean;
}

export interface MobileAudioConstraints {
  maxPolyphony: number; // Maximum simultaneous voices
  preferredLatency: number; // Target latency in ms
  enableEffects: boolean; // Whether to enable audio effects
  useCompression: boolean; // Whether to enable audio compression
  backgroundSuspend: boolean; // Suspend audio when app backgrounded
}

/**
 * Detect device capabilities and constraints
 */
export function detectDeviceCapabilities(): DeviceCapabilities {
  try {
    const userAgent = getUserAgentSafely();
    const isMobile =
      /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent,
      );
    const isIOS = /iphone|ipad|ipod/i.test(userAgent);
    const isAndroid = /android/i.test(userAgent);
    const isSafari =
      // TODO: Review non-null assertion - consider null safety
      /safari/i.test(userAgent) && !/chrome|chromium/i.test(userAgent);
    const isChrome = /chrome|chromium/i.test(userAgent);

    // Check Web Audio API support safely
    const supportsWebAudio = checkWebAudioSupport();

    // Check AudioWorklet support (for advanced audio processing)
    const supportsAudioWorklet = supportsWebAudio && checkAudioWorkletSupport();

    // Determine optimal settings based on device
    let preferredSampleRate = 44100;
    let preferredBufferSize = 128;
    let estimatedLatency = 20; // Default estimate

    if (isMobile) {
      if (isIOS) {
        // iOS-specific optimizations
        preferredSampleRate = 44100; // iOS prefers 44.1kHz
        preferredBufferSize = isOlderIOS() ? 512 : 256; // Older devices need larger buffers
        estimatedLatency = isOlderIOS() ? 40 : 25;
      } else if (isAndroid) {
        // Android-specific optimizations
        preferredSampleRate = 48000; // Android prefers 48kHz
        preferredBufferSize = isOlderAndroid() ? 512 : 256;
        estimatedLatency = isOlderAndroid() ? 45 : 30;
      }
    } else {
      // Desktop optimizations
      preferredSampleRate = 44100;
      preferredBufferSize = 128;
      estimatedLatency = 15;
    }

    // Create a completely clean object without any prototype pollution
    const cleanCapabilities = Object.create(null);
    cleanCapabilities.isMobile = isMobile;
    cleanCapabilities.isIOS = isIOS;
    cleanCapabilities.isAndroid = isAndroid;
    cleanCapabilities.isSafari = isSafari;
    cleanCapabilities.isChrome = isChrome;
    cleanCapabilities.supportsWebAudio = supportsWebAudio;
    cleanCapabilities.preferredSampleRate = preferredSampleRate;
    cleanCapabilities.preferredBufferSize = preferredBufferSize;
    cleanCapabilities.supportsAudioWorklet = supportsAudioWorklet;
    cleanCapabilities.estimatedLatency = estimatedLatency;
    cleanCapabilities.batteryOptimizationRecommended = isMobile;

    return cleanCapabilities as DeviceCapabilities;
  } catch (error) {
    // Return safe defaults in case of any error
    console.warn('Device detection failed, using defaults:', error);
    return createSafeDefaults();
  }
}

/**
 * Get mobile audio constraints based on device capabilities
 */
export function getMobileAudioConstraints(
  capabilities: DeviceCapabilities,
): MobileAudioConstraints {
  // Validate input to prevent errors with malformed capabilities
  if (!capabilities || typeof capabilities !== 'object') {
    capabilities = createSafeDefaults();
  }

  const isMobile = Boolean(capabilities.isMobile);

  // TODO: Review non-null assertion - consider null safety
  if (!isMobile) {
    // Desktop - no constraints
    return createCleanConstraints({
      maxPolyphony: 32,
      preferredLatency: 15,
      enableEffects: true,
      useCompression: false,
      backgroundSuspend: false,
    });
  }

  // Base mobile constraints
  let maxPolyphony = 16;
  let preferredLatency = 30;
  let enableEffects = true;
  const useCompression = true;

  const isIOS = Boolean(capabilities.isIOS);
  const isAndroid = Boolean(capabilities.isAndroid);

  if (isIOS) {
    if (isOlderIOS()) {
      // Older iOS devices (iPhone 7 and below, older iPads)
      maxPolyphony = 8;
      preferredLatency = 40;
      enableEffects = false;
    } else {
      // Modern iOS devices
      maxPolyphony = 16;
      preferredLatency = 25;
      enableEffects = true;
    }
  } else if (isAndroid) {
    if (isOlderAndroid()) {
      // Older Android devices
      maxPolyphony = 6;
      preferredLatency = 45;
      enableEffects = false;
    } else {
      // Modern Android devices
      maxPolyphony = 12;
      preferredLatency = 30;
      enableEffects = true;
    }
  }

  return createCleanConstraints({
    maxPolyphony,
    preferredLatency,
    enableEffects,
    useCompression,
    backgroundSuspend: true,
  });
}

/**
 * Check if device supports low-latency audio
 */
export function supportsLowLatencyAudio(): boolean {
  const capabilities = detectDeviceCapabilities();

  // Desktop generally supports low latency
  // TODO: Review non-null assertion - consider null safety
  if (!capabilities.isMobile) return true;

  // Modern iOS devices support low latency
  // TODO: Review non-null assertion - consider null safety
  if (capabilities.isIOS && !isOlderIOS()) return true;

  // Modern Android devices with Chrome support low latency
  // TODO: Review non-null assertion - consider null safety
  if (capabilities.isAndroid && capabilities.isChrome && !isOlderAndroid()) {
    return true;
  }

  return false;
}

/**
 * Get recommended audio context configuration
 */
export function getRecommendedAudioContextConfig(): AudioContextOptions {
  const capabilities = detectDeviceCapabilities();

  // Create a completely clean object without prototype chain
  const config = Object.create(null);
  config.sampleRate = capabilities.preferredSampleRate;
  config.latencyHint = capabilities.isMobile ? 'balanced' : 'interactive';

  // Return clean copy to ensure no pollution
  const cleanConfig = Object.create(null);
  cleanConfig.sampleRate = config.sampleRate;
  cleanConfig.latencyHint = config.latencyHint;

  return cleanConfig as AudioContextOptions;
}

/**
 * Check if device requires user gesture for audio
 */
export function requiresUserGesture(): boolean {
  const capabilities = detectDeviceCapabilities();

  // All mobile devices and Safari require user gesture
  return capabilities.isMobile || capabilities.isSafari;
}

/**
 * Estimate device performance tier
 */
export function getDevicePerformanceTier(): 'low' | 'medium' | 'high' {
  const capabilities = detectDeviceCapabilities();

  // TODO: Review non-null assertion - consider null safety
  if (!capabilities.isMobile) {
    return 'high'; // Assume desktop is high performance
  }

  if (capabilities.isIOS) {
    return isOlderIOS() ? 'low' : 'high';
  }

  if (capabilities.isAndroid) {
    return isOlderAndroid() ? 'low' : 'medium';
  }

  return 'medium';
}

/**
 * Check if current device is an older iOS device
 */
function isOlderIOS(): boolean {
  const userAgent = getUserAgentSafely();

  // Check for specific older iOS devices
  if (/iphone/i.test(userAgent)) {
    // iPhone 7 and below
    const iPhoneMatch = userAgent.match(/iphone os (\d+)/);
    if (iPhoneMatch && iPhoneMatch[1]) {
      const version = parseInt(iPhoneMatch[1]);
      return version < 13; // iOS 13+ generally indicates iPhone 8+
    }
  }

  if (/ipad/i.test(userAgent)) {
    // Older iPads
    const iPadMatch = userAgent.match(/os (\d+)/);
    if (iPadMatch && iPadMatch[1]) {
      const version = parseInt(iPadMatch[1]);
      return version < 13;
    }
  }

  return false;
}

/**
 * Check if current device is an older Android device
 */
function isOlderAndroid(): boolean {
  const userAgent = getUserAgentSafely();

  // Check Android version
  const androidMatch = userAgent.match(/android (\d+)/);
  if (androidMatch && androidMatch[1]) {
    const version = parseInt(androidMatch[1]);
    return version < 8; // Android 8+ generally has better audio support
  }

  return false;
}

/**
 * Get battery optimization recommendations
 */
export function getBatteryOptimizationRecommendations(): {
  suspendOnBackground: boolean;
  reducedPolyphony: boolean;
  disableEffects: boolean;
  lowerSampleRate: boolean;
} {
  const capabilities = detectDeviceCapabilities();

  // TODO: Review non-null assertion - consider null safety
  if (!capabilities.isMobile) {
    return {
      suspendOnBackground: false,
      reducedPolyphony: false,
      disableEffects: false,
      lowerSampleRate: false,
    };
  }

  // For mobile devices, check if it's a low-end device
  const isLowEndDevice = capabilities.isIOS ? isOlderIOS() : isOlderAndroid();

  return {
    suspendOnBackground: true,
    reducedPolyphony: isLowEndDevice,
    disableEffects: isLowEndDevice,
    lowerSampleRate: isLowEndDevice, // Recommend lower sample rate for low-end devices to save battery and improve performance
  };
}

/**
 * Security helper functions
 */
function getUserAgentSafely(): string {
  try {
    // TODO: Review non-null assertion - consider null safety
    if (typeof navigator === 'undefined' || !navigator.userAgent) {
      return '';
    }

    let userAgent = navigator.userAgent;

    // Sanitize malicious content while preserving platform detection
    userAgent = userAgent
      // TODO: Review non-null assertion - consider null safety
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/\beval\s*\(/gi, '') // Remove eval calls (word boundary to be more precise)
      .replace(/<[^>]*>/g, ''); // Remove any remaining HTML tags

    return userAgent.toLowerCase().substring(0, 500); // Limit length
  } catch {
    // Safely handle errors without exposing system information
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        'Device detection: Using safe defaults due to user agent access error',
      );
    }
    // Return safe defaults for any user agent access errors
    return 'SafeDefault/1.0';
  }
}

function checkWebAudioSupport(): boolean {
  try {
    // TODO: Review non-null assertion - consider null safety
    return !!(
      typeof window !== 'undefined' &&
      (window.AudioContext || (window as any).webkitAudioContext)
    );
  } catch {
    return false;
  }
}

function checkAudioWorkletSupport(): boolean {
  try {
    return (
      typeof AudioContext !== 'undefined' &&
      AudioContext.prototype &&
      'audioWorklet' in AudioContext.prototype
    );
  } catch {
    return false;
  }
}

function createSafeDefaults(): DeviceCapabilities {
  // Create clean object to prevent prototype pollution using Object.create(null)
  const defaults = Object.create(null);
  defaults.isMobile = false;
  defaults.isIOS = false;
  defaults.isAndroid = false;
  defaults.isSafari = false;
  defaults.isChrome = false;
  defaults.supportsWebAudio = false;
  defaults.preferredSampleRate = 44100;
  defaults.preferredBufferSize = 256;
  defaults.supportsAudioWorklet = false;
  defaults.estimatedLatency = 50;
  defaults.batteryOptimizationRecommended = false;
  return defaults as DeviceCapabilities;
}

function createCleanConstraints(
  constraints: MobileAudioConstraints,
): MobileAudioConstraints {
  // Create clean object to prevent prototype pollution using Object.create(null)
  const clean = Object.create(null);
  clean.maxPolyphony = Math.max(1, Math.min(64, constraints.maxPolyphony));
  clean.preferredLatency = Math.max(
    1,
    Math.min(1000, constraints.preferredLatency),
  );
  clean.enableEffects = Boolean(constraints.enableEffects);
  clean.useCompression = Boolean(constraints.useCompression);
  clean.backgroundSuspend = Boolean(constraints.backgroundSuspend);
  return clean as MobileAudioConstraints;
}
