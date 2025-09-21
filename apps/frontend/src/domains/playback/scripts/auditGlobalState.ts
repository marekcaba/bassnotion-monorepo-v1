#!/usr/bin/env node
/**
 * Global State Audit Script
 * Story 3.18.3: Global State Elimination
 *
 * This script audits the playback domain for any global state patterns
 * and window.* pollution to ensure clean architecture.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { createStructuredLogger } from '../modules/shared/index.js';

// Patterns to search for
const GLOBAL_STATE_PATTERNS = [
  /\(window\s+as\s+any\)\.\w+\s*=/, // (window as any).something =
  /window\.\w+\s*=/, // window.something =
  /globalThis\.\w+\s*=/, // globalThis.something =
  /global\.\w+\s*=/, // global.something =
  /ToneSingleton/, // Legacy ToneSingleton reference
  /ToneInstanceId/, // Legacy ToneInstanceId reference
  /window\.AudioContext\s*=/, // Modifying AudioContext
  /window\.webkitAudioContext\s*=/, // Modifying webkitAudioContext
];

// Files/directories to exclude from audit
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.test\./,
  /\.spec\./,
  /\.d\.ts$/,
  /auditGlobalState\.ts$/, // Exclude this script itself
];

interface AuditResult {
  file: string;
  line: number;
  pattern: string;
  code: string;
}

/**
 * Recursively get all TypeScript/JavaScript files in a directory
 */
const logger = createStructuredLogger('AuditGlobalState');

function getAllFiles(dir: string): string[] {
  const files: string[] = [];

  function walkDir(currentPath: string) {
    const entries = readdirSync(currentPath);

    for (const entry of entries) {
      const fullPath = join(currentPath, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip excluded directories
        if (!EXCLUDE_PATTERNS.some((pattern) => pattern.test(fullPath))) {
          walkDir(fullPath);
        }
      } else if (stat.isFile()) {
        const ext = extname(fullPath);
        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
          // Skip excluded files
          if (!EXCLUDE_PATTERNS.some((pattern) => pattern.test(fullPath))) {
            files.push(fullPath);
          }
        }
      }
    }
  }

  walkDir(dir);
  return files;
}

/**
 * Audit a file for global state patterns
 */
function auditFile(filePath: string): AuditResult[] {
  const results: AuditResult[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Skip comments
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) {
      return;
    }

    // Check each pattern
    GLOBAL_STATE_PATTERNS.forEach((pattern) => {
      if (pattern.test(line)) {
        // Special case: Allow checking for AudioContext support
        if (
          /window\.AudioContext\s*\|\|/.test(line) ||
          /typeof\s+window\.AudioContext/.test(line)
        ) {
          return; // This is just feature detection, not pollution
        }

        // Special case: Allow test mocks
        if (
          filePath.includes('__tests__') ||
          filePath.includes('.test.') ||
          filePath.includes('.spec.') ||
          filePath.includes('mock')
        ) {
          // Allow all global assignments in test files
          if (/global\.\w+\s*=/.test(line)) {
            return; // This is test setup, not pollution
          }
        }

        results.push({
          file: filePath,
          line: index + 1,
          pattern: pattern.toString(),
          code: line.trim(),
        });
      }
    });
  });

  return results;
}

/**
 * Run the audit
 */
function runAudit(baseDir: string): void {
  logger.info('🔍 Running Global State Audit...\n');
  logger.info(`Base directory: ${baseDir}\n`);

  const files = getAllFiles(baseDir);
  logger.info(`Found ${files.length} files to audit\n`);

  const allResults: AuditResult[] = [];

  files.forEach((file) => {
    const results = auditFile(file);
    allResults.push(...results);
  });

  // Report results
  if (allResults.length === 0) {
    logger.info('✅ PASS: No global state patterns found!\n');
    logger.info('The playback domain is clean of global state pollution.');
  } else {
    logger.info(
      `❌ FAIL: Found ${allResults.length} global state violations:\n`,
    );

    // Group by file
    const byFile = allResults.reduce(
      (acc, result) => {
        if (!acc[result.file]) {
          acc[result.file] = [];
        }
        const fileResults = acc[result.file];
        if (fileResults) {
          fileResults.push(result);
        }
        return acc;
      },
      {} as Record<string, AuditResult[]>,
    );

    Object.entries(byFile).forEach(([file, results]) => {
      logger.info(`\n${file}:`);
      results.forEach((result) => {
        logger.info(`  Line ${result.line}: ${result.code}`);
        logger.info(`  Pattern: ${result.pattern}`);
      });
    });

    logger.info('\n❌ Global state elimination not complete!');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const baseDir = join(__dirname, '..');
  runAudit(baseDir);
}

export { runAudit, auditFile, getAllFiles };
