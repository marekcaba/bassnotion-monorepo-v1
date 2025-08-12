#!/usr/bin/env node
/**
 * Code quality validation script for audio domain
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 * 
 * Validates:
 * - No TODO comments for technical debt
 * - No console.error usage
 * - No 'any' types
 * - TypeScript strict mode compliance
 * - Proper error handling
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const AUDIO_DOMAIN_PATH = 'apps/frontend/src/domains/playback';
const ERROR_PATTERNS = [
  {
    pattern: /TODO.*Review non-null assertion/gi,
    message: 'Found TODO for non-null assertion review'
  },
  {
    pattern: /console\.error/g,
    message: 'Found console.error - use professional error handling instead'
  },
  {
    pattern: /: any\b/g,
    message: 'Found "any" type - use proper TypeScript types'
  },
  {
    pattern: /throw new Error\(/g,
    message: 'Found generic Error - use specific AudioError classes'
  },
  {
    pattern: /\/\/ @ts-ignore/g,
    message: 'Found @ts-ignore - fix TypeScript errors properly'
  },
  {
    pattern: /\/\/ @ts-nocheck/g,
    message: 'Found @ts-nocheck - enable TypeScript checking'
  }
];

interface ValidationResult {
  file: string;
  issues: Array<{
    line: number;
    column: number;
    message: string;
    code: string;
  }>;
}

class AudioCodeValidator {
  private results: ValidationResult[] = [];
  private totalIssues = 0;

  async validate(): Promise<void> {
    console.log('🔍 Validating audio domain code quality...\n');

    // Check TypeScript compilation
    this.checkTypeScriptCompilation();

    // Scan files for patterns
    this.scanDirectory(AUDIO_DOMAIN_PATH);

    // Report results
    this.reportResults();
  }

  private checkTypeScriptCompilation(): void {
    console.log('📋 Checking TypeScript compilation...');
    try {
      execSync(`pnpm nx run @bassnotion/frontend:typecheck`, { 
        stdio: 'pipe',
        encoding: 'utf8'
      });
      console.log('✅ TypeScript compilation passed\n');
    } catch (error) {
      console.error('❌ TypeScript compilation failed');
      if (error instanceof Error && 'stdout' in error) {
        console.error(error.stdout);
      }
      process.exit(1);
    }
  }

  private scanDirectory(dir: string): void {
    const files = readdirSync(dir);

    for (const file of files) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip test directories
        if (!file.includes('test') && !file.includes('__')) {
          this.scanDirectory(fullPath);
        }
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        // Skip test files
        if (!file.includes('.test.') && !file.includes('.spec.')) {
          this.validateFile(fullPath);
        }
      }
    }
  }

  private validateFile(filePath: string): void {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const issues: ValidationResult['issues'] = [];

    lines.forEach((line, index) => {
      ERROR_PATTERNS.forEach(({ pattern, message }) => {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          if (match.index !== undefined) {
            issues.push({
              line: index + 1,
              column: match.index + 1,
              message,
              code: line.trim()
            });
          }
        }
      });
    });

    if (issues.length > 0) {
      this.results.push({
        file: relative(process.cwd(), filePath),
        issues
      });
      this.totalIssues += issues.length;
    }
  }

  private reportResults(): void {
    if (this.results.length === 0) {
      console.log('✅ Audio domain code quality validation passed!');
      console.log('   No technical debt or code quality issues found.\n');
      return;
    }

    console.log(`\n❌ Found ${this.totalIssues} code quality issues in ${this.results.length} files:\n`);

    for (const result of this.results) {
      console.log(`📁 ${result.file}`);
      for (const issue of result.issues) {
        console.log(`   Line ${issue.line}:${issue.column} - ${issue.message}`);
        console.log(`   > ${issue.code}\n`);
      }
    }

    // Summary by issue type
    const summary = new Map<string, number>();
    for (const result of this.results) {
      for (const issue of result.issues) {
        const count = summary.get(issue.message) || 0;
        summary.set(issue.message, count + 1);
      }
    }

    console.log('\n📊 Summary by issue type:');
    for (const [message, count] of summary) {
      console.log(`   ${count} × ${message}`);
    }

    console.log('\n💡 Run "pnpm nx run @bassnotion/frontend:lint:fix" to auto-fix some issues.');
    process.exit(1);
  }
}

// Additional validation checks
async function validateErrorHandling(): Promise<void> {
  console.log('\n🔍 Validating error handling implementation...');

  const requiredErrorFiles = [
    'apps/frontend/src/domains/playback/errors/AudioErrors.ts',
    'apps/frontend/src/domains/playback/errors/ErrorHandler.ts',
    'apps/frontend/src/domains/playback/errors/ErrorRecovery.ts',
    'apps/frontend/src/domains/playback/errors/ErrorReporting.ts'
  ];

  let allFilesExist = true;
  for (const file of requiredErrorFiles) {
    try {
      statSync(file);
      console.log(`✅ ${file}`);
    } catch {
      console.log(`❌ Missing: ${file}`);
      allFilesExist = false;
    }
  }

  if (!allFilesExist) {
    console.error('\n❌ Error handling implementation incomplete');
    process.exit(1);
  }
}

async function validateReliabilityFeatures(): Promise<void> {
  console.log('\n🔍 Validating reliability features...');

  const requiredFiles = [
    'apps/frontend/src/domains/playback/quality/ReliabilityTesting.ts',
    'apps/frontend/src/domains/playback/quality/PerformanceMonitoring.ts',
    'apps/frontend/src/domains/playback/quality/BrowserCompatibility.ts',
    'apps/frontend/src/domains/playback/quality/HealthChecks.ts'
  ];

  let allFilesExist = true;
  for (const file of requiredFiles) {
    try {
      statSync(file);
      console.log(`✅ ${file}`);
    } catch {
      console.log(`❌ Missing: ${file}`);
      allFilesExist = false;
    }
  }

  if (!allFilesExist) {
    console.error('\n❌ Reliability features incomplete');
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log('🎵 BassNotion Audio Code Quality Validator\n');
  console.log('Story 3.18.5: Audio Reliability & Technical Debt Elimination\n');

  const validator = new AudioCodeValidator();
  await validator.validate();
  
  await validateErrorHandling();
  await validateReliabilityFeatures();

  console.log('\n✨ All validations passed! Audio domain meets quality standards.');
}

main().catch(error => {
  console.error('\n💥 Validation failed:', error);
  process.exit(1);
});