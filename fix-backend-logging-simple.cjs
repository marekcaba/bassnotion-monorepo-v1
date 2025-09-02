#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');

// Find all TypeScript files in backend
const backendDir = path.join(__dirname, 'apps/backend/src');
const files = glob.sync('**/*.ts', { cwd: backendDir, absolute: true });

let totalFixes = 0;
let filesFixed = 0;

console.log(`Scanning ${files.length} TypeScript files in backend...\n`);

files.forEach(file => {
  // Skip test files and example files
  if (file.includes('.spec.ts') || 
      file.includes('.test.ts') || 
      file.includes('.example.ts') ||
      file.includes('.original.ts')) {
    return;
  }
  
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  let fixes = 0;

  // Fix 1: Remove duplicate logger declarations
  // Count occurrences first
  const loggerDeclarationRegex = /const logger = this\.requestContext\?\.getLogger\(\) \|\| this\.staticLogger;/g;
  const correlationDeclarationRegex = /const correlationId = this\.requestContext\?\.getCorrelationId\(\);/g;
  
  // Process each function/method separately
  const methodRegex = /(async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{/g;
  let methodMatch;
  let methods = [];
  
  while ((methodMatch = methodRegex.exec(content)) !== null) {
    methods.push({
      start: methodMatch.index,
      end: content.length,
      name: methodMatch[2]
    });
  }
  
  // Sort methods by start position
  methods.sort((a, b) => a.start - b.start);
  
  // Update end positions
  for (let i = 0; i < methods.length - 1; i++) {
    methods[i].end = methods[i + 1].start;
  }
  
  // Process each method to remove duplicate declarations
  methods.forEach(method => {
    const methodContent = content.substring(method.start, method.end);
    
    // Find logger declarations in this method
    let loggerMatches = [];
    let match;
    const loggerRegex = /const logger = this\.requestContext\?\.getLogger\(\) \|\| this\.staticLogger;/g;
    while ((match = loggerRegex.exec(methodContent)) !== null) {
      loggerMatches.push(match.index);
    }
    
    // Find correlationId declarations in this method
    let correlationMatches = [];
    const correlationRegex = /const correlationId = this\.requestContext\?\.getCorrelationId\(\);/g;
    while ((match = correlationRegex.exec(methodContent)) !== null) {
      correlationMatches.push(match.index);
    }
    
    // Remove duplicates (keep first occurrence)
    if (loggerMatches.length > 1) {
      for (let i = loggerMatches.length - 1; i > 0; i--) {
        const declaration = 'const logger = this.requestContext?.getLogger() || this.staticLogger;';
        content = content.replace(declaration, '// Removed duplicate logger declaration');
        content = content.replace('// Removed duplicate logger declaration', ''); // Clean up
        fixes++;
      }
    }
    
    if (correlationMatches.length > 1) {
      for (let i = correlationMatches.length - 1; i > 0; i--) {
        const declaration = 'const correlationId = this.requestContext?.getCorrelationId();';
        content = content.replace(declaration, '// Removed duplicate correlationId declaration');
        content = content.replace('// Removed duplicate correlationId declaration', ''); // Clean up
        fixes++;
      }
    }
  });

  // Fix 2: Replace logger.log with logger.info
  const logCalls = content.match(/logger\.log\(/g);
  if (logCalls) {
    content = content.replace(/logger\.log\(/g, 'logger.info(');
    fixes += logCalls.length;
  }

  // Fix 3: Fix error casting in logger.error calls
  const errorLogPattern = /logger\.error\(([^,]+),\s*error\s*\)/g;
  let errorMatches = content.match(errorLogPattern);
  if (errorMatches) {
    content = content.replace(errorLogPattern, 'logger.error($1, error as Error)');
    fixes += errorMatches.length;
  }

  // Fix 4: Fix error casting in logger.error with three arguments
  const errorLog3Pattern = /logger\.error\(([^,]+),\s*error\s*,\s*{([^}]+)}\s*\)/g;
  errorMatches = content.match(errorLog3Pattern);
  if (errorMatches) {
    content = content.replace(errorLog3Pattern, 'logger.error($1, error as Error, {$2})');
    fixes += errorMatches.length;
  }

  // Fix 5: Add correlationId to logger calls where it's missing
  // Only for simple single-argument logger calls where correlationId exists in scope
  const simpleLogPattern = /logger\.(debug|info|warn)\(([^,)]+)\);/g;
  let simpleLogMatches = [...content.matchAll(simpleLogPattern)];
  
  simpleLogMatches.forEach(match => {
    const fullMatch = match[0];
    const method = match[1];
    const message = match[2];
    
    // Find the method this log call is in
    const logPosition = match.index;
    const containingMethod = methods.find(m => logPosition >= m.start && logPosition < m.end);
    
    if (containingMethod) {
      const methodContent = content.substring(containingMethod.start, containingMethod.end);
      // Check if correlationId is declared in this method
      if (methodContent.includes('const correlationId')) {
        content = content.replace(fullMatch, `logger.${method}(${message}, { correlationId });`);
        fixes++;
      }
    }
  });

  // Fix 6: Add missing Inject import
  if (content.includes('@Inject(') && !content.includes('Inject')) {
    const nestImportMatch = content.match(/import\s*{\s*([^}]+)\s*}\s*from\s*['"]@nestjs\/common['"]/);
    if (nestImportMatch) {
      const imports = nestImportMatch[1].split(',').map(s => s.trim()).filter(s => s);
      if (!imports.includes('Inject')) {
        imports.push('Inject');
        imports.sort();
        const newImport = `import { ${imports.join(', ')} } from '@nestjs/common'`;
        content = content.replace(nestImportMatch[0], newImport);
        fixes++;
      }
    }
  }

  // Fix 7: Fix throw error in catch blocks
  const throwPattern = /catch\s*\(error\)\s*{([^}]*?)throw error;/g;
  let throwMatches = content.match(throwPattern);
  if (throwMatches) {
    content = content.replace(throwPattern, (match, beforeThrow) => {
      if (!beforeThrow.includes('error as Error')) {
        fixes++;
        return `catch (error) {${beforeThrow}throw error as Error;`;
      }
      return match;
    });
  }

  // Fix 8: Clean up empty lines
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

  // Only write if changes were made
  if (content !== originalContent && fixes > 0) {
    if (!DRY_RUN) {
      fs.writeFileSync(file, content);
    }
    filesFixed++;
    totalFixes += fixes;
    const relPath = path.relative(backendDir, file);
    console.log(`${DRY_RUN ? '[DRY RUN] Would fix' : 'Fixed'} ${fixes} issues in ${relPath}`);
  }
});

console.log('\n' + '='.repeat(50));
console.log(`${DRY_RUN ? 'DRY RUN SUMMARY:' : 'SUMMARY:'}`);
console.log('='.repeat(50));
console.log(`Total files ${DRY_RUN ? 'that would be' : ''} modified: ${filesFixed}`);
console.log(`Total fixes ${DRY_RUN ? 'that would be' : ''} applied: ${totalFixes}`);

if (DRY_RUN) {
  console.log('\nThis was a dry run. To apply changes, run without --dry-run flag.');
} else {
  console.log('\n✅ Fixes applied successfully!');
  console.log('\nNext steps:');
  console.log('1. Run: cd apps/backend && pnpm tsc --noEmit');
  console.log('2. Check for any remaining errors');
  console.log('3. Test the application');
}