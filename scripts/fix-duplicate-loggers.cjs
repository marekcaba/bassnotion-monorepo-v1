#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

let filesFixed = 0;
let totalFixes = 0;

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let fixCount = 0;

  // Split into lines for processing
  const lines = content.split('\n');
  const newLines = [];
  let skipNext = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    
    const line = lines[i];
    const nextLine = lines[i + 1];
    
    // Check for duplicate logger declarations
    if (line.includes('const logger = this.requestContext?.getLogger()') && 
        nextLine && nextLine.includes('const logger = this.requestContext?.getLogger()')) {
      // Skip the duplicate
      newLines.push(line);
      if (nextLine.includes('const correlationId = this.requestContext?.getCorrelationId()')) {
        skipNext = true;
      }
      i++; // Skip the duplicate logger line
      fixCount++;
      continue;
    }
    
    // Check for duplicate correlationId declarations
    if (line.includes('const correlationId = this.requestContext?.getCorrelationId()') && 
        nextLine && nextLine.includes('const correlationId = this.requestContext?.getCorrelationId()')) {
      // Keep the first one, skip the duplicate
      newLines.push(line);
      i++; // Skip the duplicate
      fixCount++;
      continue;
    }
    
    newLines.push(line);
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

console.log('Fixing duplicate logger declarations...\n');

walkDir(path.join(__dirname, '../apps/backend/src'));

console.log(`\n✅ Fixed ${filesFixed} files with ${totalFixes} total fixes!`);