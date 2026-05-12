/**
 * Performance Monitor Component
 *
 * Real-time performance monitoring for development
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useServiceWorker } from '../hooks/useServiceWorker';
import { OptimizedToneLoader } from '@/domains/playback/modules/audio-engine/core/OptimizedToneLoader';

interface PerformanceMetrics {
  fps: number;
  memory: {
    used: number;
    limit: number;
    percentage: number;
  };
  bundleSize: {
    loaded: number;
    total: number;
    percentage: number;
  };
  cache: {
    samples: number;
    static: number;
    total: number;
  };
}

export function PerformanceMonitor() {
  const { cacheSize } = useServiceWorker();
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    memory: { used: 0, limit: 0, percentage: 0 },
    bundleSize: { loaded: 0, total: 0, percentage: 0 },
    cache: { samples: 0, static: 0, total: 0 },
  });
  const [isMinimized, setIsMinimized] = useState(true);

  // FPS monitoring
  useEffect(() => {
    let lastTime = performance.now();
    let frames = 0;
    let animationId: number;

    const measureFPS = () => {
      frames++;
      const currentTime = performance.now();

      if (currentTime >= lastTime + 1000) {
        const fps = Math.round((frames * 1000) / (currentTime - lastTime));
        frames = 0;
        lastTime = currentTime;

        setMetrics((prev) => ({ ...prev, fps }));
      }

      animationId = requestAnimationFrame(measureFPS);
    };

    animationId = requestAnimationFrame(measureFPS);

    return () => cancelAnimationFrame(animationId);
  }, []);

  // Memory monitoring
  useEffect(() => {
    if (!('memory' in performance)) return;

    const updateMemory = () => {
      const memory = window.performance.memory;
      if (!memory) return;
      const used = memory.usedJSHeapSize;
      const limit = memory.jsHeapSizeLimit;
      const percentage = Math.round((used / limit) * 100);

      setMetrics((prev) => ({
        ...prev,
        memory: {
          used: Math.round(used / 1048576), // Convert to MB
          limit: Math.round(limit / 1048576),
          percentage,
        },
      }));
    };

    updateMemory();
    const interval = setInterval(updateMemory, 2000);

    return () => clearInterval(interval);
  }, []);

  // Bundle size monitoring
  useEffect(() => {
    const updateBundleStats = () => {
      const loader = OptimizedToneLoader.getInstance();
      const stats = loader.getBundleStats();

      setMetrics((prev) => ({
        ...prev,
        bundleSize: stats,
      }));
    };

    updateBundleStats();
    const interval = setInterval(updateBundleStats, 5000);

    return () => clearInterval(interval);
  }, []);

  // Cache monitoring
  useEffect(() => {
    setMetrics((prev) => ({
      ...prev,
      cache: {
        samples: cacheSize.sampleCount,
        static: cacheSize.staticCount,
        total: cacheSize.totalCount,
      },
    }));
  }, [cacheSize]);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: isMinimized ? '8px 12px' : '12px',
        borderRadius: 8,
        fontSize: 12,
        fontFamily: 'monospace',
        zIndex: 9999,
        minWidth: isMinimized ? 'auto' : 280,
        cursor: isMinimized ? 'pointer' : 'default',
      }}
      onClick={() => isMinimized && setIsMinimized(false)}
    >
      {isMinimized ? (
        <div style={{ display: 'flex', gap: 12 }}>
          <span>FPS: {metrics.fps}</span>
          <span>Mem: {metrics.memory.percentage}%</span>
          <span>📊</span>
        </div>
      ) : (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 8,
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
              paddingBottom: 8,
            }}
          >
            <span style={{ fontWeight: 'bold' }}>Performance Monitor</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(true);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '0 4px',
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <div>
              <strong>FPS:</strong> {metrics.fps}
              <span
                style={{
                  marginLeft: 8,
                  color:
                    metrics.fps >= 50
                      ? '#4ade80'
                      : metrics.fps >= 30
                        ? '#facc15'
                        : '#ef4444',
                }}
              >
                {metrics.fps >= 50 ? '✓' : '⚠'}
              </span>
            </div>

            <div>
              <strong>Memory:</strong> {metrics.memory.used}MB /{' '}
              {metrics.memory.limit}MB ({metrics.memory.percentage}%)
              <div
                style={{
                  height: 4,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: 2,
                  marginTop: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${metrics.memory.percentage}%`,
                    backgroundColor:
                      metrics.memory.percentage > 90
                        ? '#ef4444'
                        : metrics.memory.percentage > 70
                          ? '#facc15'
                          : '#4ade80',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>

            <div>
              <strong>Tone.js Modules:</strong> {metrics.bundleSize.loaded}/
              {metrics.bundleSize.total} ({metrics.bundleSize.percentage}%)
              <div
                style={{
                  height: 4,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: 2,
                  marginTop: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${metrics.bundleSize.percentage}%`,
                    backgroundColor: '#4ade80',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>

            <div>
              <strong>Cache:</strong>
              <div style={{ marginLeft: 8, fontSize: 11 }}>
                Samples: {metrics.cache.samples} | Static:{' '}
                {metrics.cache.static}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
