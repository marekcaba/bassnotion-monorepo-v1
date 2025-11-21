'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/shared/api/client';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: { status: string; responseTime?: number; error?: string };
    api: { status: string; responseTime?: number; error?: string };
    supabase: { status: string; responseTime?: number; error?: string };
  };
  version?: string;
}

export function HealthStatus() {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const { correlationId, logger } = useCorrelation('HealthStatus');

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      logger.info('Checking system health');
      const result = await apiClient.get<HealthCheck>('/api/health', {
        correlationId,
      });
      setHealth(result);
      logger.info('Health check completed', { status: result.status });
    } catch (error) {
      logger.error('Health check failed', error as Error);
      setHealth({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'unhealthy', error: 'Failed to connect' },
          api: { status: 'unhealthy', error: 'Failed to connect' },
          supabase: { status: 'unhealthy', error: 'Failed to connect' },
        },
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // OPTIMIZATION: Prevent multiple intervals in React Strict Mode
    // Strict Mode mounts twice in dev, causing duplicate intervals
    let mounted = true;
    let interval: NodeJS.Timeout | null = null;

    const initializeHealthCheck = async () => {
      if (!mounted) return;

      // Initial health check
      await checkHealth();

      // Start polling interval (only if still mounted)
      if (mounted) {
        // OPTIMIZATION: Increased from 30s to 2 minutes to reduce unnecessary API calls
        interval = setInterval(() => {
          if (mounted) checkHealth();
        }, 120000); // Check every 2 minutes
      }
    };

    initializeHealthCheck();

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once per mount

  if (!health) return null;

  const statusColor = {
    healthy: '#10b981',
    degraded: '#f59e0b',
    unhealthy: '#ef4444',
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 70,
        left: 20,
        padding: '8px 12px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: statusColor[health.status],
        fontSize: '12px',
        fontFamily: 'monospace',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        zIndex: 9998,
      }}
      onClick={checkHealth}
      title={`Last checked: ${new Date(health.timestamp).toLocaleTimeString()}\nClick to refresh`}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: statusColor[health.status],
          animation: isChecking ? 'pulse 1s infinite' : undefined,
        }}
      />
      <span>System: {health.status}</span>
      {health.version && <span>v{health.version}</span>}

      <style jsx>{`
        @keyframes pulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
