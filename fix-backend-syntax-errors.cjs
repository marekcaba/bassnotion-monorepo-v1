#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript files in backend
const backendDir = path.join(__dirname, 'apps/backend/src');
const files = glob.sync('**/*.ts', { cwd: backendDir, absolute: true });

let totalFixes = 0;
let filesFixed = 0;

files.forEach(file => {
  if (file.includes('.spec.ts') || file.includes('.test.ts')) return;
  
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  let fixes = 0;

  // Fix 1: Remove incorrect correlationId declarations in catch blocks
  // Pattern: const correlationId = 'some-id'; right before error logging
  content = content.replace(/const correlationId = ['"][^'"]+['"];\s*(?=this\.logger\.(error|warn))/g, () => {
    fixes++;
    return '';
  });

  // Fix 2: Fix error argument casting
  // Change: logger.error('message', error) to logger.error('message', error as Error)
  content = content.replace(/this\.logger\.(error|warn)\(([^,]+),\s*error\s*\)/g, (match, method, message) => {
    fixes++;
    return `this.logger.${method}(${message}, error as Error)`;
  });

  // Fix 3: Fix logger.log to logger.info
  content = content.replace(/this\.logger\.log\(/g, () => {
    fixes++;
    return 'this.logger.info(';
  });

  // Fix 4: Fix missing Inject import
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

  // Fix 5: Remove unused correlationId variable declarations
  // Pattern: const correlationId = ...; that's never used
  const correlationIdMatches = content.match(/const correlationId = [^;]+;/g);
  if (correlationIdMatches) {
    correlationIdMatches.forEach(match => {
      const varName = 'correlationId';
      const declarationIndex = content.indexOf(match);
      const nextUsageIndex = content.indexOf(varName, declarationIndex + match.length);
      
      // Check if it's used within the same scope (rough check - within next 500 chars)
      if (nextUsageIndex === -1 || nextUsageIndex > declarationIndex + 500) {
        content = content.replace(match, '');
        fixes++;
      }
    });
  }

  // Fix 6: Fix throw statements in catch blocks
  content = content.replace(/catch\s*\(error\)\s*{([^}]+)throw error;/g, (match, beforeThrow) => {
    fixes++;
    return `catch (error) {${beforeThrow}throw error as Error;`;
  });

  // Fix 7: Clean up empty lines created by removals
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

  // Fix 8: Fix double commas and trailing commas
  content = content.replace(/,\s*,/g, ',');
  content = content.replace(/,\s*}/g, ' }');

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    filesFixed++;
    totalFixes += fixes;
    const relPath = path.relative(backendDir, file);
    console.log(`Fixed ${fixes} issues in ${relPath}`);
  }
});

console.log(`\n✅ Fixed ${totalFixes} issues across ${filesFixed} files`);
console.log('\nNow running TypeScript check to see remaining errors...\n');