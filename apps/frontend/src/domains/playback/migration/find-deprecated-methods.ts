#!/usr/bin/env node
/**
 * Script to find and analyze deprecated methods in the codebase
 * Phase 6.2.2: Remove deprecated methods
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

interface DeprecatedItem {
  file: string;
  line: number;
  type: 'method' | 'function' | 'class' | 'property' | 'hook' | 'provider';
  name: string;
  reason: string;
  replacement?: string;
  usageCount?: number;
}

const deprecatedItems: DeprecatedItem[] = [];

// Find all deprecated items
console.log('🔍 Finding deprecated items in playback domain...\n');

const grepResult = execSync(
  'grep -rn "@deprecated\\|DEPRECATED\\|deprecated" apps/frontend/src/domains/playback --include="*.ts" --include="*.tsx" | grep -v "__tests__" | grep -v ".test." | grep -v "orphaned" || true',
  { encoding: 'utf-8' },
);

const lines = grepResult.split('\n').filter((line) => line.trim());

// Analyze each deprecated item
lines.forEach((line) => {
  const match = line.match(/^([^:]+):(\d+):(.*)$/);
  if (!match) return;

  const [, file, lineNum, content] = match;

  // Skip migration files and docs
  if (file.includes('migration/') || file.includes('.md')) return;

  // Parse the content to extract deprecation info
  let item: DeprecatedItem | null = null;

  // Check for ToneProvider
  if (file.includes('ToneProvider.tsx')) {
    if (!deprecatedItems.find((i) => i.name === 'ToneProvider')) {
      item = {
        file,
        line: parseInt(lineNum),
        type: 'provider',
        name: 'ToneProvider',
        reason: 'Replaced by AudioProvider with CoreServices',
        replacement: 'AudioProvider',
      };
    }
  }

  // Check for deprecated hooks
  if (content.includes('useTone') && content.includes('deprecated')) {
    item = {
      file,
      line: parseInt(lineNum),
      type: 'hook',
      name: 'useTone',
      reason: 'Legacy Tone.js hook',
      replacement: 'useAudioEngine',
    };
  }

  // Check for deprecated globals
  if (content.includes('__preloadedDrumPads')) {
    item = {
      file,
      line: parseInt(lineNum),
      type: 'property',
      name: 'window.__preloadedDrumPads',
      reason: 'Global state anti-pattern',
      replacement: 'GlobalSampleCache',
    };
  }

  // Check for deprecated functions
  if (content.includes('restoreAudioContext')) {
    item = {
      file,
      line: parseInt(lineNum),
      type: 'function',
      name: 'restoreAudioContext',
      reason: 'Legacy audio context management',
      replacement: 'AudioEngine',
    };
  }

  // Check for deprecated engine
  if (content.includes('useCorePlaybackEngine')) {
    item = {
      file,
      line: parseInt(lineNum),
      type: 'hook',
      name: 'useCorePlaybackEngine',
      reason: 'Replaced by modular services',
      replacement: 'useCoreServices',
    };
  }

  if (item && !deprecatedItems.find((i) => i.name === item.name)) {
    deprecatedItems.push(item);
  }
});

// Count usage of each deprecated item
console.log('📊 Counting usage of deprecated items...\n');

deprecatedItems.forEach((item) => {
  try {
    const searchTerm = item.name.replace('window.', '').replace('()', '');
    const usageCmd = `grep -r "${searchTerm}" apps/frontend/src --include="*.ts" --include="*.tsx" | grep -v "deprecated" | wc -l`;
    const count = parseInt(execSync(usageCmd, { encoding: 'utf-8' }).trim());
    item.usageCount = count;
  } catch {
    item.usageCount = 0;
  }
});

// Generate report
console.log('## Deprecated Items Report\n');
console.log(`Found ${deprecatedItems.length} deprecated items\n`);

// Group by type
const byType = deprecatedItems.reduce(
  (acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  },
  {} as Record<string, DeprecatedItem[]>,
);

Object.entries(byType).forEach(([type, items]) => {
  console.log(`### ${type.charAt(0).toUpperCase() + type.slice(1)}s\n`);

  items.forEach((item) => {
    console.log(`#### ${item.name}`);
    console.log(`- File: ${item.file}:${item.line}`);
    console.log(`- Reason: ${item.reason}`);
    console.log(`- Replacement: ${item.replacement || 'None specified'}`);
    console.log(`- Current usage: ${item.usageCount || 0} references`);
    console.log(
      `- Safe to remove: ${item.usageCount === 0 ? '✅ Yes' : '❌ No - still in use'}`,
    );
    console.log();
  });
});

// Summary and recommendations
console.log('## Summary\n');
const safeToRemove = deprecatedItems.filter((i) => (i.usageCount || 0) === 0);
const stillInUse = deprecatedItems.filter((i) => (i.usageCount || 0) > 0);

console.log(`- ${safeToRemove.length} items safe to remove (no usage)`);
console.log(`- ${stillInUse.length} items still in use`);

console.log('\n## Recommendations\n');
console.log('1. **Safe to remove now:**');
safeToRemove.forEach((item) => {
  console.log(`   - ${item.name} in ${item.file}`);
});

console.log('\n2. **Need migration first:**');
stillInUse.forEach((item) => {
  console.log(
    `   - ${item.name} (${item.usageCount} usages) → ${item.replacement}`,
  );
});

console.log('\n3. **Priority order:**');
console.log('   1. Remove unused deprecated items');
console.log('   2. Update ToneProvider usage to AudioProvider');
console.log('   3. Migrate global properties to service-based approach');
console.log('   4. Update deprecated hooks to new versions');
