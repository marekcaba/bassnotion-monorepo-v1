import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  correlationId: string;
  userId?: string;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

interface LogTrace {
  correlationId: string;
  startTime: string;
  endTime: string;
  totalDuration: number;
  serviceCount: number;
  services: string[];
  timeline: Array<{
    timestamp: string;
    service: string;
    level: string;
    message: string;
    duration: number;
  }>;
  logs: LogEntry[];
}

export function LogViewer() {
  const { correlationId: currentCorrelationId, logger } =
    useCorrelation('LogViewer');
  const [searchCorrelationId, setSearchCorrelationId] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['logs', 'trace', activeSearch],
    queryFn: async () => {
      if (!activeSearch) return null;

      logger.info('Searching logs', {
        searchCorrelationId: activeSearch,
        correlationId: currentCorrelationId,
      });

      const response = await apiClient.get(
        `/api/v1/logs/trace?correlationId=${activeSearch}`,
        {
          correlationId: currentCorrelationId,
        },
      );

      return response.data.data as LogTrace;
    },
    enabled: !!activeSearch,
  });

  const handleSearch = () => {
    if (searchCorrelationId.trim()) {
      setActiveSearch(searchCorrelationId.trim());
    }
  };

  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return 'destructive';
      case 'WARN':
        return 'warning';
      case 'INFO':
        return 'default';
      case 'DEBUG':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Log Viewer</CardTitle>
        <div className="flex gap-2 mt-4">
          <Input
            placeholder="Enter correlation ID..."
            value={searchCorrelationId}
            onChange={(e) => setSearchCorrelationId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button
            onClick={handleSearch}
            disabled={!searchCorrelationId.trim() || isLoading}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : 'Search'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setSearchCorrelationId(currentCorrelationId)}
          >
            Use Current
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              Error loading logs: {(error as Error).message}
            </AlertDescription>
          </Alert>
        )}

        {data && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium">
                  {formatDuration(data.totalDuration)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Services</p>
                <p className="font-medium">{data.serviceCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Log Entries</p>
                <p className="font-medium">{data.logs.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Correlation ID</p>
                <p className="font-mono text-xs truncate">
                  {data.correlationId}
                </p>
              </div>
            </div>

            {/* Services involved */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Services Involved
              </p>
              <div className="flex flex-wrap gap-2">
                {data.services.map((service) => (
                  <Badge key={service} variant="outline">
                    {service}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Request Timeline
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {data.timeline.map((event, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <Badge
                      variant={getLevelColor(event.level)}
                      className="mt-0.5"
                    >
                      {event.level}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {event.service}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          +{formatDuration(event.duration)}
                        </span>
                      </div>
                      <p className="text-sm break-words">{event.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(event.timestamp).toLocaleTimeString('en-US', {
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          fractionalSecondDigits: 3,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detailed logs */}
            <details className="cursor-pointer">
              <summary className="text-sm font-medium">
                View Detailed Logs ({data.logs.length} entries)
              </summary>
              <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                {data.logs.map((log, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg bg-muted/30 font-mono text-xs"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant={getLevelColor(log.level)}
                        className="text-xs"
                      >
                        {log.level}
                      </Badge>
                      <span className="text-muted-foreground">
                        {log.service}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(log.timestamp).toISOString()}
                      </span>
                    </div>
                    <p className="mb-2">{log.message}</p>
                    {log.data && (
                      <details>
                        <summary className="cursor-pointer text-muted-foreground">
                          Data
                        </summary>
                        <pre className="mt-2 overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </details>
                    )}
                    {log.error && (
                      <details>
                        <summary className="cursor-pointer text-destructive">
                          Error
                        </summary>
                        <pre className="mt-2 overflow-x-auto text-destructive">
                          {JSON.stringify(log.error, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        {!data && !isLoading && activeSearch && (
          <Alert>
            <AlertDescription>
              No logs found for correlation ID: {activeSearch}
            </AlertDescription>
          </Alert>
        )}

        {!activeSearch && (
          <Alert>
            <AlertDescription>
              Enter a correlation ID to search for logs
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
