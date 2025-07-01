/**
 * Performance Dashboard Component
 * Real-time monitoring dashboard for Epic 3 performance metrics
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  MetricsCollector,
  CentralPerformanceMetrics,
  MetricsAlert,
} from './MetricsCollector';

interface PerformanceDashboardProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
  showAlerts?: boolean;
  compact?: boolean;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  autoRefresh = true,
  refreshInterval = 5000,
  showAlerts = true,
  compact = false,
}) => {
  const [metrics, setMetrics] = useState<CentralPerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<MetricsAlert[]>([]);
  const [isCollecting, setIsCollecting] = useState(false);
  const metricsCollectorRef = useRef<MetricsCollector | null>(null);

  useEffect(() => {
    metricsCollectorRef.current = MetricsCollector.getInstance();
    
    if (autoRefresh) {
      metricsCollectorRef.current.startCollection();
      setIsCollecting(true);
    }

    const fetchMetrics = async () => {
      if (metricsCollectorRef.current) {
        try {
          const currentMetrics = await metricsCollectorRef.current.collectMetrics();
          setMetrics(currentMetrics);
          
          if (showAlerts) {
            const recentAlerts = metricsCollectorRef.current.getRecentAlerts();
            setAlerts(recentAlerts);
          }
        } catch (error) {
          console.error('[PerformanceDashboard] Failed to collect metrics:', error);
        }
      }
    };

    // Initial fetch
    fetchMetrics();

    // Set up periodic updates if not auto-collecting
    let interval: NodeJS.Timeout | null = null;
    if (!autoRefresh) {
      interval = setInterval(fetchMetrics, refreshInterval);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
      if (metricsCollectorRef.current && isCollecting) {
        metricsCollectorRef.current.stopCollection();
      }
    };
  }, [autoRefresh, refreshInterval, showAlerts, isCollecting]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600 bg-green-100';
      case 'good':
        return 'text-blue-600 bg-blue-100';
      case 'fair':
        return 'text-yellow-600 bg-yellow-100';
      case 'poor':
        return 'text-orange-600 bg-orange-100';
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-50 text-red-800';
      case 'high':
        return 'border-orange-500 bg-orange-50 text-orange-800';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 text-yellow-800';
      case 'low':
        return 'border-blue-500 bg-blue-50 text-blue-800';
      default:
        return 'border-gray-500 bg-gray-50 text-gray-800';
    }
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === 'MB' || unit === 'ms') {
      return `${value.toFixed(1)}${unit}`;
    }
    if (unit === 'fps') {
      return `${Math.round(value)}${unit}`;
    }
    if (unit === '%') {
      return `${Math.round(value)}${unit}`;
    }
    return `${value}`;
  };

  if (!metrics) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-300 rounded"></div>
            <div className="h-3 bg-gray-300 rounded w-5/6"></div>
            <div className="h-3 bg-gray-300 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-white rounded-lg shadow p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Performance</h3>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
              metrics.overall.status,
            )}`}
          >
            {metrics.overall.performanceScore}/100
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">FPS:</span>
            <span className="ml-1 font-medium">
              {formatValue(metrics.rendering.fps, 'fps')}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Memory:</span>
            <span className="ml-1 font-medium">
              {formatValue(metrics.memory.heapUsed, 'MB')}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Latency:</span>
            <span className="ml-1 font-medium">
              {formatValue(metrics.audio.latency, 'ms')}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Cache:</span>
            <span className="ml-1 font-medium">
              {formatValue(metrics.bundle.cacheHitRate, '%')}
            </span>
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="pt-2 border-t">
            <div className="text-xs text-red-600 font-medium">
              {alerts.length} active alert{alerts.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Performance Dashboard
          </h2>
          <div className="flex items-center space-x-2">
            <div
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                metrics.overall.status,
              )}`}
            >
              {metrics.overall.status.toUpperCase()}
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {metrics.overall.performanceScore}/100
            </div>
          </div>
        </div>

        {metrics.overall.activeOptimizations.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Active Optimizations:
            </h4>
            <div className="flex flex-wrap gap-2">
              {metrics.overall.activeOptimizations.map((optimization, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {optimization}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Rendering Metrics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Rendering</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">FPS</span>
              <span className="text-sm font-medium">
                {formatValue(metrics.rendering.fps, 'fps')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Frame Time</span>
              <span className="text-sm font-medium">
                {formatValue(metrics.rendering.frameTime, 'ms')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Dropped Frames</span>
              <span className="text-sm font-medium">
                {metrics.rendering.droppedFrames}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Objects</span>
              <span className="text-sm font-medium">
                {metrics.rendering.objectCount}
              </span>
            </div>
          </div>
        </div>

        {/* Memory Metrics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Memory</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Heap Used</span>
              <span className="text-sm font-medium">
                {formatValue(metrics.memory.heapUsed, 'MB')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Heap Total</span>
              <span className="text-sm font-medium">
                {formatValue(metrics.memory.heapTotal, 'MB')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Components</span>
              <span className="text-sm font-medium">
                {metrics.memory.components}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Leaks Detected</span>
              <span
                className={`text-sm font-medium ${
                  metrics.memory.leaksDetected > 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}
              >
                {metrics.memory.leaksDetected}
              </span>
            </div>
          </div>
        </div>

        {/* Audio Metrics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Audio</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Latency</span>
              <span className="text-sm font-medium">
                {formatValue(metrics.audio.latency, 'ms')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Buffer Underruns</span>
              <span className="text-sm font-medium">
                {metrics.audio.bufferUnderruns}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Active Assets</span>
              <span className="text-sm font-medium">
                {metrics.audio.activeAssets}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">CPU Usage</span>
              <span className="text-sm font-medium">
                {formatValue(metrics.audio.cpuUsage, '%')}
              </span>
            </div>
          </div>
        </div>

        {/* Bundle Metrics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Bundle</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Size</span>
              <span className="text-sm font-medium">
                {formatValue(metrics.bundle.totalSize / (1024 * 1024), 'MB')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Loaded Chunks</span>
              <span className="text-sm font-medium">
                {metrics.bundle.loadedChunks}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Cache Hit Rate</span>
              <span className="text-sm font-medium">
                {formatValue(metrics.bundle.cacheHitRate, '%')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Failed Chunks</span>
              <span
                className={`text-sm font-medium ${
                  metrics.bundle.failedChunks > 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}
              >
                {metrics.bundle.failedChunks}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {showAlerts && alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Recent Alerts ({alerts.length})
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`border rounded-lg p-3 ${getAlertColor(alert.severity)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="text-xs font-medium uppercase tracking-wide">
                        {alert.severity}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        {alert.type}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{alert.message}</p>
                    <div className="mt-1 text-xs text-gray-600">
                      Value: {alert.value} | Threshold: {alert.threshold}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {new Date(metrics.timestamp).toLocaleString()}
        {autoRefresh && (
          <span className="ml-2">
            • Auto-refresh: {refreshInterval / 1000}s
          </span>
        )}
      </div>
    </div>
  );
}; 