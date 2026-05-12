/**
 * ServiceRegistry - Dependency Injection Container
 * Central registry for managing service instances and their lifecycle
 */

import { getLogger } from '@/utils/logger.js';

// Handle timer functions for different environments
declare const globalThis: any;
const timerSetInterval =
  typeof setInterval !== 'undefined'
    ? setInterval
    : globalThis?.setInterval || (global as any)?.setInterval || (() => null);
const timerClearInterval =
  typeof clearInterval !== 'undefined'
    ? clearInterval
    : globalThis?.clearInterval ||
      (global as any)?.clearInterval ||
      (() => {
        // Empty implementation for environments without clearInterval
      });

export interface Service {
  initialize?(): Promise<void>;
  start?(): Promise<void>;
  stop?(): Promise<void>;
  restart?(): Promise<void>;
  dispose?(): Promise<void>;
  healthCheck?(): Promise<HealthCheckResult>;
  getConfig?(): ServiceConfig;
  updateConfig?(config: Partial<ServiceConfig>): Promise<void>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, any>;
  timestamp: number;
}

export interface ServiceConfig {
  [key: string]: any;
}

export interface ServiceInstance {
  instance: Service;
  status:
    | 'registered'
    | 'initializing'
    | 'initialized'
    | 'starting'
    | 'started'
    | 'stopping'
    | 'stopped'
    | 'failed';
  health: 'unknown' | 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheck: HealthCheckResult | null;
  config?: ServiceConfig;
  dependencies: string[];
  metadata: {
    registeredAt: number;
    lastStateChange: number;
    restartCount: number;
    errors: Array<{ timestamp: number; error: string; context?: string }>;
  };
}

export interface HealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  services: Record<string, HealthCheckResult>;
}

export interface ServiceRegistryOptions {
  initializationOrder?: string[];
  healthCheckInterval?: number;
  maxRestartAttempts?: number;
  restartDelay?: number;
  enableAutoRecovery?: boolean;
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public serviceName?: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export class ServiceRegistry implements Service {
  private services = new Map<string, ServiceInstance>();
  private initOrder: string[] = [
    'eventBus',
    'audioEngine',
    'unifiedTransport',
    'pluginManager',
    'trackRepository',
    'pluginPresetRepository',
    'transportRepository',
  ];
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private options: Required<ServiceRegistryOptions>;
  private isDisposed = false;

  // Logger instance
  private logger = getLogger('service');

  private static _instance: ServiceRegistry | null = null;
  static resetInstance(): void {
    ServiceRegistry._instance = null;
  }

  constructor(options?: ServiceRegistryOptions) {
    this.options = {
      initializationOrder: options?.initializationOrder || this.initOrder,
      healthCheckInterval: options?.healthCheckInterval || 30000, // 30 seconds
      maxRestartAttempts: options?.maxRestartAttempts || 3,
      restartDelay: options?.restartDelay || 5000, // 5 seconds
      enableAutoRecovery: options?.enableAutoRecovery ?? true,
    };
    this.initOrder = this.options.initializationOrder;
  }

  /**
   * Register a service with optional dependencies
   */
  register<T extends Service>(
    name: string,
    service: T,
    dependencies: string[] = [],
  ): void {
    if (this.services.has(name)) {
      throw new ServiceError(`Service ${name} is already registered`, name);
    }

    const now = Date.now();
    const serviceInstance: ServiceInstance = {
      instance: service,
      status: 'registered',
      health: 'unknown',
      lastHealthCheck: null,
      config: service.getConfig ? service.getConfig() : undefined,
      dependencies,
      metadata: {
        registeredAt: now,
        lastStateChange: now,
        restartCount: 0,
        errors: [],
      },
    };

    this.services.set(name, serviceInstance);

    // Validate dependencies exist - Note: dependencies can be registered later in some cases
    // This check is deferred to initialization time
  }

  /**
   * Get a service by name with type safety
   */
  get<T extends Service>(name: string): T {
    const serviceInstance = this.services.get(name);
    if (!serviceInstance) {
      throw new ServiceError(`Service ${name} not found`, name);
    }
    return serviceInstance.instance as T;
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Initialize all services in the correct order
   */
  async initialize(): Promise<void> {
    if (this.isDisposed) {
      throw new ServiceError('ServiceRegistry has been disposed');
    }

    const initializationOrder = this.computeInitializationOrder();
    console.log(
      '[DEBUG-REGISTRY] 🔍 Initialization order:',
      initializationOrder,
    );

    for (const serviceName of initializationOrder) {
      console.log(`[DEBUG-REGISTRY] Processing service: ${serviceName}`);
      const serviceInstance = this.services.get(serviceName);

      if (!serviceInstance) {
        this.logger.error(`Service ${serviceName} not found in registry`);
        throw new ServiceError(
          `Service ${serviceName} not found in registry`,
          serviceName,
        );
      }

      if (!serviceInstance.status) {
        this.logger.error(`Service ${serviceName} has no status property`, {
          serviceInstance,
        });
        throw new ServiceError(
          `Service ${serviceName} has invalid structure`,
          serviceName,
        );
      }

      if (
        serviceInstance.status === 'initialized' ||
        serviceInstance.status === 'started'
      ) {
        console.log(
          `[DEBUG-REGISTRY] ⏭️  Skipping ${serviceName} (already ${serviceInstance.status})`,
        );
        continue;
      }

      this.updateServiceStatus(serviceName, 'initializing');

      if (serviceInstance.instance.initialize) {
        try {
          console.log(
            `[DEBUG-REGISTRY] 🚀 Calling initialize() on ${serviceName}...`,
          );
          this.logger.info(`Initializing ${serviceName}`);
          await serviceInstance.instance.initialize();
          console.log(
            `[DEBUG-REGISTRY] ✅ ${serviceName}.initialize() completed`,
          );
          this.logger.info(`${serviceName} initialized successfully`);
          this.updateServiceStatus(serviceName, 'initialized');
        } catch (error) {
          this.logger.error(`Failed to initialize ${serviceName}`, { error });
          this.updateServiceStatus(serviceName, 'failed');
          this.recordServiceError(serviceName, error, 'initialize');
          throw new ServiceError(
            `Failed to initialize service ${serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            serviceName,
          );
        }
      } else {
        // Mark as initialized even if no initialize method
        this.logger.info(
          `${serviceName} has no initialize method, marking as initialized`,
        );
        this.updateServiceStatus(serviceName, 'initialized');
      }
    }

    // Start health monitoring after initialization
    this.startHealthMonitoring();
  }

  /**
   * Start all services
   */
  async start(): Promise<void> {
    if (this.isDisposed) {
      throw new ServiceError('ServiceRegistry has been disposed');
    }

    const startOrder = this.computeInitializationOrder();

    for (const serviceName of startOrder) {
      const serviceInstance = this.services.get(serviceName);
      if (!serviceInstance) {
        continue; // Skip if service not found
      }

      if (serviceInstance.status === 'started') {
        continue;
      }

      // Ensure service is initialized first
      if (
        serviceInstance.status !== 'initialized' &&
        serviceInstance.status !== 'stopped'
      ) {
        throw new ServiceError(
          `Cannot start service ${serviceName}: not initialized (status: ${serviceInstance.status})`,
          serviceName,
        );
      }

      this.updateServiceStatus(serviceName, 'starting');

      if (serviceInstance.instance.start) {
        try {
          await serviceInstance.instance.start();
          this.updateServiceStatus(serviceName, 'started');
        } catch (error) {
          this.updateServiceStatus(serviceName, 'failed');
          this.recordServiceError(serviceName, error, 'start');
          throw new ServiceError(
            `Failed to start service ${serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            serviceName,
          );
        }
      } else {
        // Mark as started even if no start method
        this.updateServiceStatus(serviceName, 'started');
      }
    }
  }

  /**
   * Stop all services in reverse order
   */
  async stop(): Promise<void> {
    // Stop health monitoring first
    this.stopHealthMonitoring();

    const stopOrder = this.computeInitializationOrder().reverse();

    for (const serviceName of stopOrder) {
      const serviceInstance = this.services.get(serviceName);
      if (!serviceInstance) {
        continue; // Skip if service not found
      }

      if (serviceInstance.status !== 'started') {
        continue;
      }

      this.updateServiceStatus(serviceName, 'stopping');

      if (serviceInstance.instance.stop) {
        try {
          await serviceInstance.instance.stop();
          this.updateServiceStatus(serviceName, 'stopped');
        } catch (error) {
          this.recordServiceError(serviceName, error, 'stop');
          // Log error but continue stopping other services
          this.logger.warn(`Error stopping service ${serviceName}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Mark as stopped anyway to allow cleanup
          this.updateServiceStatus(serviceName, 'stopped');
        }
      } else {
        this.updateServiceStatus(serviceName, 'stopped');
      }
    }
  }

  /**
   * Restart the registry (implements Service interface)
   */
  async restart(): Promise<void> {
    // Restart all services
    for (const [serviceName] of this.services) {
      await this.restartService(serviceName);
    }
  }

  /**
   * Restart a specific service
   */
  async restartService(serviceName: string): Promise<void> {
    const serviceInstance = this.services.get(serviceName);
    if (!serviceInstance) {
      throw new ServiceError(`Service ${serviceName} not found`, serviceName);
    }

    // Increment restart count
    serviceInstance.metadata.restartCount++;

    try {
      // Use restart method if available
      if (serviceInstance.instance.restart) {
        await serviceInstance.instance.restart();
        this.updateServiceStatus(serviceName, 'started');
      } else {
        // Otherwise do stop/start sequence
        // Stop if running and has stop method
        if (
          serviceInstance.status === 'started' &&
          serviceInstance.instance.stop
        ) {
          this.updateServiceStatus(serviceName, 'stopping');
          await serviceInstance.instance.stop();
          this.updateServiceStatus(serviceName, 'stopped');
        }

        // Start if has start method
        if (serviceInstance.instance.start) {
          this.updateServiceStatus(serviceName, 'starting');
          await serviceInstance.instance.start();
          this.updateServiceStatus(serviceName, 'started');
        }
      }

      // Reset health status after successful restart
      serviceInstance.health = 'unknown';
      serviceInstance.lastHealthCheck = null;
    } catch (error) {
      this.updateServiceStatus(serviceName, 'failed');
      this.recordServiceError(serviceName, error, 'restart');
      throw error;
    }
  }

  /**
   * Dispose all services and clear registry
   */
  async dispose(): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    // Stop all services first
    await this.stop();

    // Dispose in reverse initialization order
    const disposeOrder = this.computeInitializationOrder().reverse();

    for (const serviceName of disposeOrder) {
      const serviceInstance = this.services.get(serviceName);
      if (!serviceInstance) {
        continue; // Skip if service not found
      }
      if (serviceInstance.instance.dispose) {
        try {
          await serviceInstance.instance.dispose();
        } catch (error) {
          this.recordServiceError(serviceName, error, 'dispose');
          this.logger.warn(`Error disposing service ${serviceName}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    // Clear all state
    this.services.clear();
    this.isDisposed = true;
  }

  /**
   * Get disposal status (useful for testing)
   */
  get disposed(): boolean {
    return this.isDisposed;
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get service initialization status
   */
  getServiceStatus(serviceName: string): {
    registered: boolean;
    status: ServiceInstance['status'];
    health: ServiceInstance['health'];
    metadata: ServiceInstance['metadata'];
  } | null {
    const serviceInstance = this.services.get(serviceName);
    if (!serviceInstance) {
      return null;
    }

    return {
      registered: true,
      status: serviceInstance.status,
      health: serviceInstance.health,
      metadata: serviceInstance.metadata,
    };
  }

  /**
   * Compute initialization order based on dependencies and predefined order
   */
  /**
   * Perform health check (implements Service interface)
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const healthReport = await this.getHealthReport();

    // Convert HealthReport to HealthCheckResult
    return {
      status: healthReport.overall,
      message: `ServiceRegistry health check: ${healthReport.overall}`,
      details: {
        services: healthReport.services,
        timestamp: healthReport.timestamp,
      },
      timestamp: healthReport.timestamp,
    };
  }

  /**
   * Get detailed health report for all services
   */
  async getHealthReport(): Promise<HealthReport> {
    const report: HealthReport = {
      overall: 'healthy',
      timestamp: Date.now(),
      services: {},
    };

    let healthyCount = 0;
    let unhealthyCount = 0;
    let degradedCount = 0;

    for (const [serviceName, serviceInstance] of this.services) {
      // Only check health of started services
      if (serviceInstance.status !== 'started') {
        continue;
      }

      try {
        const healthResult = await this.checkServiceHealth(serviceName);
        report.services[serviceName] = healthResult;

        if (healthResult.status === 'unhealthy') {
          unhealthyCount++;
        } else if (healthResult.status === 'degraded') {
          degradedCount++;
        } else {
          healthyCount++;
        }
      } catch (error) {
        report.services[serviceName] = {
          status: 'unhealthy',
          message:
            error instanceof Error ? error.message : 'Health check failed',
          timestamp: Date.now(),
        };
        unhealthyCount++;
      }
    }

    // Determine overall health status
    const totalServices = healthyCount + unhealthyCount + degradedCount;
    if (unhealthyCount > 0 && unhealthyCount < totalServices) {
      report.overall = 'degraded'; // Some services unhealthy
    } else if (unhealthyCount === totalServices && totalServices > 0) {
      report.overall = 'unhealthy'; // All services unhealthy
    } else if (degradedCount > 0) {
      report.overall = 'degraded'; // Some services degraded
    }

    return report;
  }

  /**
   * Check health of a specific service
   */
  private async checkServiceHealth(
    serviceName: string,
  ): Promise<HealthCheckResult> {
    const serviceInstance = this.services.get(serviceName);
    if (!serviceInstance) {
      throw new ServiceError(`Service ${serviceName} not found`, serviceName);
    }

    let healthResult: HealthCheckResult;

    if (serviceInstance.instance.healthCheck) {
      try {
        healthResult = await serviceInstance.instance.healthCheck();
      } catch (error) {
        healthResult = {
          status: 'unhealthy',
          message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
        };
      }
    } else {
      // Default health check - service is healthy if started
      healthResult = {
        status: serviceInstance.status === 'started' ? 'healthy' : 'unhealthy',
        message: `Service status: ${serviceInstance.status}`,
        timestamp: Date.now(),
      };
    }

    // Update service health status
    serviceInstance.health = healthResult.status;
    serviceInstance.lastHealthCheck = healthResult;

    // Handle auto-recovery if enabled
    if (
      this.options.enableAutoRecovery &&
      healthResult.status === 'unhealthy' &&
      serviceInstance.metadata.restartCount < this.options.maxRestartAttempts
    ) {
      await this.attemptServiceRecovery(serviceName);
    }

    return healthResult;
  }

  /**
   * Attempt to recover a failed service
   */
  private async attemptServiceRecovery(serviceName: string): Promise<void> {
    const serviceInstance = this.services.get(serviceName);
    if (!serviceInstance) {
      throw new ServiceError(`Service ${serviceName} not found`, serviceName);
    }

    this.logger.warn(`Attempting to recover service ${serviceName}`, {
      attempt: serviceInstance.metadata.restartCount + 1,
      maxAttempts: this.options.maxRestartAttempts,
    });

    // Use promise with timeout or immediate resolution for testing
    const delay =
      this.options.restartDelay > 0
        ? new Promise((resolve) =>
            setTimeout(resolve, this.options.restartDelay),
          )
        : Promise.resolve();

    await delay;

    try {
      await this.restartService(serviceName);
      this.logger.info(`Service ${serviceName} recovered successfully`);
    } catch (error) {
      this.logger.error(`Failed to recover service ${serviceName}`, { error });
      this.recordServiceError(serviceName, error, 'recovery');
    }
  }

  /**
   * Start health monitoring interval
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = timerSetInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        this.logger.error('Health check failed', { error });
      }
    }, this.options.healthCheckInterval);
  }

  /**
   * Stop health monitoring interval
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      timerClearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Update service status and metadata
   */
  private updateServiceStatus(
    serviceName: string,
    status: ServiceInstance['status'],
  ): void {
    const serviceInstance = this.services.get(serviceName);
    if (serviceInstance) {
      serviceInstance.status = status;
      serviceInstance.metadata.lastStateChange = Date.now();
    }
  }

  /**
   * Record service error
   */
  private recordServiceError(
    serviceName: string,
    error: unknown,
    context?: string,
  ): void {
    const serviceInstance = this.services.get(serviceName);
    if (serviceInstance) {
      serviceInstance.metadata.errors.push({
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
        context,
      });

      // Keep only last 100 errors
      if (serviceInstance.metadata.errors.length > 100) {
        serviceInstance.metadata.errors =
          serviceInstance.metadata.errors.slice(-100);
      }
    }
  }

  /**
   * Get service configuration
   */
  getServiceConfig(serviceName: string): ServiceConfig | undefined {
    const serviceInstance = this.services.get(serviceName);
    return serviceInstance?.config;
  }

  /**
   * Update service configuration
   */
  async updateServiceConfig(
    serviceName: string,
    config: Partial<ServiceConfig>,
  ): Promise<void> {
    const serviceInstance = this.services.get(serviceName);
    if (!serviceInstance) {
      throw new ServiceError(`Service ${serviceName} not found`, serviceName);
    }

    if (serviceInstance.instance.updateConfig) {
      await serviceInstance.instance.updateConfig(config);
      serviceInstance.config = { ...serviceInstance.config, ...config };
    } else {
      throw new ServiceError(
        `Service ${serviceName} does not support configuration updates`,
        serviceName,
      );
    }
  }

  /**
   * Get detailed service report
   */
  getServiceReport(): Record<string, any> {
    const report: Record<string, any> = {};

    for (const [serviceName, serviceInstance] of this.services) {
      report[serviceName] = {
        status: serviceInstance.status,
        health: serviceInstance.health,
        lastHealthCheck: serviceInstance.lastHealthCheck,
        dependencies: serviceInstance.dependencies,
        metadata: serviceInstance.metadata,
        config: serviceInstance.config,
      };
    }

    return report;
  }

  private computeInitializationOrder(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    // Validate all dependencies exist before computing order
    for (const [serviceName, serviceInstance] of this.services) {
      for (const dep of serviceInstance.dependencies) {
        if (!this.services.has(dep)) {
          throw new ServiceError(
            `Service ${serviceName} depends on ${dep}, which is not registered`,
            serviceName,
          );
        }
      }
    }

    // Helper function for topological sort
    const visit = (serviceName: string) => {
      if (visited.has(serviceName)) {
        return;
      }

      visited.add(serviceName);

      // Visit dependencies first
      const serviceInstance = this.services.get(serviceName);
      if (serviceInstance?.dependencies) {
        for (const dep of serviceInstance.dependencies) {
          visit(dep);
        }
      }

      result.push(serviceName);
    };

    // First, initialize services in predefined order if they exist
    for (const serviceName of this.initOrder) {
      if (this.services.has(serviceName)) {
        visit(serviceName);
      }
    }

    // Then initialize any remaining services
    for (const serviceName of this.services.keys()) {
      visit(serviceName);
    }

    return result;
  }
}

// Global instance management
let globalInstance: ServiceRegistry | null = null;

/**
 * Get or create the global ServiceRegistry instance
 */
export function getServiceRegistry(): ServiceRegistry {
  if (!globalInstance || globalInstance.disposed) {
    globalInstance = new ServiceRegistry();
  }
  return globalInstance;
}

/**
 * Reset the global ServiceRegistry instance (for testing)
 */
export function resetServiceRegistry(): void {
  globalInstance = null;
}

/**
 * Set the global ServiceRegistry instance (used by CoreServices)
 */
export function setGlobalServiceRegistry(registry: ServiceRegistry): void {
  globalInstance = registry;
}

/**
 * Check if ServiceRegistry is initialized
 */
export function isServiceRegistryInitialized(): boolean {
  return globalInstance !== null && globalInstance.getServiceNames().length > 0;
}

/**
 * Reset the global ServiceRegistry instance
 */
export function resetGlobalServiceRegistry(): void {
  globalInstance = null;
}

// Export singleton instance for global access (backwards compatibility)
export const serviceRegistry = {
  get<T extends Service>(name: string): T {
    // Try to get from global instance or window global
    if (globalInstance && globalInstance.has(name)) {
      return globalInstance.get<T>(name);
    }

    // Check window globals as fallback
    if (typeof window !== 'undefined') {
      const windowRegistry = window.__serviceRegistry;
      if (windowRegistry && windowRegistry.has(name)) {
        return windowRegistry.get(name) as T;
      }
    }

    throw new ServiceError(
      `Service ${name} not found - ServiceRegistry may not be initialized yet`,
      name,
    );
  },

  has(name: string): boolean {
    if (globalInstance) {
      return globalInstance.has(name);
    }

    if (typeof window !== 'undefined') {
      const windowRegistry = window.__serviceRegistry;
      if (windowRegistry) {
        return windowRegistry.has(name);
      }
    }

    return false;
  },

  register<T extends Service>(
    name: string,
    service: T,
    dependencies: string[] = [],
  ): void {
    const registry = getServiceRegistry();
    registry.register(name, service, dependencies);
  },
};
