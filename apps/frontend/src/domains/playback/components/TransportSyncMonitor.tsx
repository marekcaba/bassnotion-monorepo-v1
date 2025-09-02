import React, { useEffect, useState, useCallback } from 'react';
import { TransportSyncManager } from '../services/core/TransportSyncManager';

/**
 * FAANG-style Monitoring Dashboard
 *
 * Provides real-time visibility into transport sync health
 */

interface SyncMetrics {
  totalHeartbeats: number;
  missedHeartbeats: number;
  reconnections: number;
  avgLatency: number;
  connectedClients: number;
  lastSyncTime: number;
}

interface ClientStatus {
  id: string;
  lastHeartbeat: number;
  missedHeartbeats: number;
  latency: number;
  connected: boolean;
}

export function TransportSyncMonitor() {
  const [metrics, setMetrics] = useState<SyncMetrics>({
    totalHeartbeats: 0,
    missedHeartbeats: 0,
    reconnections: 0,
    avgLatency: 0,
    connectedClients: 0,
    lastSyncTime: 0,
  });

  const [clients, setClients] = useState<ClientStatus[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const syncManager = TransportSyncManager.getInstance();

    // Update metrics every second
    const interval = setInterval(() => {
      const currentMetrics = syncManager.getMetrics();
      setMetrics(currentMetrics);

      // Get client statuses
      const clientList: ClientStatus[] = [];
      // This would need to be exposed by TransportSyncManager
      // For now, showing the pattern
      setClients(clientList);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getHealthStatus = useCallback(() => {
    const missRate =
      metrics.totalHeartbeats > 0
        ? (metrics.missedHeartbeats / metrics.totalHeartbeats) * 100
        : 0;

    if (missRate > 10) return { status: 'critical', color: '#ef4444' };
    if (missRate > 5) return { status: 'warning', color: '#f59e0b' };
    if (metrics.avgLatency > 100)
      return { status: 'warning', color: '#f59e0b' };
    return { status: 'healthy', color: '#10b981' };
  }, [metrics]);

  const health = getHealthStatus();

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-1 rounded-md text-xs font-mono opacity-50 hover:opacity-100 transition-opacity"
      >
        Sync Monitor
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-xl font-mono text-xs max-w-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold">Transport Sync Monitor</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>

      <div className="space-y-2">
        {/* Health Status */}
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: health.color }}
          />
          <span className="text-xs">Status: {health.status.toUpperCase()}</span>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-400">Connected:</span>
            <span className="ml-1">{metrics.connectedClients}</span>
          </div>
          <div>
            <span className="text-gray-400">Avg Latency:</span>
            <span className="ml-1">{metrics.avgLatency.toFixed(1)}ms</span>
          </div>
          <div>
            <span className="text-gray-400">Heartbeats:</span>
            <span className="ml-1">{metrics.totalHeartbeats}</span>
          </div>
          <div>
            <span className="text-gray-400">Missed:</span>
            <span className="ml-1 text-orange-400">
              {metrics.missedHeartbeats}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Reconnects:</span>
            <span className="ml-1">{metrics.reconnections}</span>
          </div>
          <div>
            <span className="text-gray-400">Last Sync:</span>
            <span className="ml-1">
              {metrics.lastSyncTime
                ? `${((Date.now() - metrics.lastSyncTime) / 1000).toFixed(1)}s ago`
                : 'Never'}
            </span>
          </div>
        </div>

        {/* Client List */}
        {clients.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <h4 className="text-xs font-semibold mb-1">Connected Widgets</h4>
            <div className="space-y-1">
              {clients.map((client) => (
                <div key={client.id} className="flex justify-between text-xs">
                  <span className="text-gray-400">{client.id}</span>
                  <span
                    className={
                      client.connected ? 'text-green-400' : 'text-red-400'
                    }
                  >
                    {client.latency}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance Warning */}
        {metrics.avgLatency > 100 && (
          <div className="mt-2 p-2 bg-orange-900/50 rounded text-xs text-orange-200">
            High latency detected. Check network conditions.
          </div>
        )}
      </div>
    </div>
  );
}
