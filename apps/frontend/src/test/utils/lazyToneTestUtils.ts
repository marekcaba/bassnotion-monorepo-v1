/**
 * Lazy Tone.js Migration Test Utilities
 *
 * Used to verify that files converted from static to dynamic Tone.js imports
 * still work correctly.
 *
 * Test Strategy:
 * 1. Verify module can be imported without errors
 * 2. Verify getTone() returns valid Tone instance
 * 3. Verify key Tone.js operations work (Transport, Sampler, etc.)
 * 4. Verify no circular dependencies introduced
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// The centralized lazy loader
import { getTone } from '@/domains/playback/utils/tone';

/**
 * Verify a module that uses lazy Tone.js imports works correctly
 */
export async function verifyLazyToneModule<T>(
  modulePath: string,
  importFn: () => Promise<T>,
  verifyFn: (module: T, Tone: any) => Promise<void>
): Promise<{ success: boolean; error?: Error; timings: ModuleTimings }> {
  const timings: ModuleTimings = {
    importStart: 0,
    importEnd: 0,
    toneLoadStart: 0,
    toneLoadEnd: 0,
    verifyStart: 0,
    verifyEnd: 0,
  };

  try {
    // 1. Import the module
    timings.importStart = performance.now();
    const module = await importFn();
    timings.importEnd = performance.now();

    // 2. Load Tone.js
    timings.toneLoadStart = performance.now();
    const Tone = await getTone();
    timings.toneLoadEnd = performance.now();

    // 3. Run verification
    timings.verifyStart = performance.now();
    await verifyFn(module, Tone);
    timings.verifyEnd = performance.now();

    return { success: true, timings };
  } catch (error) {
    return {
      success: false,
      error: error as Error,
      timings,
    };
  }
}

export interface ModuleTimings {
  importStart: number;
  importEnd: number;
  toneLoadStart: number;
  toneLoadEnd: number;
  verifyStart: number;
  verifyEnd: number;
}

/**
 * Test that Tone.Transport operations work after lazy loading
 */
export async function verifyTransportOperations(): Promise<boolean> {
  const Tone = await getTone();

  // Test basic Transport operations
  const originalBpm = Tone.Transport.bpm.value;
  Tone.Transport.bpm.value = 120;

  // Test position
  Tone.Transport.position = '0:0:0';

  // Test state
  const state = Tone.Transport.state;

  // Restore
  Tone.Transport.bpm.value = originalBpm;

  return state === 'stopped' || state === 'started' || state === 'paused';
}

/**
 * Test that Tone audio nodes can be created after lazy loading
 */
export async function verifyAudioNodeCreation(): Promise<boolean> {
  const Tone = await getTone();

  // These should not throw
  const gain = new Tone.Gain(0.5);
  const panner = new Tone.Panner(0);

  // Cleanup
  gain.dispose();
  panner.dispose();

  return true;
}

/**
 * Helper to wrap a test file's verification
 */
export function createLazyToneTestSuite(
  suiteName: string,
  tests: Array<{
    name: string;
    test: () => Promise<void>;
  }>
) {
  describe(`Lazy Tone.js: ${suiteName}`, () => {
    let Tone: any;

    beforeEach(async () => {
      Tone = await getTone();
    });

    afterEach(() => {
      // Cleanup Transport
      if (Tone?.Transport) {
        Tone.Transport.stop();
        Tone.Transport.cancel();
      }
    });

    tests.forEach(({ name, test }) => {
      it(name, test);
    });
  });
}

/**
 * Quick verification that a converted file exports correctly
 */
export async function quickVerifyExports(
  modulePath: string,
  expectedExports: string[]
): Promise<{ valid: boolean; missing: string[]; found: string[] }> {
  const module = await import(modulePath);
  const found: string[] = [];
  const missing: string[] = [];

  for (const exp of expectedExports) {
    if (exp in module) {
      found.push(exp);
    } else {
      missing.push(exp);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    found,
  };
}

/**
 * Batch verification helper - run all file verifications
 */
export async function batchVerifyLazyToneFiles(
  files: Array<{
    path: string;
    expectedExports: string[];
    customVerify?: (module: any, Tone: any) => Promise<void>;
  }>
): Promise<BatchVerificationResult> {
  const results: FileVerificationResult[] = [];
  let passCount = 0;
  let failCount = 0;

  for (const file of files) {
    const startTime = performance.now();
    try {
      // Verify exports
      const exportResult = await quickVerifyExports(
        file.path,
        file.expectedExports
      );

      if (!exportResult.valid) {
        results.push({
          path: file.path,
          success: false,
          error: `Missing exports: ${exportResult.missing.join(', ')}`,
          duration: performance.now() - startTime,
        });
        failCount++;
        continue;
      }

      // Run custom verification if provided
      if (file.customVerify) {
        const module = await import(file.path);
        const Tone = await getTone();
        await file.customVerify(module, Tone);
      }

      results.push({
        path: file.path,
        success: true,
        duration: performance.now() - startTime,
      });
      passCount++;
    } catch (error) {
      results.push({
        path: file.path,
        success: false,
        error: (error as Error).message,
        duration: performance.now() - startTime,
      });
      failCount++;
    }
  }

  return {
    results,
    summary: {
      total: files.length,
      passed: passCount,
      failed: failCount,
    },
  };
}

export interface FileVerificationResult {
  path: string;
  success: boolean;
  error?: string;
  duration: number;
}

export interface BatchVerificationResult {
  results: FileVerificationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

/**
 * Console reporter for batch verification
 */
export function reportBatchVerification(result: BatchVerificationResult): void {
  console.log('\n========================================');
  console.log('  LAZY TONE.JS MIGRATION VERIFICATION  ');
  console.log('========================================\n');

  for (const file of result.results) {
    const status = file.success ? '✅' : '❌';
    const time = `${file.duration.toFixed(1)}ms`;
    console.log(`${status} ${file.path} (${time})`);
    if (file.error) {
      console.log(`   └─ Error: ${file.error}`);
    }
  }

  console.log('\n----------------------------------------');
  console.log(
    `Total: ${result.summary.total} | ` +
      `Passed: ${result.summary.passed} | ` +
      `Failed: ${result.summary.failed}`
  );
  console.log('========================================\n');
}
