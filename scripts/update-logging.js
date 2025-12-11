#!/usr/bin/env node

/**
 * Script to update console.log statements to use the new logger
 * Run with: node scripts/update-logging.js
 */

const fs = require('fs');
const path = require('path');

// Mapping of file patterns to logger categories
const categoryMappings = {
  UnifiedTransport: 'transport',
  AudioEngine: 'audio:engine',
  AudioEventRouter: 'audio:event',
  PatternScheduler: 'pattern:scheduler',
  ServiceRegistry: 'service:registry',
  CoreServices: 'service:init',
  ExerciseLoader: 'exercise',
  DrumInstrumentProcessor: 'audio:processor',
  BassInstrumentProcessor: 'audio:processor',
  ChordInstrumentProcessor: 'audio:processor',
  MetronomeInstrumentProcessor: 'audio:processor',
  SalamanderVelocitySampler: 'samples:detail',
  WamKeyboard: 'samples:detail',
  GlobalControls: 'ui:controls',
  MetronomeWidgetV2: 'ui:widget',
  DrummerWidgetV2: 'ui:widget',
  BassLineWidgetV2: 'ui:widget',
  HarmonyWidgetV2: 'ui:widget',
  'timing-processor': 'worklet:timing',
  AudioProvider: 'service:init',
  TransportSyncManager: 'service:init',
  toneLoader: 'audio:engine',
  useTransport: 'ui:controls',
};

// Log level patterns
const logLevelPatterns = [
  { pattern: /console\.error/g, level: 'error' },
  { pattern: /console\.warn/g, level: 'warn' },
  { pattern: /console\.log.*(?:error|fail|critical)/i, level: 'error' },
  { pattern: /console\.log.*(?:warn|warning)/i, level: 'warn' },
  { pattern: /console\.log.*(?:debug|verbose|trace)/i, level: 'debug' },
  {
    pattern: /console\.log.*(?:timing|position|frame|drift)/i,
    level: 'verbose',
  },
  { pattern: /console\.log/g, level: 'info' },
];

// Files to update
const filesToUpdate = [
  'apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts',
  'apps/frontend/src/domains/playback/services/core/AudioEngine.ts',
  'apps/frontend/src/domains/playback/services/core/AudioEventRouter.ts',
  'apps/frontend/src/domains/playback/services/core/PatternScheduler.ts',
  'apps/frontend/src/domains/playback/services/core/ServiceRegistry.ts',
  'apps/frontend/src/domains/playback/services/core/CoreServices.ts',
  'apps/frontend/src/domains/playback/services/core/ExerciseLoader.ts',
  'apps/frontend/src/domains/playback/services/core/TransportSyncManager.ts',
  'apps/frontend/src/domains/playback/services/plugins/DrumInstrumentProcessor.ts',
  'apps/frontend/src/domains/playback/services/plugins/BassInstrumentProcessor.ts',
  'apps/frontend/src/domains/playback/services/plugins/ChordInstrumentProcessor.ts',
  'apps/frontend/src/domains/playback/services/plugins/MetronomeInstrumentProcessor.ts',
  'apps/frontend/src/domains/playback/providers/AudioProvider.tsx',
  'apps/frontend/src/domains/playback/hooks/useTransport.ts',
  'apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/GlobalControls.tsx',
  'apps/frontend/src/domains/widgets/components/widgets/MetronomeWidgetV2.tsx',
  'apps/frontend/src/domains/widgets/components/widgets/DrummerWidgetV2.tsx',
  'apps/frontend/src/domains/widgets/components/widgets/BassLineWidgetV2.tsx',
  'apps/frontend/src/domains/widgets/components/widgets/HarmonyWidgetV2.tsx',
  'apps/frontend/public/worklets/timing-processor.js',
];

function getLoggerCategory(filename) {
  for (const [pattern, category] of Object.entries(categoryMappings)) {
    if (filename.includes(pattern)) {
      return category;
    }
  }
  return 'general';
}

function updateFile(filepath) {
  const fullPath = path.join(process.cwd(), filepath);

  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${filepath} - file not found`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;

  const filename = path.basename(filepath);
  const category = getLoggerCategory(filename);
  const isJavaScript = filepath.endsWith('.js');
  const isTypeScript = filepath.endsWith('.ts') || filepath.endsWith('.tsx');

  let hasLogger = false;
  let changeCount = 0;

  // Add logger import if needed (TypeScript/TSX files only)
  if (isTypeScript && !content.includes('getLogger')) {
    // Find the last import statement
    const importRegex = /^import\s+.*?;?\s*$/gm;
    let lastImportMatch;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      lastImportMatch = match;
    }

    if (lastImportMatch) {
      const insertPosition = lastImportMatch.index + lastImportMatch[0].length;
      const importStatement = `\nimport { getLogger } from '@/utils/logger.js';`;
      content =
        content.slice(0, insertPosition) +
        importStatement +
        content.slice(insertPosition);
      hasLogger = true;
    }
  }

  // Add logger instance to class if needed
  if (isTypeScript && hasLogger && !content.includes('private logger =')) {
    const classRegex = /export\s+class\s+\w+.*?\{/;
    const classMatch = content.match(classRegex);

    if (classMatch) {
      const insertPosition = classMatch.index + classMatch[0].length;
      const loggerDeclaration = `\n  private logger = getLogger('${category}');`;
      content =
        content.slice(0, insertPosition) +
        loggerDeclaration +
        content.slice(insertPosition);
    }
  }

  // Replace console.log statements
  logLevelPatterns.forEach(({ pattern, level }) => {
    if (isTypeScript && hasLogger) {
      // TypeScript: Use this.logger
      content = content.replace(pattern, `this.logger.${level}`);
    } else if (isJavaScript) {
      // JavaScript (worklet): Keep console.log but add category prefix
      content = content.replace(/console\.log\((.*?)\)/g, (match, args) => {
        return `console.log('[${category}]', ${args})`;
      });
    }

    // Count changes
    const matches = content.match(pattern);
    if (matches) {
      changeCount += matches.length;
    }
  });

  // Remove emoji prefixes (keep them in logger config instead)
  if (isTypeScript) {
    content = content.replace(
      /(['"`])[\u{1F300}-\u{1F9FF}][\u{20}-\u{7E}]*/gu,
      '$1',
    );
  }

  // Write back if changed
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content);
    console.log(`✅ Updated ${filepath} (${changeCount} changes)`);
  } else {
    console.log(`⏭️  No changes needed in ${filepath}`);
  }
}

// Main execution
console.log('🔄 Updating logging statements...\n');

filesToUpdate.forEach((file) => {
  try {
    updateFile(file);
  } catch (error) {
    console.error(`❌ Error updating ${file}:`, error.message);
  }
});

console.log('\n✅ Logging update complete!');
console.log('\nNext steps:');
console.log('1. Review the changes');
console.log('2. Fix any TypeScript errors');
console.log('3. Test the application');
console.log('4. Configure logging levels in the browser console:');
console.log('   logger.setLevel(LogLevel.WARN)');
console.log('   logger.disableCategories("timing", "transport")');
