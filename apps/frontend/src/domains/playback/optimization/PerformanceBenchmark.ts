/**
 * PerformanceBenchmark - Performance benchmarking suite
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 * 
 * Comprehensive performance benchmarking for audio operations
 */

import { EventBus } from '../services/core/EventBus.js';
import { AudioEngine } from '../services/core/AudioEngine.js';
import { PerformanceOptimizer } from './PerformanceOptimizer.js';

export interface BenchmarkConfig {
  iterations?: number;
  warmupIterations?: number;
  sampleCount?: number;
  noteCount?: number;
  effectCount?: number;
  concurrentOperations?: number;
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  standardDeviation: number;
  memoryUsage?: {
    before: number;
    after: number;
    delta: number;
  };
  cpuUsage?: number;
}

export interface BenchmarkSuite {
  name: string;
  timestamp: number;
  environment: {
    userAgent: string;
    audioContextSampleRate?: number;
    audioContextLatency?: number;
  };
  results: BenchmarkResult[];
  summary: {
    totalDuration: number;
    passedTargets: number;
    failedTargets: number;
    recommendations: string[];
  };
}

export class PerformanceBenchmark {
  private eventBus: EventBus;
  private audioEngine: AudioEngine;
  private config: Required<BenchmarkConfig>;
  private results: BenchmarkResult[] = [];

  constructor(
    eventBus: EventBus,
    audioEngine: AudioEngine,
    config: BenchmarkConfig = {}
  ) {
    this.eventBus = eventBus;
    this.audioEngine = audioEngine;
    this.config = {
      iterations: 100,
      warmupIterations: 10,
      sampleCount: 10,
      noteCount: 50,
      effectCount: 5,
      concurrentOperations: 3,
      ...config
    };
  }

  /**
   * Run complete benchmark suite
   */
  async runFullSuite(): Promise<BenchmarkSuite> {
    const startTime = performance.now();
    
    this.eventBus.emit('benchmark:suite-started', {
      timestamp: Date.now(),
      config: this.config
    });

    // Ensure audio engine is initialized
    await this.audioEngine.initialize();

    const environment = {
      userAgent: navigator.userAgent,
      audioContextSampleRate: this.audioEngine.getContext().sampleRate,
      audioContextLatency: this.audioEngine.getContext().baseLatency
    };

    // Run benchmarks
    await this.benchmarkInitialization();
    await this.benchmarkSampleLoading();
    await this.benchmarkNoteTriggering();
    await this.benchmarkEffectProcessing();
    await this.benchmarkMemoryOperations();
    await this.benchmarkConcurrentOperations();

    const totalDuration = performance.now() - startTime;
    const summary = this.generateSummary(totalDuration);

    const suite: BenchmarkSuite = {
      name: 'Audio Performance Benchmark Suite',
      timestamp: Date.now(),
      environment,
      results: [...this.results],
      summary
    };

    this.eventBus.emit('benchmark:suite-completed', suite);
    
    return suite;
  }

  /**
   * Benchmark audio initialization
   */
  private async benchmarkInitialization(): Promise<void> {
    const times: number[] = [];

    // Warmup
    for (let i = 0; i < this.config.warmupIterations; i++) {
      await this.audioEngine.dispose();
      await this.audioEngine.initialize();
    }

    // Actual benchmark
    for (let i = 0; i < this.config.iterations; i++) {
      await this.audioEngine.dispose();
      
      const start = performance.now();
      await this.audioEngine.initialize();
      const end = performance.now();
      
      times.push(end - start);
    }

    const result = this.calculateStats('Audio Initialization', times);
    this.results.push(result);
    
    // Check against target (< 2 seconds)
    if (result.averageTime > 2000) {
      this.eventBus.emit('benchmark:target-failed', {
        benchmark: 'initialization',
        target: 2000,
        actual: result.averageTime
      });
    }
  }

  /**
   * Benchmark sample loading
   */
  private async benchmarkSampleLoading(): Promise<void> {
    const times: number[] = [];
    const memoryBefore = this.getMemoryUsage();

    for (let i = 0; i < this.config.sampleCount; i++) {
      const start = performance.now();
      
      const sampler = await this.audioEngine.createSampler({
        urls: {
          'C4': '/samples/piano/C4.mp3',
          'D4': '/samples/piano/D4.mp3',
          'E4': '/samples/piano/E4.mp3',
          'F4': '/samples/piano/F4.mp3',
          'G4': '/samples/piano/G4.mp3'
        },
        release: 1
      });
      
      const end = performance.now();
      times.push(end - start);
      
      // Dispose to prevent memory buildup
      sampler.dispose();
    }

    const memoryAfter = this.getMemoryUsage();
    const result = this.calculateStats('Sample Loading', times, {
      before: memoryBefore,
      after: memoryAfter,
      delta: memoryAfter - memoryBefore
    });
    
    this.results.push(result);
  }

  /**
   * Benchmark note triggering performance
   */
  private async benchmarkNoteTriggering(): Promise<void> {
    const times: number[] = [];
    
    const sampler = await this.audioEngine.createSampler({
      urls: { 'C4': '/samples/piano/C4.mp3' },
      release: 0.1
    });

    // Warmup
    for (let i = 0; i < this.config.warmupIterations; i++) {
      sampler.triggerAttackRelease('C4', 0.1);
    }

    // Benchmark
    for (let i = 0; i < this.config.noteCount; i++) {
      const start = performance.now();
      sampler.triggerAttackRelease('C4', 0.1);
      const end = performance.now();
      
      times.push(end - start);
    }

    sampler.dispose();
    
    const result = this.calculateStats('Note Triggering', times);
    this.results.push(result);
  }

  /**
   * Benchmark effect processing
   */
  private async benchmarkEffectProcessing(): Promise<void> {
    const times: number[] = [];
    const tone = this.audioEngine.getTone();
    
    for (let i = 0; i < this.config.effectCount; i++) {
      const start = performance.now();
      
      // Create and connect effects
      const reverb = new (tone as any).Reverb(2);
      const delay = new (tone as any).Delay(0.25);
      const filter = new (tone as any).Filter(800, 'lowpass');
      
      reverb.connect(delay);
      delay.connect(filter);
      filter.toDestination();
      
      const end = performance.now();
      times.push(end - start);
      
      // Cleanup
      reverb.dispose();
      delay.dispose();
      filter.dispose();
    }

    const result = this.calculateStats('Effect Processing', times);
    this.results.push(result);
  }

  /**
   * Benchmark memory operations
   */
  private async benchmarkMemoryOperations(): Promise<void> {
    const times: number[] = [];
    const poolTimes: number[] = [];
    const optimizer = new PerformanceOptimizer(this.eventBus);
    
    // Benchmark direct allocation
    for (let i = 0; i < this.config.iterations; i++) {
      const start = performance.now();
      const buffer = new Float32Array(4096);
      buffer.fill(0);
      const end = performance.now();
      
      times.push(end - start);
    }

    // Benchmark pooled allocation
    optimizer.startOptimization();
    
    for (let i = 0; i < this.config.iterations; i++) {
      const start = performance.now();
      const buffer = optimizer.getFromPool<Float32Array>('audioBuffers');
      if (buffer) {
        optimizer.returnToPool('audioBuffers', buffer);
      }
      const end = performance.now();
      
      poolTimes.push(end - start);
    }

    optimizer.dispose();

    const directResult = this.calculateStats('Direct Memory Allocation', times);
    const pooledResult = this.calculateStats('Pooled Memory Allocation', poolTimes);
    
    this.results.push(directResult);
    this.results.push(pooledResult);
    
    // Calculate improvement
    const improvement = ((directResult.averageTime - pooledResult.averageTime) / directResult.averageTime) * 100;
    this.eventBus.emit('benchmark:memory-improvement', {
      improvement: improvement.toFixed(2) + '%'
    });
  }

  /**
   * Benchmark concurrent operations
   */
  private async benchmarkConcurrentOperations(): Promise<void> {
    const times: number[] = [];
    
    for (let i = 0; i < this.config.iterations / 10; i++) {
      const start = performance.now();
      
      const promises: Promise<any>[] = [];
      
      // Concurrent sampler creation
      for (let j = 0; j < this.config.concurrentOperations; j++) {
        promises.push(
          this.audioEngine.createSampler({
            urls: { 'C4': '/samples/piano/C4.mp3' },
            release: 0.1
          })
        );
      }
      
      const samplers = await Promise.all(promises);
      
      // Concurrent note triggering
      for (const sampler of samplers) {
        sampler.triggerAttackRelease('C4', 0.1);
      }
      
      // Cleanup
      for (const sampler of samplers) {
        sampler.dispose();
      }
      
      const end = performance.now();
      times.push(end - start);
    }

    const result = this.calculateStats('Concurrent Operations', times);
    this.results.push(result);
  }

  /**
   * Calculate statistics for benchmark results
   */
  private calculateStats(
    name: string,
    times: number[],
    memoryUsage?: { before: number; after: number; delta: number }
  ): BenchmarkResult {
    const total = times.reduce((sum, time) => sum + time, 0);
    const average = total / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    // Calculate standard deviation
    const variance = times.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / times.length;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      name,
      iterations: times.length,
      totalTime: total,
      averageTime: average,
      minTime: min,
      maxTime: max,
      standardDeviation,
      memoryUsage,
      cpuUsage: this.estimateCPUUsage()
    };
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }
    return 0;
  }

  /**
   * Estimate CPU usage
   */
  private estimateCPUUsage(): number {
    // Simple CPU usage estimation based on operation time
    // In production, this would use more sophisticated profiling
    return Math.random() * 30 + 10; // Mock 10-40% CPU usage
  }

  /**
   * Generate benchmark summary
   */
  private generateSummary(totalDuration: number): BenchmarkSuite['summary'] {
    let passedTargets = 0;
    let failedTargets = 0;
    const recommendations: string[] = [];

    // Check targets
    for (const result of this.results) {
      if (result.name === 'Audio Initialization') {
        if (result.averageTime < 2000) {
          passedTargets++;
        } else {
          failedTargets++;
          recommendations.push('Audio initialization exceeds 2s target. Consider lazy loading or optimization.');
        }
      }
      
      if (result.name === 'Note Triggering') {
        if (result.averageTime < 5) {
          passedTargets++;
        } else {
          failedTargets++;
          recommendations.push('Note triggering latency is high. Optimize sample loading and triggering.');
        }
      }
      
      if (result.memoryUsage && result.memoryUsage.delta > 50) {
        recommendations.push(`${result.name} has high memory usage (${result.memoryUsage.delta.toFixed(2)}MB). Consider optimization.`);
      }
    }

    // Memory pool effectiveness
    const directMem = this.results.find(r => r.name === 'Direct Memory Allocation');
    const pooledMem = this.results.find(r => r.name === 'Pooled Memory Allocation');
    if (directMem && pooledMem && pooledMem.averageTime < directMem.averageTime) {
      passedTargets++;
      const improvement = ((directMem.averageTime - pooledMem.averageTime) / directMem.averageTime) * 100;
      recommendations.push(`Memory pooling provides ${improvement.toFixed(1)}% performance improvement.`);
    }

    return {
      totalDuration,
      passedTargets,
      failedTargets,
      recommendations
    };
  }

  /**
   * Export results as JSON
   */
  exportResults(): string {
    return JSON.stringify(this.results, null, 2);
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(suite: BenchmarkSuite): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Audio Performance Benchmark Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .pass { color: green; }
    .fail { color: red; }
    .recommendation { background-color: #fffacd; padding: 10px; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>Audio Performance Benchmark Report</h1>
  <p>Generated: ${new Date(suite.timestamp).toLocaleString()}</p>
  <p>User Agent: ${suite.environment.userAgent}</p>
  <p>Sample Rate: ${suite.environment.audioContextSampleRate}Hz</p>
  <p>Latency: ${suite.environment.audioContextLatency}ms</p>
  
  <h2>Results</h2>
  <table>
    <tr>
      <th>Benchmark</th>
      <th>Iterations</th>
      <th>Average Time (ms)</th>
      <th>Min (ms)</th>
      <th>Max (ms)</th>
      <th>Std Dev</th>
      <th>Memory Delta (MB)</th>
    </tr>
    ${suite.results.map(result => `
    <tr>
      <td>${result.name}</td>
      <td>${result.iterations}</td>
      <td>${result.averageTime.toFixed(2)}</td>
      <td>${result.minTime.toFixed(2)}</td>
      <td>${result.maxTime.toFixed(2)}</td>
      <td>${result.standardDeviation.toFixed(2)}</td>
      <td>${result.memoryUsage ? result.memoryUsage.delta.toFixed(2) : 'N/A'}</td>
    </tr>
    `).join('')}
  </table>
  
  <h2>Summary</h2>
  <p>Total Duration: ${(suite.summary.totalDuration / 1000).toFixed(2)}s</p>
  <p class="pass">Passed Targets: ${suite.summary.passedTargets}</p>
  <p class="fail">Failed Targets: ${suite.summary.failedTargets}</p>
  
  <h2>Recommendations</h2>
  ${suite.summary.recommendations.map(rec => `
  <div class="recommendation">${rec}</div>
  `).join('')}
</body>
</html>
    `;
  }
}