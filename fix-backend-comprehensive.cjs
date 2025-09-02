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

  // Fix 1: Remove problematic correlationId declarations that are unused
  // This pattern catches cases where correlationId is declared but only used once in the same line
  content = content.replace(/const correlationId = this\.requestContext\?\.getCorrelationId\(\);?\s*\n(\s*)(logger\.(debug|info|warn|error)\([^)]+\);)/g, (match, indent, loggerCall) => {
    // Check if correlationId is actually used in the logger call
    if (loggerCall.includes('correlationId')) {
      // Keep it but inline it
      fixes++;
      return `${indent}${loggerCall.replace('correlationId', 'this.requestContext?.getCorrelationId()')}`;
    } else {
      // Remove the unused declaration
      fixes++;
      return `${indent}${loggerCall}`;
    }
  });

  // Fix 2: Fix error casting in catch blocks
  // Pattern: catch (error) { ... logger.error('message', error) }
  content = content.replace(/catch \(error\) \{([^}]*?)logger\.(error|warn)\(([^,]+),\s*error\s*\)/g, (match, beforeLog, method, message) => {
    fixes++;
    return `catch (error) {${beforeLog}logger.${method}(${message}, error as Error)`;
  });

  // Fix 3: Fix throw error statements in catch blocks
  content = content.replace(/catch \(error\) \{([^}]*?)throw error;/g, (match, beforeThrow) => {
    // Don't double-cast if already casted
    if (beforeThrow.includes('error as Error')) {
      return match;
    }
    fixes++;
    return `catch (error) {${beforeThrow}throw error as Error;`;
  });

  // Fix 4: Replace logger.log with logger.info
  content = content.replace(/logger\.log\(/g, () => {
    fixes++;
    return 'logger.info(';
  });

  // Fix 5: Fix missing Inject imports
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

  // Fix 6: Fix isolated modules issues with type imports
  // Pattern: import { SomeType } needs to be import type { SomeType }
  const typeOnlyImports = ['CreatorSearchParams', 'PaginationOptions', 'ValidationResult'];
  typeOnlyImports.forEach(typeName => {
    const regex = new RegExp(`import\\s*{([^}]*\\b${typeName}\\b[^}]*)}\\s*from`, 'g');
    content = content.replace(regex, (match, imports) => {
      if (!match.includes('import type')) {
        fixes++;
        return `import type {${imports}} from`;
      }
      return match;
    });
  });

  // Fix 7: Fix logger references without 'this' in class methods
  // Pattern: logger.info( should be this.logger.info( when inside a class
  if (content.includes('class ')) {
    content = content.replace(/(\s+)logger\.(info|debug|warn|error)\(/g, (match, indent, method) => {
      // Check if we're inside a class method by looking backwards
      const beforeMatch = content.substring(Math.max(0, content.indexOf(match) - 200), content.indexOf(match));
      if (beforeMatch.includes('async ') || beforeMatch.includes('private ') || beforeMatch.includes('public ')) {
        fixes++;
        return `${indent}this.logger.${method}(`;
      }
      return match;
    });
  }

  // Fix 8: Fix unused imports
  const unusedImportPatterns = [
    { import: 'crypto', pattern: /import\s+crypto\s+from\s+['"]crypto['"]/g },
  ];
  
  unusedImportPatterns.forEach(({ import: importName, pattern }) => {
    if (content.match(pattern)) {
      // Check if it's actually used (excluding the import line)
      const importMatch = content.match(pattern);
      const afterImport = content.substring(content.indexOf(importMatch[0]) + importMatch[0].length);
      if (!afterImport.includes(importName)) {
        content = content.replace(pattern, '');
        fixes++;
      }
    }
  });

  // Fix 9: Remove empty lines created by removals
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

  // Fix 10: Fix property access on logger (logger.log -> logger.info)
  content = content.replace(/this\.logger\.log\(/g, () => {
    fixes++;
    return 'this.logger.info(';
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    filesFixed++;
    totalFixes += fixes;
    const relPath = path.relative(backendDir, file);
    console.log(`Fixed ${fixes} issues in ${relPath}`);
  }
});

console.log(`\n✅ Fixed ${totalFixes} issues across ${filesFixed} files`);
console.log('\nRunning TypeScript check to count remaining errors...\n');