#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// Find all TypeScript files in backend
const backendDir = path.join(__dirname, 'apps/backend/src');
const files = glob.sync('**/*.ts', { cwd: backendDir, absolute: true });

let totalFixes = 0;
let filesFixed = 0;
const fixesByType = {
  duplicateDeclarations: 0,
  loggerLog: 0,
  errorCasting: 0,
  correlationIdUsage: 0,
  unusedImports: 0,
  missingInject: 0
};

// Helper function to check if we're in a catch block
function isInCatchBlock(content, position) {
  const before = content.substring(Math.max(0, position - 500), position);
  return before.lastIndexOf('} catch (error)') > before.lastIndexOf('} catch');
}

// Helper function to find the function/method scope
function getFunctionScope(content, position) {
  let braceCount = 0;
  let startPos = position;
  
  // Go backwards to find the opening of the function
  for (let i = position; i >= 0; i--) {
    if (content[i] === '}') braceCount++;
    if (content[i] === '{') {
      braceCount--;
      if (braceCount === -1) {
        startPos = i;
        break;
      }
    }
  }
  
  // Find the end of the function
  braceCount = 0;
  let endPos = position;
  for (let i = startPos; i < content.length; i++) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        endPos = i + 1;
        break;
      }
    }
  }
  
  return { start: startPos, end: endPos };
}

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

  // Fix 1: Remove duplicate logger/correlationId declarations within same function
  // This is the most complex fix - we need to ensure we only remove truly duplicate declarations
  const functionPattern = /(async\s+)?(\w+)\s*\([^)]*\)\s*(:[\s\S]*?)?\s*{([\s\S]*?)^}/gm;
  content = content.replace(functionPattern, (match, async, funcName, returnType, body) => {
    let modifiedBody = body;
    let loggerDeclarations = [];
    let correlationDeclarations = [];
    
    // Find all logger declarations in this function
    const loggerRegex = /const logger = this\.requestContext\?\.getLogger\(\) \|\| this\.staticLogger;/g;
    const correlationRegex = /const correlationId = this\.requestContext\?\.getCorrelationId\(\);/g;
    
    let loggerMatch;
    while ((loggerMatch = loggerRegex.exec(body)) !== null) {
      loggerDeclarations.push(loggerMatch.index);
    }
    let correlationMatch;
    while ((correlationMatch = correlationRegex.exec(body)) !== null) {
      correlationDeclarations.push(correlationMatch.index);
    }
    
    // If we have more than one declaration, keep only the first
    if (loggerDeclarations.length > 1) {
      // Remove subsequent declarations
      for (let i = loggerDeclarations.length - 1; i > 0; i--) {
        const startIndex = loggerDeclarations[i];
        const endIndex = body.indexOf(';', startIndex) + 1;
        const beforeDecl = body.substring(0, startIndex).trimEnd();
        const afterDecl = body.substring(endIndex);
        modifiedBody = beforeDecl + afterDecl;
        fixes++;
        fixesByType.duplicateDeclarations++;
      }
    }
    
    if (correlationDeclarations.length > 1) {
      // Remove subsequent declarations
      for (let i = correlationDeclarations.length - 1; i > 0; i--) {
        const startIndex = correlationDeclarations[i];
        const endIndex = body.indexOf(';', startIndex) + 1;
        const beforeDecl = body.substring(0, startIndex).trimEnd();
        const afterDecl = body.substring(endIndex);
        modifiedBody = beforeDecl + afterDecl;
        fixes++;
        fixesByType.duplicateDeclarations++;
      }
    }
    
    const params = match.substring(match.indexOf('(') + 1, match.lastIndexOf(')'));
    return `${async || ''}${funcName}(${params})${returnType || ''} {${modifiedBody}}`;
  });

  // Fix 2: Replace logger.log with logger.info
  content = content.replace(/(\s+)(this\.)?logger\.log\(/g, (match, whitespace, thisPrefix) => {
    fixes++;
    fixesByType.loggerLog++;
    return `${whitespace}${thisPrefix || ''}logger.info(`;
  });

  // Fix 3: Fix error casting in logger.error calls
  // Pattern: logger.error('message', error) → logger.error('message', error as Error)
  content = content.replace(/logger\.error\(([^,]+),\s*error\s*\)/g, (match, message) => {
    fixes++;
    fixesByType.errorCasting++;
    return `logger.error(${message}, error as Error)`;
  });

  // Fix 4: Fix correlationId usage in logger calls
  // Pattern: logger.method('message', { correlationId }) - ensure correlationId is used correctly
  content = content.replace(/logger\.(debug|info|warn|error)\(([^)]+)\)(?!\s*{)/g, (match, method, args) => {
    // Check if correlationId is declared in scope
    const functionScope = getFunctionScope(content, content.indexOf(match));
    const scopeContent = content.substring(functionScope.start, functionScope.end);
    
    if (scopeContent.includes('const correlationId') && !args.includes('correlationId')) {
      // Only add correlationId if it's a simple message (not already an object)
      const argsArray = args.split(',').map(a => a.trim());
      if (argsArray.length === 1 && !args.includes('{')) {
        fixes++;
        fixesByType.correlationIdUsage++;
        return `logger.${method}(${args}, { correlationId })`;
      }
    }
    return match;
  });

  // Fix 5: Add missing Inject import when @Inject is used
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
        fixesByType.missingInject++;
      }
    }
  }

  // Fix 6: Fix error casting in catch blocks with throw
  content = content.replace(/catch\s*\(error\)\s*{([^}]*?)throw error;/g, (match, beforeThrow) => {
    if (!beforeThrow.includes('error as Error')) {
      fixes++;
      fixesByType.errorCasting++;
      return `catch (error) {${beforeThrow}throw error as Error;`;
    }
    return match;
  });

  // Fix 7: Clean up multiple empty lines
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

  // Only write if changes were made
  if (content !== originalContent) {
    if (!DRY_RUN) {
      fs.writeFileSync(file, content);
    }
    filesFixed++;
    totalFixes += fixes;
    const relPath = path.relative(backendDir, file);
    console.log(`${DRY_RUN ? '[DRY RUN] Would fix' : 'Fixed'} ${fixes} issues in ${relPath}`);
    if (VERBOSE) {
      console.log(`  - Duplicate declarations: ${fixesByType.duplicateDeclarations}`);
      console.log(`  - logger.log → logger.info: ${fixesByType.loggerLog}`);
      console.log(`  - Error casting: ${fixesByType.errorCasting}`);
      console.log(`  - CorrelationId usage: ${fixesByType.correlationIdUsage}`);
      console.log(`  - Missing Inject imports: ${fixesByType.missingInject}`);
    }
  }
});

console.log('\n' + '='.repeat(50));
console.log(`${DRY_RUN ? 'DRY RUN SUMMARY:' : 'SUMMARY:'}`);
console.log('='.repeat(50));
console.log(`Total files ${DRY_RUN ? 'that would be' : ''} modified: ${filesFixed}`);
console.log(`Total fixes ${DRY_RUN ? 'that would be' : ''} applied: ${totalFixes}`);
console.log('\nFixes by type:');
console.log(`  - Duplicate declarations: ${fixesByType.duplicateDeclarations}`);
console.log(`  - logger.log → logger.info: ${fixesByType.loggerLog}`);
console.log(`  - Error casting: ${fixesByType.errorCasting}`);
console.log(`  - CorrelationId usage: ${fixesByType.correlationIdUsage}`);
console.log(`  - Missing Inject imports: ${fixesByType.missingInject}`);

if (DRY_RUN) {
  console.log('\nThis was a dry run. To apply changes, run without --dry-run flag.');
} else {
  console.log('\n✅ Fixes applied successfully!');
  console.log('\nNext steps:');
  console.log('1. Run: cd apps/backend && pnpm tsc --noEmit');
  console.log('2. Check for any remaining errors');
  console.log('3. Test the application');
}