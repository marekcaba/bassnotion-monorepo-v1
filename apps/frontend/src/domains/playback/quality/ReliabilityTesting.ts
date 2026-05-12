/**
 * ReliabilityTesting - Audio reliability test suite
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 *
 * Validates 99%+ audio reliability across various scenarios
 */

import { EventBus } from '../services/core/EventBus.js';
import { AudioEngine } from '../services/core/AudioEngine.js';
import { ServiceRegistry } from '../services/core/ServiceRegistry.js';

export interface ReliabilityTest {
  name: string;
  description: string;
  run(): Promise<TestResult>;
}

export interface TestResult {
  test: string;
  passed: boolean;
  duration: number;
  attempts?: number;
  error?: Error;
  details?: Record<string, unknown>;
}

export interface ReliabilityReport {
  timestamp: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  reliabilityScore: number;
  testResults: TestResult[];
  browserInfo: {
    userAgent: string;
    platform: string;
    language: string;
  };
}

export class ReliabilityTesting {
  private eventBus: EventBus;
  private audioEngine: AudioEngine;
  private tests: ReliabilityTest[] = [];
  private testResults: TestResult[] = [];

  constructor(
    eventBus: EventBus,
    audioEngine: AudioEngine,
    _serviceRegistry: ServiceRegistry,
  ) {
    this.eventBus = eventBus;
    this.audioEngine = audioEngine;

    this.initializeTests();
  }

  /**
   * Initialize test suite
   */
  private initializeTests(): void {
    // Audio initialization reliability test
    this.tests.push({
      name: 'audio-initialization',
      description: 'Test AudioEngine initialization reliability',
      run: () => this.testAudioInitialization(),
    });

    // Context recovery test
    this.tests.push({
      name: 'context-recovery',
      description: 'Test AudioContext recovery from suspended state',
      run: () => this.testContextRecovery(),
    });

    // Rapid start/stop test
    this.tests.push({
      name: 'rapid-start-stop',
      description: 'Test rapid start/stop cycles',
      run: () => this.testRapidStartStop(),
    });

    // Sample loading reliability
    this.tests.push({
      name: 'sample-loading',
      description: 'Test sample loading reliability',
      run: () => this.testSampleLoading(),
    });

    // Memory pressure test
    this.tests.push({
      name: 'memory-pressure',
      description: 'Test performance under memory pressure',
      run: () => this.testMemoryPressure(),
    });

    // Concurrent operations test
    this.tests.push({
      name: 'concurrent-operations',
      description: 'Test concurrent audio operations',
      run: () => this.testConcurrentOperations(),
    });

    // Network interruption test
    this.tests.push({
      name: 'network-interruption',
      description: 'Test handling of network interruptions',
      run: () => this.testNetworkInterruption(),
    });

    // Long running stability test
    this.tests.push({
      name: 'long-running-stability',
      description: 'Test long-running stability',
      run: () => this.testLongRunningStability(),
    });
  }

  /**
   * Run all reliability tests
   */
  async runAllTests(): Promise<ReliabilityReport> {
    this.testResults = [];
    const startTime = Date.now();

    this.eventBus.emit('reliability:tests-started', {
      totalTests: this.tests.length,
      timestamp: startTime,
    });

    for (const test of this.tests) {
      try {
        const result = await test.run();
        this.testResults.push(result);

        this.eventBus.emit('reliability:test-completed', {
          test: test.name,
          result,
        });
      } catch (error) {
        this.testResults.push({
          test: test.name,
          passed: false,
          duration: 0,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    const report = this.generateReport();

    this.eventBus.emit('reliability:tests-completed', {
      report,
      duration: Date.now() - startTime,
    });

    return report;
  }

  /**
   * Test audio initialization reliability
   */
  private async testAudioInitialization(): Promise<TestResult> {
    const iterations = 10;
    let successful = 0;
    const startTime = performance.now();
    const attempts: number[] = [];

    for (let i = 0; i < iterations; i++) {
      try {
        // Create fresh instance
        const testEngine = new AudioEngine(this.eventBus);

        const initStart = performance.now();
        await testEngine.initialize();
        const initDuration = performance.now() - initStart;

        if (testEngine.isReady()) {
          successful++;
          attempts.push(initDuration);
        }

        await testEngine.dispose();

        // Small delay between iterations
        await this.delay(100);
      } catch {
        // Count failures
      }
    }

    const reliabilityRate = successful / iterations;
    const avgInitTime =
      attempts.length > 0
        ? attempts.reduce((a, b) => a + b, 0) / attempts.length
        : 0;

    return {
      test: 'audio-initialization',
      passed: reliabilityRate >= 0.99, // 99%+ success rate
      duration: performance.now() - startTime,
      details: {
        iterations,
        successful,
        reliabilityRate,
        avgInitTime,
        attempts,
      },
    };
  }

  /**
   * Test context recovery
   */
  private async testContextRecovery(): Promise<TestResult> {
    const startTime = performance.now();
    let recovered = false;

    try {
      await this.audioEngine.initialize();
      const context = this.audioEngine.getContext();

      // Simulate suspended state
      if (context.state === 'running') {
        await context.suspend();
      }

      // Test recovery
      await this.audioEngine.start();
      recovered = context.state === 'running';
    } catch {
      recovered = false;
    }

    return {
      test: 'context-recovery',
      passed: recovered,
      duration: performance.now() - startTime,
      details: {
        recovered,
        finalState: this.audioEngine.isReady()
          ? this.audioEngine.getContext().state
          : 'not-initialized',
      },
    };
  }

  /**
   * Test rapid start/stop cycles
   */
  private async testRapidStartStop(): Promise<TestResult> {
    const cycles = 20;
    let successful = 0;
    const startTime = performance.now();

    try {
      await this.audioEngine.initialize();

      for (let i = 0; i < cycles; i++) {
        await this.audioEngine.start();
        await this.delay(50);
        await this.audioEngine.stop();
        await this.delay(50);
        successful++;
      }
    } catch {
      // Count failures
    }

    return {
      test: 'rapid-start-stop',
      passed: successful === cycles,
      duration: performance.now() - startTime,
      details: {
        cycles,
        successful,
        successRate: successful / cycles,
      },
    };
  }

  /**
   * Test sample loading reliability
   */
  private async testSampleLoading(): Promise<TestResult> {
    const startTime = performance.now();
    let samplesLoaded = 0;
    const sampleTests = 5;

    try {
      await this.audioEngine.initialize();

      for (let i = 0; i < sampleTests; i++) {
        const sampler = await this.audioEngine.createSampler({
          urls: {
            C4: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAAAAA==',
          },
        });

        if (sampler) {
          samplesLoaded++;
          sampler.dispose();
        }
      }
    } catch {
      // Count failures
    }

    return {
      test: 'sample-loading',
      passed: samplesLoaded === sampleTests,
      duration: performance.now() - startTime,
      details: {
        sampleTests,
        samplesLoaded,
        successRate: samplesLoaded / sampleTests,
      },
    };
  }

  /**
   * Test memory pressure
   */
  private async testMemoryPressure(): Promise<TestResult> {
    const startTime = performance.now();
    let memoryStable = true;
    const samplers: any[] = [];

    try {
      await this.audioEngine.initialize();

      // Create multiple samplers
      for (let i = 0; i < 20; i++) {
        const sampler = await this.audioEngine.createSampler({
          urls: {
            C4: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAAAAA==',
          },
        });
        samplers.push(sampler);
      }

      // Check if still operational
      const testSampler = await this.audioEngine.createSampler({
        urls: {
          C4: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAAAAA==',
        },
      });

      if (testSampler) {
        testSampler.dispose();
      }

      // Cleanup
      samplers.forEach((s) => s.dispose());
    } catch {
      memoryStable = false;
    }

    return {
      test: 'memory-pressure',
      passed: memoryStable,
      duration: performance.now() - startTime,
      details: {
        samplersCreated: samplers.length,
        memoryStable,
      },
    };
  }

  /**
   * Test concurrent operations
   */
  private async testConcurrentOperations(): Promise<TestResult> {
    const startTime = performance.now();
    let allSuccessful = true;

    try {
      await this.audioEngine.initialize();

      // Run multiple operations concurrently
      const operations = [
        this.audioEngine.start(),
        this.audioEngine.createSampler({
          urls: {
            C4: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAAAAA==',
          },
        }),
        this.audioEngine.createSampler({
          urls: {
            D4: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAAAAA==',
          },
        }),
      ];

      const results = await Promise.allSettled(operations);
      allSuccessful = results.every((r) => r.status === 'fulfilled');

      // Cleanup samplers
      results.forEach((result, index) => {
        if (index > 0 && result.status === 'fulfilled' && result.value) {
          (result.value as any).dispose();
        }
      });
    } catch {
      allSuccessful = false;
    }

    return {
      test: 'concurrent-operations',
      passed: allSuccessful,
      duration: performance.now() - startTime,
      details: { allSuccessful },
    };
  }

  /**
   * Test network interruption handling
   */
  private async testNetworkInterruption(): Promise<TestResult> {
    const startTime = performance.now();
    let handled = true;

    try {
      await this.audioEngine.initialize();

      // Simulate network issue by trying to load non-existent resource
      try {
        await this.audioEngine.createSampler({
          baseUrl: 'https://invalid-domain-that-does-not-exist.com/',
          urls: { C4: 'sample.wav' },
        });
        handled = false; // Should have thrown
      } catch {
        // Error should be properly handled
        handled = true;
      }
    } catch {
      handled = false;
    }

    return {
      test: 'network-interruption',
      passed: handled,
      duration: performance.now() - startTime,
      details: { errorHandled: handled },
    };
  }

  /**
   * Test long-running stability
   */
  private async testLongRunningStability(): Promise<TestResult> {
    const startTime = performance.now();
    const testDuration = 5000; // 5 seconds
    let stable = true;
    let operations = 0;

    try {
      await this.audioEngine.initialize();
      const endTime = Date.now() + testDuration;

      while (Date.now() < endTime && stable) {
        try {
          // Perform various operations
          await this.audioEngine.start();
          operations++;

          if (operations % 10 === 0) {
            const sampler = await this.audioEngine.createSampler({
              urls: {
                C4: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAAAAA==',
              },
            });
            sampler.dispose();
          }

          await this.delay(100);
        } catch {
          stable = false;
        }
      }
    } catch {
      stable = false;
    }

    return {
      test: 'long-running-stability',
      passed: stable,
      duration: performance.now() - startTime,
      details: {
        stable,
        operations,
        testDuration,
      },
    };
  }

  /**
   * Generate reliability report
   */
  private generateReport(): ReliabilityReport {
    const passedTests = this.testResults.filter((r) => r.passed).length;
    const totalTests = this.testResults.length;
    const reliabilityScore =
      totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    return {
      timestamp: Date.now(),
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      reliabilityScore,
      testResults: this.testResults,
      browserInfo: {
        userAgent: navigator.userAgent,
        platform:
          navigator.userAgentData?.platform ||
          navigator.platform ||
          'unknown',
        language: navigator.language,
      },
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
