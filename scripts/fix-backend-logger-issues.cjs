#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

let filesFixed = 0;
let totalFixes = 0;

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let fixCount = 0;

  // Check if file needs Inject import
  if (content.includes('@Inject(') && !content.includes('Injectable, Inject')) {
    // Find the Injectable import line
    const injectableMatch = content.match(/import\s*{\s*Injectable[^}]*}\s*from\s*['"]@nestjs\/common['"]/);
    if (injectableMatch) {
      // Add Inject to existing import
      const currentImport = injectableMatch[0];
      if (!currentImport.includes('Inject')) {
        const newImport = currentImport.replace('Injectable', 'Injectable, Inject');
        content = content.replace(currentImport, newImport);
        fixCount++;
      }
    }
  }

  // Fix logger usage without declaration
  const lines = content.split('\n');
  const newLines = [];
  let inConstructor = false;
  let inMethod = false;
  let methodIndent = '';
  let hasRequestContext = content.includes('RequestContextService');
  let hasStaticLogger = content.includes('staticLogger');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Track if we're in a constructor
    if (line.includes('constructor(')) {
      inConstructor = true;
    }
    if (inConstructor && line.includes(') {')) {
      inConstructor = false;
    }
    
    // Track if we're in a method
    if (line.match(/^\s*(async\s+)?[a-zA-Z_]\w*\s*\([^)]*\)\s*[:{]/)) {
      inMethod = true;
      methodIndent = line.match(/^\s*/)[0];
    }
    if (inMethod && line.match(/^\s*}\s*$/)) {
      inMethod = false;
    }
    
    // Check if line uses logger without declaration
    if (line.match(/^\s*logger\.(info|error|warn|debug)/) && hasRequestContext && hasStaticLogger) {
      const indent = line.match(/^\s*/)[0];
      
      // Look back to see if logger is already declared in this scope
      let needsLogger = true;
      for (let j = i - 1; j >= 0 && j > i - 20; j--) {
        if (lines[j].includes('const logger = this.requestContext')) {
          needsLogger = false;
          break;
        }
        // Stop if we hit the start of the method
        if (lines[j].match(/^\s*(async\s+)?[a-zA-Z_]\w*\s*\([^)]*\)\s*[:{]/)) {
          break;
        }
      }
      
      if (needsLogger) {
        // Add logger declaration before this line
        newLines.push(`${indent}const logger = this.requestContext?.getLogger() || this.staticLogger;`);
        newLines.push(`${indent}const correlationId = this.requestContext?.getCorrelationId();`);
        fixCount++;
      }
    }
    
    // Fix trailing commas in logger calls
    let fixedLine = line;
    fixedLine = fixedLine.replace(/,\s*,\s*{/, ', {');
    fixedLine = fixedLine.replace(/\)',\s*,/, ')",');
    if (fixedLine !== line) {
      fixCount++;
    }
    
    newLines.push(fixedLine);
  }
  
  if (fixCount > 0) {
    content = newLines.join('\n');
    fs.writeFileSync(filePath, content);
    filesFixed++;
    totalFixes += fixCount;
    console.log(`Fixed ${filePath} (${fixCount} fixes)`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('dist')) {
      walkDir(filePath);
    } else if (file.endsWith('.ts') && !file.endsWith('.spec.ts') && !file.endsWith('.test.ts')) {
      fixFile(filePath);
    }
  });
}

console.log('Fixing backend TypeScript files for logger issues...\n');

walkDir(path.join(__dirname, '../apps/backend/src'));

console.log(`\n✅ Fixed ${filesFixed} files with ${totalFixes} total fixes!`);