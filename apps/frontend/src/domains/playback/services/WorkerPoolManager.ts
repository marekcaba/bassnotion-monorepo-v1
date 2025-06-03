/**
 * WorkerPoolManager - Background Audio Processing Worker System
 *
 * Manages worker threads for background audio processing, providing:
 * - Job queuing with priority scheduling
 * - Load balancing across workers
 * - Error recovery and worker health monitoring
 * - Performance optimization for mobile devices
 *
 * Part of Story 2.1: Subtask 3.5 - Tone.js worker threads for background audio processing
 */

import {
  WorkerThreadType,
  WorkerThreadConfig,
  AudioWorkerMessage,
  WorkerMessageType,
  WorkerPool,
  WorkerInstance,
  WorkerJob,
  WorkerJobQueue,
  WorkerError,
  WorkerCapabilities,
  WorkerMetrics,
  WorkerPoolMetrics,
  BackgroundProcessingConfig,
  AudioProcessingPayload,
  MidiProcessingPayload,
  WorkerInitPayload,
} from '../types/audio.js';

export class WorkerPoolManager {
  private static instance: WorkerPoolManager;
  private pool: WorkerPool;
  private config: BackgroundProcessingConfig;
  private isInitialized = false;
  private messageId = 0;

  // Performance monitoring
  private metrics: WorkerPoolMetrics = {
    totalWorkers: 0,
    activeWorkers: 0,
    idleWorkers: 0,
    errorWorkers: 0,
    totalJobsProcessed: 0,
    totalJobsFailed: 0,
    averageProcessingTime: 0,
    queueBacklog: 0,
    memoryUsage: 0,
    cpuUsage: 0,
  };

  private constructor() {
    this.pool = {
      workers: new Map(),
      availableWorkers: new Set(),
      busyWorkers: new Set(),
      messageQueue: this.createJobQueue(),
      metrics: this.metrics,
    };

    this.config = this.getDefaultConfig();
  }

  public static getInstance(): WorkerPoolManager {
    if (!WorkerPoolManager.instance) {
      WorkerPoolManager.instance = new WorkerPoolManager();
    }
    return WorkerPoolManager.instance;
  }

  /**
   * Initialize the worker pool with specified configuration
   */
  public async initialize(
    config?: Partial<BackgroundProcessingConfig>,
  ): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.config = { ...this.config, ...config };

    if (!this.config.enableWorkerThreads) {
      console.log('Worker threads disabled in configuration');
      return;
    }

    try {
      // Check browser support
      if (!this.checkWorkerSupport()) {
        throw new Error('Worker threads not supported in this environment');
      }

      // Create workers based on configuration
      await this.createWorkerPool();

      // Start health monitoring and queue processing
      this.startHealthMonitoring();
      this.startQueueProcessor();

      this.isInitialized = true;
      console.log(
        `Worker pool initialized with ${this.pool.workers.size} workers`,
      );
    } catch (error) {
      console.error('Failed to initialize worker pool:', error);
      throw error;
    }
  }

  /**
   * Submit a job to the worker pool
   */
  public async submitJob<T = any>(
    type: WorkerMessageType,
    payload: any,
    options: {
      priority?: 'high' | 'medium' | 'low';
      timeout?: number;
      maxRetries?: number;
      transferables?: Transferable[];
      workerType?: WorkerThreadType;
    } = {},
  ): Promise<T> {
    if (!this.isInitialized) {
      throw new Error('Worker pool not initialized');
    }

    const job: WorkerJob = {
      id: this.generateJobId(),
      type,
      payload,
      priority: options.priority || 'medium',
      timeout: options.timeout || 5000,
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      createdAt: Date.now(),
      transferables: options.transferables,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      resolve: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      reject: () => {},
    };

    return new Promise<T>((resolve, reject) => {
      job.resolve = resolve;
      job.reject = reject;
      this.addJobToQueue(job);
    });
  }

  /**
   * Process audio data in background worker
   */
  public async processAudio(
    audioData: Float32Array[],
    processingType:
      | 'sequencer'
      | 'effects'
      | 'analysis'
      | 'normalization'
      | 'filtering',
    parameters?: Record<string, any>,
  ): Promise<Float32Array[]> {
    const payload: AudioProcessingPayload = {
      audioData,
      bufferSize: audioData[0]?.length || 1024,
      sampleRate: 48000,
      timestamp: Date.now(),
      processingType,
      parameters,
    };

    return this.submitJob<Float32Array[]>('process_audio', payload, {
      priority: 'high',
      transferables: audioData.map((buffer) => buffer.buffer),
      workerType: processingType === 'sequencer' ? 'sequencer' : 'audio',
    });
  }

  /**
   * Process MIDI data in background worker
   */
  public async processMidi(
    midiData: Uint8Array,
    scheduleTime: number,
    velocity = 127,
    channel = 0,
  ): Promise<void> {
    const payload: MidiProcessingPayload = {
      midiData,
      timestamp: Date.now(),
      scheduleTime,
      velocity,
      channel,
    };

    return this.submitJob<void>('process_midi', payload, {
      priority: 'high',
      transferables: [midiData.buffer],
      workerType: 'sequencer',
    });
  }

  /**
   * Get worker pool metrics
   */
  public getMetrics(): WorkerPoolMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Terminate all workers and cleanup
   */
  public async dispose(): Promise<void> {
    try {
      this.clearJobQueues();

      for (const worker of Array.from(this.pool.workers.values())) {
        await this.terminateWorker(worker);
      }

      this.pool.workers.clear();
      this.pool.availableWorkers.clear();
      this.pool.busyWorkers.clear();
      this.isInitialized = false;

      console.log('Worker pool disposed');
    } catch (error) {
      console.error('Error disposing worker pool:', error);
    }
  }

  // Private implementation methods

  private getDefaultConfig(): BackgroundProcessingConfig {
    const maxWorkers = Math.min(navigator.hardwareConcurrency || 4, 8);

    return {
      enableWorkerThreads: true,
      maxWorkerThreads: maxWorkers,
      priorityScheduling: true,
      adaptiveScaling: true,
      batteryOptimization: true,
      backgroundThrottling: true,
      workerConfigs: [
        {
          type: 'sequencer',
          name: 'MIDI Sequencer',
          priority: 'high',
          maxConcurrency: 2,
          workerScript: '/workers/sequencer-worker.js',
          transferableObjects: true,
          sharedArrayBuffer: false,
        },
        {
          type: 'audio',
          name: 'Audio Processor',
          priority: 'high',
          maxConcurrency: 2,
          workerScript: '/workers/audio-worker.js',
          transferableObjects: true,
          sharedArrayBuffer: true,
        },
        {
          type: 'effect',
          name: 'Effects Processor',
          priority: 'medium',
          maxConcurrency: 1,
          workerScript: '/workers/effects-worker.js',
          transferableObjects: true,
          sharedArrayBuffer: false,
        },
        {
          type: 'analysis',
          name: 'Audio Analyzer',
          priority: 'low',
          maxConcurrency: 1,
          workerScript: '/workers/analysis-worker.js',
          transferableObjects: true,
          sharedArrayBuffer: false,
        },
      ],
    };
  }

  private checkWorkerSupport(): boolean {
    try {
      return (
        typeof Worker !== 'undefined' &&
        typeof MessageChannel !== 'undefined' &&
        typeof ArrayBuffer !== 'undefined'
      );
    } catch {
      return false;
    }
  }

  private async createWorkerPool(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const workerConfig of this.config.workerConfigs) {
      for (let i = 0; i < workerConfig.maxConcurrency; i++) {
        promises.push(this.createWorker(workerConfig));
      }
    }

    await Promise.all(promises);
  }

  private async createWorker(config: WorkerThreadConfig): Promise<void> {
    try {
      const workerId = this.generateWorkerId(config.type);
      const worker = new Worker(config.workerScript, {
        type: 'module',
        name: `${config.name}-${workerId}`,
      });

      const workerInstance: WorkerInstance = {
        id: workerId,
        worker,
        config,
        state: 'initializing',
        capabilities: this.getWorkerCapabilities(),
        metrics: this.createWorkerMetrics(workerId, config.type),
        lastPing: Date.now(),
      };

      // Set up message handling
      this.setupWorkerMessageHandling(workerInstance);

      // Initialize worker
      await this.initializeWorker(workerInstance);

      this.pool.workers.set(workerId, workerInstance);
      this.pool.availableWorkers.add(workerId);

      console.log(`Created worker ${workerId} (${config.type})`);
    } catch (error) {
      console.error(`Failed to create worker for ${config.type}:`, error);
      throw error;
    }
  }

  private getWorkerCapabilities(): WorkerCapabilities {
    return {
      supportedMessageTypes: ['init', 'process_audio', 'process_midi'],
      maxConcurrentJobs: 4,
      transferableObjectSupport: true,
      sharedArrayBufferSupport: typeof SharedArrayBuffer !== 'undefined',
      audioWorkletSupport: false,
    };
  }

  private createWorkerMetrics(
    workerId: string,
    type: WorkerThreadType,
  ): WorkerMetrics {
    return {
      workerId,
      workerType: type,
      processingTime: 0,
      queueLength: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      errorCount: 0,
      lastActivity: Date.now(),
    };
  }

  private setupWorkerMessageHandling(workerInstance: WorkerInstance): void {
    workerInstance.worker.onmessage = (event) => {
      this.handleWorkerMessage(workerInstance, event.data);
    };

    workerInstance.worker.onerror = (error) => {
      this.handleWorkerError(workerInstance, error);
    };
  }

  private async initializeWorker(
    workerInstance: WorkerInstance,
  ): Promise<void> {
    const initPayload: WorkerInitPayload = {
      audioContextState: {
        sampleRate: 48000,
        bufferSize: 1024,
        channelCount: 2,
      },
      config: {
        masterVolume: 0.8,
        tempo: 120,
        pitch: 0,
        swingFactor: 0,
      },
      workerConfig: workerInstance.config,
    };

    const message: AudioWorkerMessage = {
      id: this.generateMessageId(),
      type: 'init',
      payload: initPayload,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(`Worker initialization timeout: ${workerInstance.id}`),
        );
      }, 10000);

      const handleInitResponse = (responseMessage: AudioWorkerMessage) => {
        if (responseMessage.type === 'init_complete') {
          clearTimeout(timeout);
          workerInstance.state = 'idle';
          resolve();
        } else if (responseMessage.type === 'error') {
          clearTimeout(timeout);
          reject(
            new Error(
              `Worker initialization failed: ${responseMessage.payload}`,
            ),
          );
        }
      };

      (workerInstance as any).initHandler = handleInitResponse;
      workerInstance.worker.postMessage(message);
    });
  }

  private handleWorkerMessage(
    workerInstance: WorkerInstance,
    message: AudioWorkerMessage,
  ): void {
    // Handle initialization response
    if (
      (workerInstance as any).initHandler &&
      (message.type === 'init_complete' || message.type === 'error')
    ) {
      (workerInstance as any).initHandler(message);
      delete (workerInstance as any).initHandler;
      return;
    }

    // Handle job completion/error
    if (message.type === 'processing_complete') {
      this.handleJobCompletion(workerInstance, message);
    } else if (message.type === 'error') {
      this.handleJobError(workerInstance, message);
    }

    workerInstance.metrics.lastActivity = Date.now();
  }

  private handleWorkerError(
    workerInstance: WorkerInstance,
    error: ErrorEvent,
  ): void {
    const workerError: WorkerError = {
      workerId: workerInstance.id,
      workerType: workerInstance.config.type,
      errorType: 'processing',
      message: error.message || 'Unknown worker error',
      timestamp: Date.now(),
      recoverable: true,
    };

    workerInstance.state = 'error';
    workerInstance.metrics.errorCount++;

    this.attemptWorkerRecovery(workerInstance, workerError);
  }

  private async attemptWorkerRecovery(
    workerInstance: WorkerInstance,
    _error: WorkerError,
  ): Promise<void> {
    try {
      this.pool.availableWorkers.delete(workerInstance.id);
      this.pool.busyWorkers.delete(workerInstance.id);
      workerInstance.worker.terminate();

      await this.createWorker(workerInstance.config);
      this.pool.workers.delete(workerInstance.id);

      console.log(`Recovered worker ${workerInstance.id}`);
    } catch (recoveryError) {
      console.error(
        `Failed to recover worker ${workerInstance.id}:`,
        recoveryError,
      );
    }
  }

  private createJobQueue(): WorkerJobQueue {
    return {
      high: [],
      medium: [],
      low: [],
      processing: new Map(),
      completed: [],
      failed: [],
    };
  }

  private addJobToQueue(job: WorkerJob): void {
    this.pool.messageQueue[job.priority].push(job);
    this.updateMetrics();
  }

  private getNextJob(): WorkerJob | null {
    for (const priority of ['high', 'medium', 'low'] as const) {
      const queue = this.pool.messageQueue[priority];
      if (queue.length > 0) {
        const job = queue.shift();
        return job ?? null;
      }
    }
    return null;
  }

  private startQueueProcessor(): void {
    const processQueue = () => {
      const availableWorker = this.getAvailableWorker();
      const nextJob = this.getNextJob();

      if (availableWorker && nextJob) {
        this.assignJobToWorker(availableWorker, nextJob);
      }

      setTimeout(processQueue, 10);
    };

    processQueue();
  }

  private getAvailableWorker(): WorkerInstance | null {
    for (const workerId of Array.from(this.pool.availableWorkers)) {
      const worker = this.pool.workers.get(workerId);
      if (worker && worker.state === 'idle') {
        return worker;
      }
    }
    return null;
  }

  private assignJobToWorker(
    workerInstance: WorkerInstance,
    job: WorkerJob,
  ): void {
    job.startedAt = Date.now();

    const message: AudioWorkerMessage = {
      id: job.id,
      type: job.type,
      payload: job.payload,
      timestamp: Date.now(),
      priority: job.priority,
      transferables: job.transferables,
    };

    this.pool.availableWorkers.delete(workerInstance.id);
    this.pool.busyWorkers.add(workerInstance.id);
    workerInstance.state = 'processing';
    this.pool.messageQueue.processing.set(job.id, job);

    setTimeout(() => {
      if (this.pool.messageQueue.processing.has(job.id)) {
        job.reject(new Error(`Job timeout: ${job.id}`));
        this.pool.messageQueue.processing.delete(job.id);
        this.pool.busyWorkers.delete(workerInstance.id);
        this.pool.availableWorkers.add(workerInstance.id);
        workerInstance.state = 'idle';
      }
    }, job.timeout);

    if (job.transferables) {
      workerInstance.worker.postMessage(message, job.transferables);
    } else {
      workerInstance.worker.postMessage(message);
    }
  }

  private handleJobCompletion(
    workerInstance: WorkerInstance,
    message: AudioWorkerMessage,
  ): void {
    const job = this.pool.messageQueue.processing.get(message.id);
    if (job) {
      job.completedAt = Date.now();
      job.resolve(message.payload);

      this.pool.messageQueue.processing.delete(message.id);
      this.pool.messageQueue.completed.push(job);
      this.metrics.totalJobsProcessed++;

      this.pool.busyWorkers.delete(workerInstance.id);
      this.pool.availableWorkers.add(workerInstance.id);
      workerInstance.state = 'idle';
    }
  }

  private handleJobError(
    workerInstance: WorkerInstance,
    message: AudioWorkerMessage,
  ): void {
    const job = this.pool.messageQueue.processing.get(message.id);
    if (job) {
      job.retryCount++;

      if (job.retryCount <= job.maxRetries) {
        this.pool.messageQueue.processing.delete(message.id);
        this.addJobToQueue(job);
      } else {
        job.reject(
          new Error(
            `Job failed after ${job.maxRetries} retries: ${message.payload}`,
          ),
        );
        this.pool.messageQueue.processing.delete(message.id);
        this.pool.messageQueue.failed.push(job);
        this.metrics.totalJobsFailed++;
      }

      this.pool.busyWorkers.delete(workerInstance.id);
      this.pool.availableWorkers.add(workerInstance.id);
      workerInstance.state = 'idle';
    }
  }

  private updateMetrics(): void {
    this.metrics.totalWorkers = this.pool.workers.size;
    this.metrics.activeWorkers = this.pool.busyWorkers.size;
    this.metrics.idleWorkers = this.pool.availableWorkers.size;
    this.metrics.queueBacklog =
      this.pool.messageQueue.high.length +
      this.pool.messageQueue.medium.length +
      this.pool.messageQueue.low.length;
    this.metrics.errorWorkers = Array.from(this.pool.workers.values()).filter(
      (worker) => worker.state === 'error',
    ).length;
  }

  private startHealthMonitoring(): void {
    setInterval(() => {
      const now = Date.now();
      const staleThreshold = 60000;

      for (const [workerId, worker] of Array.from(this.pool.workers)) {
        if (now - worker.lastPing > staleThreshold) {
          console.warn(`Worker ${workerId} appears stale, attempting recovery`);
          this.attemptWorkerRecovery(worker, {
            workerId,
            workerType: worker.config.type,
            errorType: 'timeout',
            message: 'Worker health check timeout',
            timestamp: now,
            recoverable: true,
          });
        }
      }
    }, 30000);
  }

  private async terminateWorker(workerInstance: WorkerInstance): Promise<void> {
    try {
      workerInstance.state = 'terminating';
      workerInstance.worker.postMessage({
        id: this.generateMessageId(),
        type: 'destroy',
        payload: null,
        timestamp: Date.now(),
      });

      setTimeout(() => {
        workerInstance.worker.terminate();
      }, 1000);
    } catch (error) {
      console.error(`Error terminating worker ${workerInstance.id}:`, error);
      workerInstance.worker.terminate();
    }
  }

  private clearJobQueues(): void {
    const rejectJob = (job: WorkerJob) => {
      job.reject(new Error('Worker pool shutting down'));
    };

    this.pool.messageQueue.high.forEach(rejectJob);
    this.pool.messageQueue.medium.forEach(rejectJob);
    this.pool.messageQueue.low.forEach(rejectJob);
    this.pool.messageQueue.processing.forEach(rejectJob);

    this.pool.messageQueue.high = [];
    this.pool.messageQueue.medium = [];
    this.pool.messageQueue.low = [];
    this.pool.messageQueue.processing.clear();
  }

  private generateWorkerId(type: WorkerThreadType): string {
    return `${type}-worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateJobId(): string {
    return `job-${Date.now()}-${++this.messageId}`;
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${++this.messageId}`;
  }
}
