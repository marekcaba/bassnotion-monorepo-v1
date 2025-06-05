/**
 * MemoryLeakDetector - Advanced Memory Leak Detection and Prevention
 *
 * Provides comprehensive memory leak detection with heuristic analysis,
 * pattern recognition, automatic remediation, and prevention strategies.
 *
 * Part of Story 2.1: Core Audio Engine Foundation - Task 8.2
 */

import { ResourceType, ManagedResource } from './ResourceManager.js';
import {
  DeviceCapabilities,
  BatteryStatus,
  ThermalStatus,
} from '../types/audio.js';

export type LeakSeverity = 'minor' | 'moderate' | 'severe' | 'critical';
export type LeakCategory =
  | 'reference'
  | 'closure'
  | 'event'
  | 'timer'
  | 'dom'
  | 'worker'
  | 'audio';
export type DetectionMethod =
  | 'weak_ref'
  | 'memory_growth'
  | 'pattern_analysis'
  | 'reference_count';

export interface MemoryLeakPattern {
  id: string;
  name: string;
  category: LeakCategory;
  description: string;
  resourceTypes: ResourceType[];
  detectionHeuristics: LeakHeuristic[];
  preventionStrategy: PreventionStrategy;
  autoRemediation: RemediationStrategy;
  severity: LeakSeverity;
  confidence: number; // 0-1
}

export interface LeakHeuristic {
  type: DetectionMethod;
  threshold: number;
  timeWindow: number; // ms
  samplingRate: number; // samples per second
  weight: number; // 0-1 importance in final score
  description: string;
}

export interface PreventionStrategy {
  enableWeakReferences: boolean;
  enforceReferenceCountLimits: boolean;
  preventCircularReferences: boolean;
  automaticEventCleanup: boolean;
  timerTimeoutLimits: boolean;
  domObserverCleanup: boolean;
  workerTerminationOnIdle: boolean;
  maxResourceAge: number; // ms
}

export interface RemediationStrategy {
  automatic: boolean;
  priority: 'immediate' | 'deferred' | 'scheduled';
  actions: RemediationAction[];
  maxAttempts: number;
  cooldownPeriod: number; // ms between attempts
  rollbackOnFailure: boolean;
}

export interface RemediationAction {
  type:
    | 'dispose_resource'
    | 'clear_references'
    | 'force_gc'
    | 'restart_component';
  description: string;
  estimatedEffectiveness: number; // 0-1
  riskLevel: 'low' | 'medium' | 'high';
  prerequisites: string[];
}

export interface SuspectedLeak {
  id: string;
  resourceId: string;
  type: ResourceType;
  category: LeakCategory;
  severity: LeakSeverity;
  detectionMethod: DetectionMethod;
  confidence: number; // 0-1

  // Timing information
  detectedAt: number;
  resourceAge: number;
  lastAccessed: number;

  // Memory information
  estimatedLeakage: number; // bytes
  memoryGrowthRate: number; // bytes/second

  // Reference tracking
  referenceCount: number;
  weakRefCount: number;
  circularReferences: string[];

  // Context information
  stackTrace?: string;
  relatedResources: string[];
  userAgent?: string;

  // Pattern matching
  matchedPatterns: string[];
  heuristicScores: Map<DetectionMethod, number>;

  // Remediation status
  remediationAttempts: number;
  lastRemediationAttempt?: number;
  remediationSuccess: boolean;
}

export interface MemorySnapshot {
  timestamp: number;
  totalMemory: number;
  resourceCount: number;
  resourceMemory: Map<ResourceType, number>;
  gcStats?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  performanceMetrics: {
    cpuUsage: number;
    memoryPressure: number;
    gcFrequency: number;
  };
}

export interface LeakDetectionReport {
  timestamp: number;
  scanDuration: number;

  // Leak findings
  suspectedLeaks: SuspectedLeak[];
  confirmedLeaks: SuspectedLeak[];
  resolvedLeaks: SuspectedLeak[];

  // Memory analysis
  memoryGrowthRate: number; // bytes/second
  totalSuspectedLeakage: number; // bytes
  memoryEfficiency: number; // 0-1

  // Pattern analysis
  detectedPatterns: string[];
  emergingPatterns: string[];

  // Recommendations
  preventionRecommendations: string[];
  remediationRecommendations: string[];
  configurationRecommendations: string[];

  // Statistics
  detectionAccuracy: number; // 0-1
  falsePositiveRate: number; // 0-1
  remediationSuccessRate: number; // 0-1

  // Risk assessment
  overallRisk: LeakSeverity;
  immediateAction: boolean;
  estimatedTimeToFailure?: number; // ms
}

export interface LeakDetectorConfig {
  enabled: boolean;

  scanning: {
    interval: number; // ms
    deepScanInterval: number; // ms
    snapshotRetention: number; // number of snapshots to keep
    backgroundScanning: boolean;
  };

  detection: {
    sensitivityLevel: 'low' | 'medium' | 'high' | 'paranoid';
    memoryGrowthThreshold: number; // bytes/second
    referenceCountThreshold: number;
    weakRefLeakThreshold: number;
    gcAnalysisEnabled: boolean;
    patternMatchingEnabled: boolean;
  };

  prevention: {
    enabled: boolean;
    aggressiveMode: boolean;
    autoCleanupEnabled: boolean;
    resourceAgeLimits: Map<ResourceType, number>;
    circularReferenceDetection: boolean;
  };

  remediation: {
    enabled: boolean;
    automaticMode: boolean;
    maxRemediationAttempts: number;
    cooldownPeriod: number; // ms
    escalationThresholds: Map<LeakSeverity, number>;
  };

  monitoring: {
    enabled: boolean;
    detailedLogging: boolean;
    performanceImpactTracking: boolean;
    alerting: boolean;
    reportGeneration: boolean;
  };
}

export interface MemoryLeakDetectorEvents {
  leakDetected: (leak: SuspectedLeak) => void;
  leakConfirmed: (leak: SuspectedLeak) => void;
  leakResolved: (leakId: string, method: string) => void;
  patternDetected: (pattern: MemoryLeakPattern, leaks: SuspectedLeak[]) => void;
  memoryPressureCritical: (pressure: number, snapshot: MemorySnapshot) => void;
  remediationStarted: (leakId: string, actions: RemediationAction[]) => void;
  remediationCompleted: (
    leakId: string,
    success: boolean,
    memoryReclaimed: number,
  ) => void;
  scanCompleted: (report: LeakDetectionReport) => void;
}

// Extended performance interface to handle memory API
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

export class MemoryLeakDetector {
  private static instance: MemoryLeakDetector;
  private config: LeakDetectorConfig;
  private isRunning = false;

  // Detection state
  private suspectedLeaks: Map<string, SuspectedLeak> = new Map();
  private confirmedLeaks: Map<string, SuspectedLeak> = new Map();
  private resolvedLeaks: Map<string, SuspectedLeak> = new Map();
  private memorySnapshots: MemorySnapshot[] = [];
  private leakPatterns: Map<string, MemoryLeakPattern> = new Map();

  // Timers
  private scanTimer?: number;
  private deepScanTimer?: number;
  private cleanupTimer?: number;

  // Device context
  private deviceCapabilities?: DeviceCapabilities;
  private batteryStatus?: BatteryStatus;
  private thermalStatus?: ThermalStatus;

  // Performance tracking
  private metrics = {
    totalScans: 0,
    leaksDetected: 0,
    leaksConfirmed: 0,
    leaksResolved: 0,
    falsePositives: 0,
    remediationAttempts: 0,
    remediationSuccesses: 0,
    memoryReclaimed: 0,
    scanDuration: 0,
  };

  // Event system
  private eventHandlers: Map<
    keyof MemoryLeakDetectorEvents,
    Set<MemoryLeakDetectorEvents[keyof MemoryLeakDetectorEvents]>
  > = new Map();

  private constructor(config?: Partial<LeakDetectorConfig>) {
    this.config = this.mergeConfig(config);
    this.initializeLeakPatterns();
  }

  public static getInstance(
    config?: Partial<LeakDetectorConfig>,
  ): MemoryLeakDetector {
    if (!MemoryLeakDetector.instance) {
      MemoryLeakDetector.instance = new MemoryLeakDetector(config);
    }
    return MemoryLeakDetector.instance;
  }

  /**
   * Initialize the Memory Leak Detector
   */
  public async initialize(
    deviceCapabilities?: DeviceCapabilities,
    batteryStatus?: BatteryStatus,
    thermalStatus?: ThermalStatus,
  ): Promise<void> {
    this.deviceCapabilities = deviceCapabilities;
    this.batteryStatus = batteryStatus;
    this.thermalStatus = thermalStatus;

    // Adjust configuration based on device capabilities
    if (deviceCapabilities) {
      this.adjustConfigForDevice(deviceCapabilities);
    }

    this.isRunning = true;
    this.startBackgroundDetection();

    console.log(
      'MemoryLeakDetector initialized with configuration:',
      this.config,
    );
  }

  /**
   * Register a resource for leak monitoring
   */
  public registerResource(resource: ManagedResource): void {
    if (!this.config.enabled) return;

    // Add weak reference for tracking
    if (this.config.detection.gcAnalysisEnabled) {
      resource.weakRefs.add(new WeakRef(resource.resource));
    }

    // Check for immediate leak indicators
    this.performImmediateChecks(resource);
  }

  /**
   * Unregister a resource from leak monitoring
   */
  public unregisterResource(resourceId: string): void {
    // Remove from suspected leaks if present
    this.suspectedLeaks.delete(resourceId);

    // Check if this resolves any confirmed leaks
    const confirmedLeak = this.confirmedLeaks.get(resourceId);
    if (confirmedLeak) {
      this.markLeakAsResolved(resourceId, 'resource_disposed');
    }
  }

  /**
   * Perform immediate leak scan
   */
  public async performScan(deep = false): Promise<LeakDetectionReport> {
    const startTime = Date.now();

    // Take memory snapshot
    const snapshot = this.takeMemorySnapshot();
    this.memorySnapshots.push(snapshot);

    // Trim old snapshots
    if (this.memorySnapshots.length > this.config.scanning.snapshotRetention) {
      this.memorySnapshots.shift();
    }

    // Detect new leaks
    const _newLeaks = await this.detectLeaks(snapshot, deep);

    // Analyze patterns
    const patterns = this.analyzeLeakPatterns();

    // Generate report
    const scanDuration = Date.now() - startTime;
    const report = this.generateReport(scanDuration, patterns);

    this.metrics.totalScans++;
    this.metrics.scanDuration = scanDuration;

    this.emit('scanCompleted', report);

    return report;
  }

  /**
   * Remediate a specific leak
   */
  public async remediateLeak(leakId: string, force = false): Promise<boolean> {
    const leak =
      this.suspectedLeaks.get(leakId) || this.confirmedLeaks.get(leakId);
    if (!leak) {
      console.warn(`Cannot remediate: leak ${leakId} not found`);
      return false;
    }

    if (
      !force &&
      leak.remediationAttempts >= this.config.remediation.maxRemediationAttempts
    ) {
      console.warn(
        `Cannot remediate: leak ${leakId} has exceeded max attempts`,
      );
      return false;
    }

    const now = Date.now();
    if (
      !force &&
      leak.lastRemediationAttempt &&
      now - leak.lastRemediationAttempt < this.config.remediation.cooldownPeriod
    ) {
      console.warn(`Cannot remediate: leak ${leakId} is in cooldown period`);
      return false;
    }

    return await this.executeRemediation(leak);
  }

  /**
   * Get comprehensive leak statistics
   */
  public getStatistics() {
    const totalMemoryLeakage = Array.from(this.suspectedLeaks.values())
      .concat(Array.from(this.confirmedLeaks.values()))
      .reduce((total, leak) => total + leak.estimatedLeakage, 0);

    const allLeaks = Array.from(this.suspectedLeaks.values()).concat(
      Array.from(this.confirmedLeaks.values()),
    );

    const categoryCount = new Map<LeakCategory, number>();
    let totalAge = 0;

    for (const leak of allLeaks) {
      categoryCount.set(
        leak.category,
        (categoryCount.get(leak.category) || 0) + 1,
      );
      totalAge += leak.resourceAge;
    }

    const mostCommonCategory = Array.from(categoryCount.entries()).reduce(
      (max, [category, count]) => (count > max[1] ? [category, count] : max),
      ['reference' as LeakCategory, 0],
    )[0];

    return {
      metrics: { ...this.metrics },
      currentState: {
        suspectedLeaks: this.suspectedLeaks.size,
        confirmedLeaks: this.confirmedLeaks.size,
        resolvedLeaks: this.resolvedLeaks.size,
        totalMemoryLeakage,
      },
      patternAnalysis: {
        detectedPatterns: Array.from(this.leakPatterns.keys()),
        mostCommonCategory,
        averageLeakAge: allLeaks.length > 0 ? totalAge / allLeaks.length : 0,
      },
    };
  }

  /**
   * Update device status for adaptive detection
   */
  public updateDeviceStatus(
    batteryStatus?: BatteryStatus,
    thermalStatus?: ThermalStatus,
  ): void {
    this.batteryStatus = batteryStatus;
    this.thermalStatus = thermalStatus;

    // Adjust scanning frequency based on battery
    if (batteryStatus?.level && batteryStatus.level < 0.2) {
      // Reduce scanning frequency when battery is low
      this.adjustScanningFrequency(0.5);
    }

    // Emergency mode during critical thermal state
    if (thermalStatus?.state === 'critical') {
      void this.performEmergencyCleanup();
    }
  }

  /**
   * Event subscription
   */
  public on<K extends keyof MemoryLeakDetectorEvents>(
    event: K,
    handler: MemoryLeakDetectorEvents[K],
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Shutdown the detector
   */
  public async shutdown(): Promise<void> {
    this.isRunning = false;

    // Clear all timers
    if (this.scanTimer) clearInterval(this.scanTimer);
    if (this.deepScanTimer) clearInterval(this.deepScanTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);

    // Final remediation attempt for critical leaks
    const criticalLeaks = Array.from(this.confirmedLeaks.values()).filter(
      (leak) => leak.severity === 'critical',
    );

    for (const leak of criticalLeaks) {
      await this.remediateLeak(leak.id, true);
    }

    console.log('MemoryLeakDetector shutdown completed');
  }

  // Private implementation methods...

  private mergeConfig(
    config?: Partial<LeakDetectorConfig>,
  ): LeakDetectorConfig {
    const defaultConfig: LeakDetectorConfig = {
      enabled: true,
      scanning: {
        interval: 30000, // 30 seconds
        deepScanInterval: 300000, // 5 minutes
        snapshotRetention: 20,
        backgroundScanning: true,
      },
      detection: {
        sensitivityLevel: 'medium',
        memoryGrowthThreshold: 1024 * 1024, // 1MB/second
        referenceCountThreshold: 100,
        weakRefLeakThreshold: 5,
        gcAnalysisEnabled: true,
        patternMatchingEnabled: true,
      },
      prevention: {
        enabled: true,
        aggressiveMode: false,
        autoCleanupEnabled: true,
        resourceAgeLimits: new Map([
          ['timer_handle', 300000], // 5 minutes
          ['event_listener', 3600000], // 1 hour
          ['worker_thread', 1800000], // 30 minutes
        ]),
        circularReferenceDetection: true,
      },
      remediation: {
        enabled: true,
        automaticMode: true,
        maxRemediationAttempts: 3,
        cooldownPeriod: 60000, // 1 minute
        escalationThresholds: new Map([
          ['minor', 10],
          ['moderate', 5],
          ['severe', 2],
          ['critical', 1],
        ]),
      },
      monitoring: {
        enabled: true,
        detailedLogging: false,
        performanceImpactTracking: true,
        alerting: true,
        reportGeneration: true,
      },
    };

    return {
      ...defaultConfig,
      ...config,
      scanning: { ...defaultConfig.scanning, ...config?.scanning },
      detection: { ...defaultConfig.detection, ...config?.detection },
      prevention: { ...defaultConfig.prevention, ...config?.prevention },
      remediation: { ...defaultConfig.remediation, ...config?.remediation },
      monitoring: { ...defaultConfig.monitoring, ...config?.monitoring },
    };
  }

  private initializeLeakPatterns(): void {
    // Initialize common memory leak patterns
    const patterns: MemoryLeakPattern[] = [
      {
        id: 'circular_reference',
        name: 'Circular Reference Leak',
        category: 'reference',
        description:
          'Objects with circular references preventing garbage collection',
        resourceTypes: ['event_listener', 'canvas_context', 'subscription'],
        detectionHeuristics: [
          {
            type: 'reference_count',
            threshold: 10,
            timeWindow: 60000,
            samplingRate: 1,
            weight: 0.8,
            description: 'High reference count with no recent access',
          },
        ],
        preventionStrategy: {
          enableWeakReferences: true,
          enforceReferenceCountLimits: true,
          preventCircularReferences: true,
          automaticEventCleanup: true,
          timerTimeoutLimits: false,
          domObserverCleanup: true,
          workerTerminationOnIdle: false,
          maxResourceAge: 3600000,
        },
        autoRemediation: {
          automatic: true,
          priority: 'deferred',
          actions: [
            {
              type: 'clear_references',
              description: 'Break circular reference chains',
              estimatedEffectiveness: 0.9,
              riskLevel: 'low',
              prerequisites: [],
            },
          ],
          maxAttempts: 3,
          cooldownPeriod: 30000,
          rollbackOnFailure: false,
        },
        severity: 'moderate',
        confidence: 0.85,
      },
      {
        id: 'event_listener_leak',
        name: 'Event Listener Leak',
        category: 'event',
        description:
          'Event listeners not properly removed on component destruction',
        resourceTypes: ['event_listener', 'canvas_context'],
        detectionHeuristics: [
          {
            type: 'weak_ref',
            threshold: 5,
            timeWindow: 120000,
            samplingRate: 0.5,
            weight: 0.7,
            description: 'Multiple weak references to event targets',
          },
        ],
        preventionStrategy: {
          enableWeakReferences: true,
          enforceReferenceCountLimits: false,
          preventCircularReferences: false,
          automaticEventCleanup: true,
          timerTimeoutLimits: false,
          domObserverCleanup: true,
          workerTerminationOnIdle: false,
          maxResourceAge: 1800000,
        },
        autoRemediation: {
          automatic: true,
          priority: 'immediate',
          actions: [
            {
              type: 'dispose_resource',
              description: 'Remove event listeners and dispose resources',
              estimatedEffectiveness: 0.95,
              riskLevel: 'low',
              prerequisites: [],
            },
          ],
          maxAttempts: 2,
          cooldownPeriod: 10000,
          rollbackOnFailure: false,
        },
        severity: 'minor',
        confidence: 0.9,
      },
      {
        id: 'worker_thread_leak',
        name: 'Worker Thread Leak',
        category: 'worker',
        description: 'Worker threads not properly terminated',
        resourceTypes: ['worker_thread'],
        detectionHeuristics: [
          {
            type: 'memory_growth',
            threshold: 2048 * 1024, // 2MB
            timeWindow: 300000,
            samplingRate: 1,
            weight: 0.9,
            description: 'Continuous memory growth in worker processes',
          },
        ],
        preventionStrategy: {
          enableWeakReferences: false,
          enforceReferenceCountLimits: false,
          preventCircularReferences: false,
          automaticEventCleanup: false,
          timerTimeoutLimits: false,
          domObserverCleanup: false,
          workerTerminationOnIdle: true,
          maxResourceAge: 600000,
        },
        autoRemediation: {
          automatic: true,
          priority: 'immediate',
          actions: [
            {
              type: 'dispose_resource',
              description: 'Terminate worker threads and clean up resources',
              estimatedEffectiveness: 1.0,
              riskLevel: 'medium',
              prerequisites: ['save_worker_state'],
            },
          ],
          maxAttempts: 1,
          cooldownPeriod: 5000,
          rollbackOnFailure: true,
        },
        severity: 'severe',
        confidence: 0.95,
      },
    ];

    for (const pattern of patterns) {
      this.leakPatterns.set(pattern.id, pattern);
    }
  }

  private adjustConfigForDevice(capabilities: DeviceCapabilities): void {
    if (capabilities.deviceClass === 'low-end') {
      // Reduce scanning frequency for low-end devices
      this.config.scanning.interval = 60000; // 1 minute
      this.config.scanning.deepScanInterval = 600000; // 10 minutes
      this.config.detection.sensitivityLevel = 'low';
    } else if (capabilities.deviceClass === 'premium') {
      // Increase scanning frequency for premium devices
      this.config.scanning.interval = 15000; // 15 seconds
      this.config.scanning.deepScanInterval = 120000; // 2 minutes
      this.config.detection.sensitivityLevel = 'high';
    }
  }

  private performImmediateChecks(resource: ManagedResource): void {
    // Check for immediate red flags
    if (resource.refs > this.config.detection.referenceCountThreshold) {
      this.createSuspectedLeak(
        resource,
        'reference_count',
        'High reference count detected',
      );
    }

    // Check resource age limits
    const ageLimit = this.config.prevention.resourceAgeLimits.get(
      resource.metadata.type,
    );
    if (ageLimit && Date.now() - resource.metadata.createdAt > ageLimit) {
      this.createSuspectedLeak(
        resource,
        'pattern_analysis',
        'Resource exceeded age limit',
      );
    }
  }

  private createSuspectedLeak(
    resource: ManagedResource,
    method: DetectionMethod,
    reason: string,
  ): SuspectedLeak {
    const leak: SuspectedLeak = {
      id: `leak_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      resourceId: resource.id,
      type: resource.metadata.type,
      category: this.categorizeResource(resource.metadata.type),
      severity: this.assessSeverity(resource),
      detectionMethod: method,
      confidence: 0.5, // Initial confidence

      detectedAt: Date.now(),
      resourceAge: Date.now() - resource.metadata.createdAt,
      lastAccessed: resource.metadata.lastAccessed,

      estimatedLeakage: resource.metadata.memoryUsage,
      memoryGrowthRate: 0, // Will be calculated over time

      referenceCount: resource.refs,
      weakRefCount: resource.weakRefs.size,
      circularReferences: [],

      relatedResources: Array.from(resource.metadata.dependencies),
      matchedPatterns: [],
      heuristicScores: new Map(),

      remediationAttempts: 0,
      remediationSuccess: false,
    };

    this.suspectedLeaks.set(leak.id, leak);
    this.metrics.leaksDetected++;

    this.emit('leakDetected', leak);

    console.warn(
      `Memory leak suspected: ${leak.type}:${leak.resourceId} - ${reason}`,
    );
    return leak;
  }

  private categorizeResource(type: ResourceType): LeakCategory {
    const categoryMap: Partial<Record<ResourceType, LeakCategory>> = {
      event_listener: 'event',
      timer_handle: 'timer',
      worker_thread: 'worker',
      audio_context: 'audio',
      tone_instrument: 'audio',
      tone_effect: 'audio',
      canvas_context: 'dom',
      observer: 'dom',
    };
    return categoryMap[type] || 'reference';
  }

  private assessSeverity(resource: ManagedResource): LeakSeverity {
    const memoryUsage = resource.metadata.memoryUsage;
    const refCount = resource.refs;
    const age = Date.now() - resource.metadata.createdAt;

    if (
      memoryUsage > 50 * 1024 * 1024 ||
      refCount > 1000 ||
      resource.metadata.type === 'audio_context'
    ) {
      return 'critical';
    } else if (
      memoryUsage > 10 * 1024 * 1024 ||
      refCount > 100 ||
      age > 3600000
    ) {
      return 'severe';
    } else if (memoryUsage > 1024 * 1024 || refCount > 10 || age > 1800000) {
      return 'moderate';
    } else {
      return 'minor';
    }
  }

  private takeMemorySnapshot(): MemorySnapshot {
    const timestamp = Date.now();

    // Get performance memory if available
    let gcStats: MemorySnapshot['gcStats'];
    const extendedPerformance = performance as ExtendedPerformance;
    if (typeof performance !== 'undefined' && extendedPerformance.memory) {
      gcStats = {
        heapUsed: extendedPerformance.memory.usedJSHeapSize,
        heapTotal: extendedPerformance.memory.totalJSHeapSize,
        external:
          extendedPerformance.memory.usedJSHeapSize -
          extendedPerformance.memory.totalJSHeapSize,
      };
    }

    // Calculate resource memory by type
    const resourceMemory = new Map<ResourceType, number>();
    let totalMemory = 0;
    let resourceCount = 0;

    const suspectedLeaksArray = Array.from(this.suspectedLeaks.values());
    for (const leak of suspectedLeaksArray) {
      resourceCount++;
      totalMemory += leak.estimatedLeakage;
      resourceMemory.set(
        leak.type,
        (resourceMemory.get(leak.type) || 0) + leak.estimatedLeakage,
      );
    }

    return {
      timestamp,
      totalMemory,
      resourceCount,
      resourceMemory,
      gcStats,
      performanceMetrics: {
        cpuUsage: 0, // Would be provided by PerformanceMonitor
        memoryPressure: gcStats ? gcStats.heapUsed / gcStats.heapTotal : 0,
        gcFrequency: 0, // Would track GC frequency
      },
    };
  }

  private async detectLeaks(
    snapshot: MemorySnapshot,
    deep: boolean,
  ): Promise<SuspectedLeak[]> {
    const newLeaks: SuspectedLeak[] = [];

    // Memory growth analysis
    if (this.memorySnapshots.length > 1) {
      const previousSnapshot =
        this.memorySnapshots[this.memorySnapshots.length - 2];
      if (previousSnapshot) {
        const memoryGrowth =
          snapshot.totalMemory - previousSnapshot.totalMemory;
        const timeElapsed = snapshot.timestamp - previousSnapshot.timestamp;
        const growthRate = memoryGrowth / (timeElapsed / 1000); // bytes/second

        if (growthRate > this.config.detection.memoryGrowthThreshold) {
          // Identify resources contributing to growth
          // This would require more sophisticated tracking
          console.warn(
            `High memory growth rate detected: ${growthRate} bytes/second`,
          );
        }
      }
    }

    // Pattern matching
    if (this.config.detection.patternMatchingEnabled) {
      const patternLeaks = this.detectPatternLeaks();
      newLeaks.push(...patternLeaks);
    }

    // Deep scan for additional heuristics
    if (deep) {
      const deepLeaks = await this.performDeepScan();
      newLeaks.push(...deepLeaks);
    }

    return newLeaks;
  }

  private detectPatternLeaks(): SuspectedLeak[] {
    const newLeaks: SuspectedLeak[] = [];

    const patternsArray = Array.from(this.leakPatterns.values());
    for (const pattern of patternsArray) {
      const matchingResources = this.findResourcesMatchingPattern(pattern);

      for (const resource of matchingResources) {
        const existingLeak = this.findExistingLeak(resource.id);
        if (!existingLeak) {
          const leak = this.createSuspectedLeak(
            resource,
            'pattern_analysis',
            `Matched pattern: ${pattern.name}`,
          );
          leak.matchedPatterns.push(pattern.id);
          leak.confidence = pattern.confidence;
          newLeaks.push(leak);
        }
      }
    }

    return newLeaks;
  }

  private async performDeepScan(): Promise<SuspectedLeak[]> {
    // This would perform more intensive analysis
    // For now, return empty array
    return [];
  }

  private findResourcesMatchingPattern(
    _pattern: MemoryLeakPattern,
  ): ManagedResource[] {
    // This would be implemented by the ResourceManager
    // For now, return empty array
    return [];
  }

  private findExistingLeak(resourceId: string): SuspectedLeak | undefined {
    return (
      this.suspectedLeaks.get(resourceId) || this.confirmedLeaks.get(resourceId)
    );
  }

  private analyzeLeakPatterns(): string[] {
    // Analyze current leaks for emerging patterns
    return Array.from(this.leakPatterns.keys());
  }

  private generateReport(
    scanDuration: number,
    patterns: string[],
  ): LeakDetectionReport {
    const timestamp = Date.now();
    const suspectedLeaks = Array.from(this.suspectedLeaks.values());
    const confirmedLeaks = Array.from(this.confirmedLeaks.values());
    const resolvedLeaks = Array.from(this.resolvedLeaks.values());

    const totalSuspectedLeakage = suspectedLeaks.reduce(
      (total, leak) => total + leak.estimatedLeakage,
      0,
    );
    const memoryGrowthRate = this.calculateMemoryGrowthRate();

    return {
      timestamp,
      scanDuration,
      suspectedLeaks,
      confirmedLeaks,
      resolvedLeaks,
      memoryGrowthRate,
      totalSuspectedLeakage,
      memoryEfficiency: this.calculateMemoryEfficiency(),
      detectedPatterns: patterns,
      emergingPatterns: [],
      preventionRecommendations: this.generatePreventionRecommendations(),
      remediationRecommendations: this.generateRemediationRecommendations(),
      configurationRecommendations: this.generateConfigurationRecommendations(),
      detectionAccuracy: this.calculateDetectionAccuracy(),
      falsePositiveRate: this.calculateFalsePositiveRate(),
      remediationSuccessRate: this.calculateRemediationSuccessRate(),
      overallRisk: this.assessOverallRisk(),
      immediateAction: this.requiresImmediateAction(),
    };
  }

  private calculateMemoryGrowthRate(): number {
    if (this.memorySnapshots.length < 2) return 0;

    const latest = this.memorySnapshots[this.memorySnapshots.length - 1];
    const previous = this.memorySnapshots[this.memorySnapshots.length - 2];

    if (!latest || !previous) return 0;

    const memoryDelta = latest.totalMemory - previous.totalMemory;
    const timeDelta = latest.timestamp - previous.timestamp;

    return timeDelta > 0 ? (memoryDelta / timeDelta) * 1000 : 0; // bytes/second
  }

  private calculateMemoryEfficiency(): number {
    // Placeholder implementation
    return 0.8;
  }

  private generatePreventionRecommendations(): string[] {
    return [
      'Enable automatic event listener cleanup',
      'Implement resource age limits',
      'Use weak references for circular dependencies',
    ];
  }

  private generateRemediationRecommendations(): string[] {
    return [
      'Clean up resources with high reference counts',
      'Terminate idle worker threads',
      'Force garbage collection during low activity',
    ];
  }

  private generateConfigurationRecommendations(): string[] {
    return [
      'Adjust scanning frequency based on device capabilities',
      'Enable aggressive mode for low-memory devices',
      'Increase prevention thresholds for high-end devices',
    ];
  }

  private calculateDetectionAccuracy(): number {
    const total = this.metrics.leaksDetected + this.metrics.falsePositives;
    return total > 0 ? this.metrics.leaksDetected / total : 1;
  }

  private calculateFalsePositiveRate(): number {
    const total = this.metrics.leaksDetected + this.metrics.falsePositives;
    return total > 0 ? this.metrics.falsePositives / total : 0;
  }

  private calculateRemediationSuccessRate(): number {
    return this.metrics.remediationAttempts > 0
      ? this.metrics.remediationSuccesses / this.metrics.remediationAttempts
      : 0;
  }

  private assessOverallRisk(): LeakSeverity {
    const confirmedLeaks = Array.from(this.confirmedLeaks.values());

    if (confirmedLeaks.some((leak) => leak.severity === 'critical')) {
      return 'critical';
    } else if (confirmedLeaks.some((leak) => leak.severity === 'severe')) {
      return 'severe';
    } else if (confirmedLeaks.length > 5) {
      return 'moderate';
    } else {
      return 'minor';
    }
  }

  private requiresImmediateAction(): boolean {
    return (
      this.assessOverallRisk() === 'critical' ||
      Array.from(this.confirmedLeaks.values()).length > 10
    );
  }

  private async executeRemediation(leak: SuspectedLeak): Promise<boolean> {
    leak.remediationAttempts++;
    leak.lastRemediationAttempt = Date.now();
    this.metrics.remediationAttempts++;

    this.emit('remediationStarted', leak.id, []);

    try {
      // Execute remediation based on leak category and patterns
      const success = await this.performRemediationActions(leak);

      if (success) {
        this.markLeakAsResolved(leak.id, 'remediation_successful');
        this.metrics.remediationSuccesses++;
        this.metrics.memoryReclaimed += leak.estimatedLeakage;
      }

      this.emit(
        'remediationCompleted',
        leak.id,
        success,
        success ? leak.estimatedLeakage : 0,
      );
      return success;
    } catch (error) {
      console.error(`Remediation failed for leak ${leak.id}:`, error);
      return false;
    }
  }

  private async performRemediationActions(
    leak: SuspectedLeak,
  ): Promise<boolean> {
    // This would coordinate with ResourceManager to perform actual remediation
    // For now, simulate success
    console.log(`Performing remediation for leak: ${leak.id}`);
    return true;
  }

  private markLeakAsResolved(leakId: string, method: string): void {
    const leak =
      this.suspectedLeaks.get(leakId) || this.confirmedLeaks.get(leakId);
    if (!leak) return;

    leak.remediationSuccess = true;
    this.suspectedLeaks.delete(leakId);
    this.confirmedLeaks.delete(leakId);
    this.resolvedLeaks.set(leakId, leak);
    this.metrics.leaksResolved++;

    this.emit('leakResolved', leakId, method);
  }

  private adjustScanningFrequency(factor: number): void {
    this.config.scanning.interval *= factor;
    this.config.scanning.deepScanInterval *= factor;

    // Restart timers with new intervals
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = window.setInterval((): void => {
        void this.performScan(false);
      }, this.config.scanning.interval);
    }
  }

  private async performEmergencyCleanup(): Promise<void> {
    // Force remediation of all critical leaks
    const criticalLeaks = Array.from(this.confirmedLeaks.values()).filter(
      (leak) => leak.severity === 'critical',
    );

    for (const leak of criticalLeaks) {
      await this.remediateLeak(leak.id, true);
    }
  }

  private startBackgroundDetection(): void {
    if (!this.config.scanning.backgroundScanning) return;

    // Regular scan timer
    this.scanTimer = window.setInterval((): void => {
      this.performScan(false);
    }, this.config.scanning.interval);

    // Deep scan timer
    this.deepScanTimer = window.setInterval((): void => {
      this.performScan(true);
    }, this.config.scanning.deepScanInterval);

    // Cleanup timer for resolved leaks
    this.cleanupTimer = window.setInterval((): void => {
      const cutoff = Date.now() - 3600000; // 1 hour
      const resolvedLeaksArray = Array.from(this.resolvedLeaks.entries());
      for (const [id, leak] of resolvedLeaksArray) {
        if (leak.detectedAt < cutoff) {
          this.resolvedLeaks.delete(id);
        }
      }
    }, 300000); // Every 5 minutes
  }

  private emit<K extends keyof MemoryLeakDetectorEvents>(
    event: K,
    ...args: Parameters<MemoryLeakDetectorEvents[K]>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          (handler as any)(...args);
        } catch (error) {
          console.error(
            `Error in MemoryLeakDetector event handler for ${event}:`,
            error,
          );
        }
      });
    }
  }

  // Getter methods
  public getMetrics() {
    return { ...this.metrics };
  }

  public getConfig(): LeakDetectorConfig {
    return { ...this.config };
  }

  public isInitialized(): boolean {
    return this.isRunning;
  }

  private async checkForNewLeaks(): Promise<void> {
    try {
      const report = await this.performScan(false);
      this.emit('scanCompleted', report);
    } catch (error) {
      console.error('Error during leak detection scan:', error);
    }
  }

  public isLeakConfirmed(resourceId: string): SuspectedLeak | null {
    const suspectedLeak = this.suspectedLeaks.get(resourceId);
    if (!suspectedLeak) return null;

    // For now, simple confidence-based confirmation
    if (suspectedLeak.confidence > 0.8) {
      return suspectedLeak;
    }

    return null;
  }

  private doesMatchPattern(
    resource: any,
    _pattern: MemoryLeakPattern,
  ): boolean {
    // Simple pattern matching - would be more sophisticated in real implementation
    return resource && typeof resource === 'object';
  }
}
