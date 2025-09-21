/**
 * PerformanceRegressionTest - Performance regression testing
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 *
 * Automated performance regression detection
 */

import { EventBus } from '../services/core/EventBus.js';
import { BenchmarkSuite } from './PerformanceBenchmark.js';

export interface RegressionThresholds {
  initialization?: number; // % increase allowed
  sampleLoading?: number;
  noteTriggering?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  overall?: number;
}

export interface RegressionResult {
  benchmark: string;
  baseline: number;
  current: number;
  difference: number;
  percentChange: number;
  regression: boolean;
  threshold: number;
}

export interface RegressionReport {
  timestamp: number;
  baselineVersion: string;
  currentVersion: string;
  results: RegressionResult[];
  summary: {
    totalBenchmarks: number;
    regressions: number;
    improvements: number;
    stable: number;
    overallRegression: boolean;
  };
}

export class PerformanceRegressionTest {
  private eventBus: EventBus;
  private thresholds: Required<RegressionThresholds>;
  private baselineData: Map<string, BenchmarkSuite> = new Map();

  constructor(eventBus: EventBus, thresholds: RegressionThresholds = {}) {
    this.eventBus = eventBus;
    this.thresholds = {
      initialization: 10, // Allow 10% increase
      sampleLoading: 15,
      noteTriggering: 5,
      memoryUsage: 20,
      cpuUsage: 10,
      overall: 10,
      ...thresholds,
    };
  }

  /**
   * Set baseline for comparison
   */
  setBaseline(version: string, suite: BenchmarkSuite): void {
    this.baselineData.set(version, suite);
    this.eventBus.emit('regression:baseline-set', {
      version,
      timestamp: suite.timestamp,
    });
  }

  /**
   * Load baseline from storage
   */
  async loadBaseline(version: string): Promise<void> {
    try {
      const stored = localStorage.getItem(`benchmark-baseline-${version}`);
      if (stored) {
        const suite = JSON.parse(stored) as BenchmarkSuite;
        this.setBaseline(version, suite);
      }
    } catch (error) {
      this.eventBus.emit('regression:baseline-load-failed', { error });
    }
  }

  /**
   * Save baseline to storage
   */
  async saveBaseline(version: string, suite: BenchmarkSuite): Promise<void> {
    try {
      localStorage.setItem(
        `benchmark-baseline-${version}`,
        JSON.stringify(suite),
      );
      this.setBaseline(version, suite);
    } catch (error) {
      this.eventBus.emit('regression:baseline-save-failed', { error });
    }
  }

  /**
   * Run regression test against baseline
   */
  async runRegressionTest(
    baselineVersion: string,
    currentVersion: string,
    currentSuite: BenchmarkSuite,
  ): Promise<RegressionReport> {
    const baseline = this.baselineData.get(baselineVersion);
    if (!baseline) {
      throw new Error(`No baseline found for version ${baselineVersion}`);
    }

    this.eventBus.emit('regression:test-started', {
      baselineVersion,
      currentVersion,
      timestamp: Date.now(),
    });

    const results: RegressionResult[] = [];

    // Compare each benchmark
    for (const currentResult of currentSuite.results) {
      const baselineResult = baseline.results.find(
        (r) => r.name === currentResult.name,
      );

      if (baselineResult) {
        const regression = this.compareBenchmarks(
          currentResult.name,
          baselineResult.averageTime,
          currentResult.averageTime,
        );

        results.push(regression);

        // Check memory if available
        if (baselineResult.memoryUsage && currentResult.memoryUsage) {
          const memRegression = this.compareBenchmarks(
            `${currentResult.name} - Memory`,
            baselineResult.memoryUsage.delta,
            currentResult.memoryUsage.delta,
            this.thresholds.memoryUsage,
          );
          results.push(memRegression);
        }
      }
    }

    const summary = this.generateSummary(results);

    const report: RegressionReport = {
      timestamp: Date.now(),
      baselineVersion,
      currentVersion,
      results,
      summary,
    };

    this.eventBus.emit('regression:test-completed', { ...report });

    // Fail if overall regression detected
    if (summary.overallRegression) {
      this.eventBus.emit('regression:detected', {
        regressions: summary.regressions,
        report,
      });
    }

    return report;
  }

  /**
   * Compare individual benchmarks
   */
  private compareBenchmarks(
    name: string,
    baseline: number,
    current: number,
    threshold?: number,
  ): RegressionResult {
    const difference = current - baseline;
    const percentChange = (difference / baseline) * 100;

    // Determine threshold based on benchmark type
    let actualThreshold = threshold || this.thresholds.overall || 10;

    if (name.includes('Initialization')) {
      actualThreshold = this.thresholds.initialization || actualThreshold;
    } else if (name.includes('Sample Loading')) {
      actualThreshold = this.thresholds.sampleLoading || actualThreshold;
    } else if (name.includes('Note Triggering')) {
      actualThreshold = this.thresholds.noteTriggering || actualThreshold;
    }

    const regression = percentChange > actualThreshold;

    return {
      benchmark: name,
      baseline,
      current,
      difference,
      percentChange,
      regression,
      threshold: actualThreshold,
    };
  }

  /**
   * Generate regression summary
   */
  private generateSummary(
    results: RegressionResult[],
  ): RegressionReport['summary'] {
    let regressions = 0;
    let improvements = 0;
    let stable = 0;

    for (const result of results) {
      if (result.regression) {
        regressions++;
      } else if (result.percentChange < -5) {
        // 5% improvement
        improvements++;
      } else {
        stable++;
      }
    }

    // Overall regression if more than 20% of benchmarks regressed
    // or any critical benchmark (initialization, note triggering) regressed significantly
    const criticalRegression = results.some(
      (r) =>
        (r.benchmark.includes('Initialization') ||
          r.benchmark.includes('Note Triggering')) &&
        r.regression,
    );

    const overallRegression =
      criticalRegression || regressions / results.length > 0.2;

    return {
      totalBenchmarks: results.length,
      regressions,
      improvements,
      stable,
      overallRegression,
    };
  }

  /**
   * Generate regression report HTML
   */
  generateHTMLReport(report: RegressionReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Performance Regression Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .regression { background-color: #ffcccc; }
    .improvement { background-color: #ccffcc; }
    .stable { background-color: #f9f9f9; }
    .summary { margin: 20px 0; padding: 15px; background-color: #f0f0f0; }
    .pass { color: green; font-weight: bold; }
    .fail { color: red; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Performance Regression Report</h1>
  <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
  <p>Baseline Version: ${report.baselineVersion}</p>
  <p>Current Version: ${report.currentVersion}</p>
  
  <div class="summary">
    <h2>Summary</h2>
    <p>Total Benchmarks: ${report.summary.totalBenchmarks}</p>
    <p class="fail">Regressions: ${report.summary.regressions}</p>
    <p class="pass">Improvements: ${report.summary.improvements}</p>
    <p>Stable: ${report.summary.stable}</p>
    <p>Overall Status: <span class="${report.summary.overallRegression ? 'fail' : 'pass'}">
      ${report.summary.overallRegression ? 'REGRESSION DETECTED' : 'PASSED'}
    </span></p>
  </div>
  
  <h2>Detailed Results</h2>
  <table>
    <tr>
      <th>Benchmark</th>
      <th>Baseline (ms)</th>
      <th>Current (ms)</th>
      <th>Difference (ms)</th>
      <th>Change (%)</th>
      <th>Threshold (%)</th>
      <th>Status</th>
    </tr>
    ${report.results
      .map(
        (result) => `
    <tr class="${result.regression ? 'regression' : result.percentChange < -5 ? 'improvement' : 'stable'}">
      <td>${result.benchmark}</td>
      <td>${result.baseline.toFixed(2)}</td>
      <td>${result.current.toFixed(2)}</td>
      <td>${result.difference > 0 ? '+' : ''}${result.difference.toFixed(2)}</td>
      <td>${result.percentChange > 0 ? '+' : ''}${result.percentChange.toFixed(1)}%</td>
      <td>±${result.threshold}%</td>
      <td>${result.regression ? '❌ Regression' : result.percentChange < -5 ? '✅ Improved' : '➖ Stable'}</td>
    </tr>
    `,
      )
      .join('')}
  </table>
  
  <h2>Action Items</h2>
  <ul>
    ${report.results
      .filter((r) => r.regression)
      .map(
        (r) =>
          `<li>Investigate ${r.benchmark} - ${r.percentChange.toFixed(1)}% regression detected</li>`,
      )
      .join('')}
  </ul>
</body>
</html>
    `;
  }

  /**
   * Generate CI-friendly report
   */
  generateCIReport(report: RegressionReport): string {
    const lines: string[] = [];

    lines.push('=== Performance Regression Test Results ===');
    lines.push(
      `Baseline: ${report.baselineVersion} vs Current: ${report.currentVersion}`,
    );
    lines.push('');

    if (report.summary.overallRegression) {
      lines.push('❌ REGRESSION DETECTED');
    } else {
      lines.push('✅ No regressions detected');
    }

    lines.push('');
    lines.push(`Regressions: ${report.summary.regressions}`);
    lines.push(`Improvements: ${report.summary.improvements}`);
    lines.push(`Stable: ${report.summary.stable}`);
    lines.push('');

    if (report.summary.regressions > 0) {
      lines.push('Failed benchmarks:');
      report.results
        .filter((r) => r.regression)
        .forEach((r) => {
          lines.push(
            `  - ${r.benchmark}: ${r.percentChange.toFixed(1)}% regression (threshold: ${r.threshold}%)`,
          );
        });
    }

    return lines.join('\n');
  }

  /**
   * Export results for CI integration
   */
  exportForCI(report: RegressionReport): {
    passed: boolean;
    metrics: Record<string, number>;
    failures: string[];
  } {
    const metrics: Record<string, number> = {};
    const failures: string[] = [];

    report.results.forEach((result) => {
      metrics[result.benchmark] = result.current;

      if (result.regression) {
        failures.push(
          `${result.benchmark}: ${result.percentChange.toFixed(1)}% regression`,
        );
      }
    });

    return {
      passed: !report.summary.overallRegression,
      metrics,
      failures,
    };
  }
}
