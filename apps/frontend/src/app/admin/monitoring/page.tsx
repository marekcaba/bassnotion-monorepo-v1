'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Progress } from '@/shared/components/ui/progress';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Server,
  Zap,
} from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/utils/cn';
import { MetricsChart } from './components/MetricsChart';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    api: 'up' | 'down';
    database: 'up' | 'down';
    cache?: 'up' | 'down';
  };
}

interface DetailedHealthStatus extends HealthStatus {
  uptime: number;
  requestCount?: number;
  errorRate?: number;
  responseTime?: number;
  system: {
    cpu: {
      usage: number;
      count: number;
    };
    memory: {
      total: number;
      used: number;
      free: number;
      percentage: number;
    };
    load: number[];
  };
  process?: {
    pid: number;
    memory: any;
    uptime: number;
  };
  checks?: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
    };
    api: {
      status: 'healthy' | 'unhealthy';
    };
    supabase: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
    };
  };
}

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  averageResponseTime: number;
  requestCount: number;
  errorRate: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
}

export default function MonitoringDashboard() {
  const [healthData, setHealthData] = useState<DetailedHealthStatus | null>(
    null,
  );
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Historical metrics for charts
  const [cpuHistory, setCpuHistory] = useState<
    Array<{ timestamp: number; value: number }>
  >([]);
  const [memoryHistory, setMemoryHistory] = useState<
    Array<{ timestamp: number; value: number }>
  >([]);
  const [responseTimeHistory, setResponseTimeHistory] = useState<
    Array<{ timestamp: number; value: number }>
  >([]);
  const [errorRateHistory, setErrorRateHistory] = useState<
    Array<{ timestamp: number; value: number }>
  >([]);

  const fetchHealthData = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/health/detailed`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Ensure backward compatibility by mapping old format
      const mappedData: DetailedHealthStatus = {
        ...data,
        services: {
          api: data.checks?.api?.status === 'healthy' ? 'up' : 'down',
          database: data.checks?.database?.status === 'healthy' ? 'up' : 'down',
          cache: data.checks?.cache?.status === 'healthy' ? 'up' : 'down',
        },
        responseTime: data.responseTime || 0,
        errorRate: data.errorRate || 0,
        requestCount: data.requestCount || 0,
      };

      setHealthData(mappedData);
      setLastUpdate(new Date());
      setError(null);

      // Update historical data
      const timestamp = Date.now();
      setCpuHistory((prev) =>
        [...prev, { timestamp, value: mappedData.system.cpu.usage }].slice(-50),
      );
      setMemoryHistory((prev) =>
        [
          ...prev,
          { timestamp, value: mappedData.system.memory.percentage },
        ].slice(-50),
      );
      setResponseTimeHistory((prev) =>
        [...prev, { timestamp, value: mappedData.responseTime || 0 }].slice(
          -50,
        ),
      );
      setErrorRateHistory((prev) =>
        [...prev, { timestamp, value: mappedData.errorRate || 0 }].slice(-50),
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch health data';
      setError(
        `Unable to connect to backend API. Please ensure the backend is running on port 3000. Error: ${errorMessage}`,
      );
      logger.error('Health fetch error:', err);
    }
  };

  const fetchPerformanceData = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/health/metrics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setPerformanceData(data.endpoints || []);
    } catch (err) {
      logger.error('Performance fetch error:', err);
      // Don't set a separate error for performance data, as the main error is more important
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([fetchHealthData(), fetchPerformanceData()]);
      setIsLoading(false);
    };

    fetchData();

    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
      case 'down':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin" />;
    }
  };

  // NOTE: getStatusColor helper used to live here — replaced by inline
  // Tailwind classes on the Badge components.

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (isLoading && !healthData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">System Monitoring</h1>
            <p className="text-gray-600">
              Real-time system health and performance metrics
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="rounded-md border px-3 py-1.5 text-sm"
            >
              <option value={5000}>5 seconds</option>
              <option value={10000}>10 seconds</option>
              <option value={30000}>30 seconds</option>
              <option value={60000}>1 minute</option>
            </select>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* System Overview */}
        {healthData && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  System Status
                </CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(healthData.status)}
                  <div className="text-2xl font-bold capitalize">
                    {healthData.status}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Uptime: {formatUptime(healthData.uptime)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Response Time
                </CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(healthData.responseTime || 0).toFixed(0)}ms
                </div>
                <Progress
                  value={Math.min(
                    ((healthData.responseTime || 0) / 1000) * 100,
                    100,
                  )}
                  className="mt-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Error Rate
                </CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    'text-2xl font-bold',
                    (healthData.errorRate || 0) > 5
                      ? 'text-red-500'
                      : 'text-green-500',
                  )}
                >
                  {(healthData.errorRate || 0).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {healthData.requestCount || 0} total requests
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {healthData.system.cpu.usage.toFixed(0)}%
                </div>
                <Progress
                  value={healthData.system.cpu.usage}
                  className="mt-2"
                />
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="services" className="space-y-4">
          <TabsList>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="system">System Resources</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="realtime">Real-time Metrics</TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {healthData && healthData.checks && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>API Server</span>
                        {getStatusIcon(healthData.checks.api.status)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge
                        variant={
                          healthData.checks.api.status === 'healthy'
                            ? 'default'
                            : 'destructive'
                        }
                      >
                        {healthData.checks.api.status}
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Database</span>
                        {getStatusIcon(healthData.checks.database.status)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge
                        variant={
                          healthData.checks.database.status === 'healthy'
                            ? 'default'
                            : 'destructive'
                        }
                      >
                        {healthData.checks.database.status}
                      </Badge>
                      {healthData.checks.database.responseTime && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Response time:{' '}
                          {healthData.checks.database.responseTime}ms
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Supabase</span>
                        {getStatusIcon(healthData.checks.supabase.status)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge
                        variant={
                          healthData.checks.supabase.status === 'healthy'
                            ? 'default'
                            : 'destructive'
                        }
                      >
                        {healthData.checks.supabase.status}
                      </Badge>
                      {healthData.checks.supabase.responseTime && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Response time:{' '}
                          {healthData.checks.supabase.responseTime}ms
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            {healthData && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Memory Usage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm">
                          <span>Used</span>
                          <span>
                            {(
                              healthData.system.memory.used /
                              1024 /
                              1024 /
                              1024
                            ).toFixed(1)}
                            GB /{' '}
                            {(
                              healthData.system.memory.total /
                              1024 /
                              1024 /
                              1024
                            ).toFixed(1)}
                            GB
                          </span>
                        </div>
                        <Progress
                          value={healthData.system.memory.percentage}
                          className="mt-2"
                        />
                      </div>
                      <div className="text-3xl font-bold">
                        {healthData.system.memory.percentage.toFixed(0)}%
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Load Average</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          1 min
                        </span>
                        <span className="font-mono">
                          {healthData.system.load[0]?.toFixed(2) || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          5 min
                        </span>
                        <span className="font-mono">
                          {healthData.system.load[1]?.toFixed(2) || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          15 min
                        </span>
                        <span className="font-mono">
                          {healthData.system.load[2]?.toFixed(2) || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Endpoint Performance</CardTitle>
                <CardDescription>
                  Response times and error rates for API endpoints
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {performanceData.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Endpoint</th>
                            <th className="text-left p-2">Method</th>
                            <th className="text-right p-2">Avg Response</th>
                            <th className="text-right p-2">P95</th>
                            <th className="text-right p-2">P99</th>
                            <th className="text-right p-2">Requests</th>
                            <th className="text-right p-2">Error Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {performanceData.map((metric, index) => (
                            <tr key={index} className="border-b">
                              <td className="p-2 font-mono text-xs">
                                {metric.endpoint}
                              </td>
                              <td className="p-2">
                                <Badge variant="outline">{metric.method}</Badge>
                              </td>
                              <td className="p-2 text-right">
                                {metric.averageResponseTime.toFixed(0)}ms
                              </td>
                              <td className="p-2 text-right">
                                {metric.p95ResponseTime.toFixed(0)}ms
                              </td>
                              <td className="p-2 text-right">
                                {metric.p99ResponseTime.toFixed(0)}ms
                              </td>
                              <td className="p-2 text-right">
                                {metric.requestCount}
                              </td>
                              <td className="p-2 text-right">
                                <span
                                  className={cn(
                                    metric.errorRate > 5
                                      ? 'text-red-500'
                                      : 'text-green-500',
                                  )}
                                >
                                  {metric.errorRate.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No performance data available yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="realtime" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <MetricsChart
                title="CPU Usage"
                data={cpuHistory}
                color="#3b82f6"
                unit="%"
                height={250}
              />
              <MetricsChart
                title="Memory Usage"
                data={memoryHistory}
                color="#8b5cf6"
                unit="%"
                height={250}
              />
              <MetricsChart
                title="Response Time"
                data={responseTimeHistory}
                color="#10b981"
                unit="ms"
                height={250}
              />
              <MetricsChart
                title="Error Rate"
                data={errorRateHistory}
                color="#ef4444"
                unit="%"
                height={250}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
