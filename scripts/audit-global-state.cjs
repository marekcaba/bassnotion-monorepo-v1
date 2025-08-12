#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Story 3.18.3: Global State Elimination Audit Script
// Scans for anti-patterns and verifies clean architecture

const ANTI_PATTERNS = [
  // Global state patterns
  /window\.ToneSingleton/g,
  /window\.ToneInstanceId/g,
  /window\.Tone\s*=/g,
  /global\.Tone\s*=/g,
  /\(window as any\)\.Tone/g,
  /\(global as any\)\.Tone/g,
  
  // Direct Tone imports (excluding story markers and node_modules)
  /^import\s+.*\s+from\s+['"]tone['"];?$/gm,
  /^import\s+\*\s+as\s+Tone\s+from\s+['"]tone['"];?$/gm,
  
  // AudioContext creation outside AudioEngine
  /new\s+AudioContext\(/g,
  /new\s+\(window\.AudioContext/g,
];

const ALLOWED_PATTERNS = [
  // Story markers in comments
  /\/\/.*Story\s+3\.18\.3/,
  /\/\/.*Removed.*Story\s+3\.18\.3/,
  
  // Test mocks
  /global\.__mocks__/,
  /global\.AudioContext/,
  
  // Feature flags
  /getAudioArchitectureFlags/,
  /USE_NEW_AUDIO_ENGINE/,
];

const EXCLUDED_PATHS = [
  'node_modules',
  '.next',
  'dist',
  'build',
  '.git',
  'coverage',
  'test-results',
  'playwright-report',
  'logs',
  'tmp',
  'temp',
];

const PLAYBACK_DOMAIN = path.join(__dirname, '../apps/frontend/src/domains/playback');

let violations = [];
let filesScanned = 0;
let totalViolations = 0;

function shouldExclude(filePath) {
  return EXCLUDED_PATHS.some(excluded => filePath.includes(excluded));
}

function isAllowed(line, pattern) {
  return ALLOWED_PATTERNS.some(allowed => allowed.test(line));
}

function scanFile(filePath) {
  if (shouldExclude(filePath)) return;
  
  filesScanned++;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, lineNum) => {
    ANTI_PATTERNS.forEach(pattern => {
      const matches = line.match(pattern);
      if (matches && !isAllowed(line, pattern)) {
        // Special handling for import statements
        if (pattern.toString().includes('import')) {
          // Skip if it's a comment
          if (line.trim().startsWith('//')) return;
          // Skip if it's in a string
          if (line.includes('// Removed')) return;
        }
        
        violations.push({
          file: path.relative(process.cwd(), filePath),
          line: lineNum + 1,
          pattern: pattern.toString(),
          content: line.trim(),
        });
        totalViolations++;
      }
    });
  });
}

function scanDirectory(dir) {
  if (shouldExclude(dir)) return;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  entries.forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      scanFile(fullPath);
    }
  });
}

console.log('🔍 Story 3.18.3: Global State Elimination Audit');
console.log('='.repeat(60));
console.log(`Scanning playback domain: ${PLAYBACK_DOMAIN}`);
console.log('');

// Scan the playback domain
scanDirectory(PLAYBACK_DOMAIN);

// Report results
console.log(`✅ Files scanned: ${filesScanned}`);
console.log(`${totalViolations === 0 ? '✅' : '❌'} Violations found: ${totalViolations}`);
console.log('');

if (violations.length > 0) {
  console.log('VIOLATIONS:');
  console.log('-'.repeat(60));
  
  violations.forEach(violation => {
    console.log(`📍 ${violation.file}:${violation.line}`);
    console.log(`   Pattern: ${violation.pattern}`);
    console.log(`   Content: ${violation.content}`);
    console.log('');
  });
  
  console.log('SUMMARY:');
  console.log('-'.repeat(60));
  console.log('❌ Global state elimination is NOT complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Remove all direct Tone.js imports - use ServiceAdapter.getTone()');
  console.log('2. Remove all window/global assignments');
  console.log('3. Move AudioContext creation to AudioEngine only');
  
  process.exit(1);
} else {
  console.log('🎉 SUCCESS: No global state violations found!');
  console.log('');
  console.log('✅ All Tone.js imports go through dependency injection');
  console.log('✅ No window/global state pollution');
  console.log('✅ Clean architecture maintained');
  console.log('');
  console.log('Story 3.18.3 implementation is on track! 🚀');
}