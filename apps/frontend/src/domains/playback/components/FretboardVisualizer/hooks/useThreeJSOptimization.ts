'use client';

import { useEffect, useRef, useCallback } from 'react';
import { PerformanceSettings } from '../types/fretboard';

// Performance settings based on device type
const PERFORMANCE_SETTINGS: PerformanceSettings = {
  targetFPS: 60,
  maxNotes: 50,
  lodLevels: {
    desktop: 3, // High quality
    tablet: 2, // Medium quality
    mobile: 1, // Low quality
  },
};

// Detect device type
function getDeviceType(): 'desktop' | 'tablet' | 'mobile' {
  if (typeof window === 'undefined') return 'desktop';

  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export function useThreeJSOptimization() {
  const frameTimeRef = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(0);
  const deviceType = getDeviceType();

  // Calculate current FPS
  const calculateFPS = useCallback(() => {
    const now = performance.now();
    const delta = now - lastFrameTime.current;
    lastFrameTime.current = now;

    // Keep last 10 frame times for averaging
    frameTimeRef.current.push(delta);
    if (frameTimeRef.current.length > 10) {
      frameTimeRef.current.shift();
    }

    const avgFrameTime =
      frameTimeRef.current.reduce((a, b) => a + b, 0) /
      frameTimeRef.current.length;
    const fps = 1000 / avgFrameTime;

    return { fps, frameTime: avgFrameTime };
  }, []);

  // Get performance settings for current device
  const getPerformanceSettings = useCallback(() => {
    return {
      ...PERFORMANCE_SETTINGS,
      lodLevel: PERFORMANCE_SETTINGS.lodLevels[deviceType],
    };
  }, [deviceType]);

  // Optimize geometry based on device
  const getOptimizedGeometrySettings = useCallback(() => {
    const settings = getPerformanceSettings();

    switch (settings.lodLevel) {
      case 1: // Mobile - low quality
        return {
          sphereSegments: 8,
          cylinderSegments: 6,
          enableShadows: false,
          enableReflections: false,
        };
      case 2: // Tablet - medium quality
        return {
          sphereSegments: 12,
          cylinderSegments: 8,
          enableShadows: true,
          enableReflections: false,
        };
      case 3: // Desktop - high quality
      default:
        return {
          sphereSegments: 16,
          cylinderSegments: 12,
          enableShadows: true,
          enableReflections: true,
        };
    }
  }, [getPerformanceSettings]);

  // Monitor performance and adjust settings
  const monitorPerformance = useCallback(
    (onPerformanceUpdate?: (fps: number, frameTime: number) => void) => {
      const { fps, frameTime } = calculateFPS();

      if (onPerformanceUpdate) {
        onPerformanceUpdate(fps, frameTime);
      }

      // Auto-adjust quality if FPS drops below target
      if (fps < PERFORMANCE_SETTINGS.targetFPS * 0.8) {
        console.warn(
          `FPS dropped to ${fps.toFixed(1)}, consider reducing quality`,
        );
      }

      return { fps, frameTime };
    },
    [calculateFPS],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      frameTimeRef.current = [];
    };
  }, []);

  return {
    deviceType,
    getPerformanceSettings,
    performanceSettings: getPerformanceSettings(),
    getOptimizedGeometrySettings,
    monitorPerformance,
    calculateFPS,
  };
}
