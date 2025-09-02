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

console.log(`Scanning ${files.length} TypeScript files for remaining errors...\n`);

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

  // Fix 1: Remove unused correlationId declarations (TS6133)
  // Pattern: const correlationId = ...; that's only used in the declaration line
  const unusedCorrelationIdPattern = /const correlationId = this\.requestContext\?\.getCorrelationId\(\);(?![\s\S]*correlationId)/gm;
  if (content.match(unusedCorrelationIdPattern)) {
    content = content.replace(unusedCorrelationIdPattern, '');
    fixes++;
  }

  // Fix 2: Fix variables used before declaration (TS2448/TS2454)
  // This happens when logger/correlationId are used before being declared
  // Pattern: Find logger usage before declaration and move declaration up
  const methodRegex = /(async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{/g;
  let methodMatch;
  
  while ((methodMatch = methodRegex.exec(content)) !== null) {
    const methodStart = methodMatch.index;
    let braceCount = 1;
    let methodEnd = content.indexOf('{', methodStart) + 1;
    
    // Find the end of the method
    for (let i = methodEnd; i < content.length && braceCount > 0; i++) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') braceCount--;
      if (braceCount === 0) methodEnd = i;
    }
    
    const methodContent = content.substring(methodStart, methodEnd + 1);
    
    // Check if logger is used before declaration
    const firstLoggerUse = methodContent.search(/\blogger\./);
    const loggerDeclaration = methodContent.indexOf('const logger = this.requestContext?.getLogger() || this.staticLogger;');
    
    if (firstLoggerUse !== -1 && loggerDeclaration !== -1 && firstLoggerUse < loggerDeclaration) {
      // Move logger declaration to the beginning of the method
      const methodSignature = methodContent.substring(0, methodContent.indexOf('{') + 1);
      const methodBody = methodContent.substring(methodContent.indexOf('{') + 1, methodContent.lastIndexOf('}'));
      
      // Remove the logger declaration from its current position
      const newBody = methodBody.replace('const logger = this.requestContext?.getLogger() || this.staticLogger;', '');
      
      // Add it at the beginning
      const updatedMethod = methodSignature + '\n    const logger = this.requestContext?.getLogger() || this.staticLogger;' + newBody + '}';
      
      content = content.replace(methodContent, updatedMethod);
      fixes++;
    }
  }

  // Fix 3: Fix missing imports (TS2304)
  // Add missing createStructuredLogger import
  if (content.includes('createStructuredLogger') && !content.includes('import { createStructuredLogger')) {
    const contractsImport = content.match(/import\s*(?:type\s*)?{\s*([^}]+)\s*}\s*from\s*['"]@bassnotion\/contracts['"]/);
    if (contractsImport) {
      const imports = contractsImport[1].split(',').map(s => s.trim());
      if (!imports.includes('createStructuredLogger')) {
        imports.push('createStructuredLogger');
        const newImport = `import { ${imports.join(', ')} } from '@bassnotion/contracts'`;
        content = content.replace(contractsImport[0], newImport);
        fixes++;
      }
    } else {
      // Add new import after other imports
      const lastImport = content.lastIndexOf('import ');
      const endOfLastImport = content.indexOf('\n', lastImport);
      content = content.substring(0, endOfLastImport + 1) + 
                "import { createStructuredLogger } from '@bassnotion/contracts';\n" + 
                content.substring(endOfLastImport + 1);
      fixes++;
    }
  }

  // Fix 4: Fix logger initialization in constructors
  // Pattern: logger usage in constructor without proper initialization
  const constructorPattern = /constructor\s*\([^)]*\)\s*{([^}]*)}/g;
  let constructorMatch;
  
  while ((constructorMatch = constructorPattern.exec(content)) !== null) {
    const constructorBody = constructorMatch[1];
    if (constructorBody.includes('logger.') && !constructorBody.includes('const logger')) {
      // Add logger declaration at the beginning of constructor
      const newBody = '\n    const logger = this.requestContext?.getLogger() || this.staticLogger;\n    const correlationId = this.requestContext?.getCorrelationId();' + constructorBody;
      const newConstructor = constructorMatch[0].replace(constructorBody, newBody);
      content = content.replace(constructorMatch[0], newConstructor);
      fixes++;
    }
  }

  // Fix 5: Fix arguments mismatch for logger methods
  // logger.warn and logger.debug should have max 2 arguments
  const loggerCallPattern = /logger\.(warn|debug)\(([^)]+)\)/g;
  let loggerCallMatch;
  
  while ((loggerCallMatch = loggerCallPattern.exec(content)) !== null) {
    const method = loggerCallMatch[1];
    const args = loggerCallMatch[2];
    
    // Count commas to determine number of arguments
    const argCount = args.split(',').length;
    
    if (argCount > 2) {
      // Extract the message and combine rest into data object
      const argParts = args.split(',').map(a => a.trim());
      const message = argParts[0];
      const error = argParts[1];
      const data = argParts.slice(2).join(', ');
      
      const newCall = `logger.${method}(${message}, { error: ${error}, ${data.replace(/[{}]/g, '')} })`;
      content = content.replace(loggerCallMatch[0], newCall);
      fixes++;
    }
  }

  // Fix 6: Clean up empty lines
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
  console.log('3. Manual fixes may be needed for:');
  console.log('   - Complex redeclaration issues');
  console.log('   - Type mismatches that need careful review');
  console.log('   - Property access errors');
}