#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript files in backend
const backendDir = path.join(__dirname, 'apps/backend/src');
const files = glob.sync('**/*.ts', { cwd: backendDir, absolute: true });

let totalFixes = 0;

files.forEach(file => {
  if (file.includes('.spec.ts') || file.includes('.test.ts')) return;
  
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  let fixes = 0;

  // Fix 1: Replace logger.log with logger.info
  content = content.replace(/logger\.log\(/g, () => {
    fixes++;
    return 'logger.info(';
  });

  // Fix 2: Cast error types in catch blocks
  content = content.replace(/catch \(error\) \{/g, 'catch (error) {');
  content = content.replace(/logger\.(error|warn)\((.*?),\s*error\)/g, (match, method, message) => {
    fixes++;
    return `logger.${method}(${message}, error as Error)`;
  });

  // Fix 3: Add correlationId to logger calls where missing
  content = content.replace(/logger\.(info|error|warn|debug)\(([^,\)]+)\);/g, (match, method, message) => {
    // Check if we're in a method that has correlationId available
    const methodStart = content.lastIndexOf('async ', content.indexOf(match));
    const methodEnd = content.indexOf('{', methodStart);
    const methodSignature = content.substring(methodStart, methodEnd);
    
    if (methodSignature.includes('correlationId')) {
      fixes++;
      return `logger.${method}(${message}, { correlationId });`;
    }
    return match;
  });

  // Fix 4: Add missing @Inject import
  if (content.includes('@Inject(') && !content.includes("import { Inject")) {
    // Find existing @nestjs/common import
    const nestImportMatch = content.match(/import\s*{\s*([^}]+)\s*}\s*from\s*['"]@nestjs\/common['"]/);
    if (nestImportMatch) {
      const imports = nestImportMatch[1].split(',').map(s => s.trim());
      if (!imports.includes('Inject')) {
        imports.push('Inject');
        const newImport = `import { ${imports.join(', ')} } from '@nestjs/common'`;
        content = content.replace(nestImportMatch[0], newImport);
        fixes++;
      }
    } else {
      // Add new import at the top
      const firstImportIndex = content.indexOf('import ');
      if (firstImportIndex !== -1) {
        content = content.substring(0, firstImportIndex) + 
          "import { Inject } from '@nestjs/common';\n" + 
          content.substring(firstImportIndex);
        fixes++;
      }
    }
  }

  // Fix 5: Remove unused correlationId declarations
  content = content.replace(/const correlationId = [^;]+;\n\s*} catch/g, (match) => {
    fixes++;
    return '} catch';
  });

  // Fix 6: Fix error casting in repository files
  if (file.includes('repository.ts')) {
    content = content.replace(/throw error;/g, (match) => {
      // Check if we're in a catch block
      const lineStart = content.lastIndexOf('\n', content.indexOf(match));
      const catchIndex = content.lastIndexOf('catch', lineStart);
      if (catchIndex > lineStart - 200) { // Rough check if we're in a catch block
        fixes++;
        return 'throw error as Error;';
      }
      return match;
    });
  }

  // Fix 7: Fix double commas in import statements
  content = content.replace(/,\s*,/g, ',');
  
  // Fix 8: Remove trailing commas in import statements
  content = content.replace(/,\s*}\s*from/g, ' } from');

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    totalFixes += fixes;
    console.log(`Fixed ${fixes} issues in ${path.relative(backendDir, file)}`);
  }
});

console.log(`\nTotal fixes applied: ${totalFixes}`);