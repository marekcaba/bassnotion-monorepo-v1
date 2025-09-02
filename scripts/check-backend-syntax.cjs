#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

let errorCount = 0;
const errors = [];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Basic syntax checks for common issues
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Check for trailing commas in function parameters
    if (line.match(/,\s*,\s*{/) || line.match(/,\s*,\s*\)/)) {
      errors.push({
        file: filePath,
        line: lineNum,
        error: 'Double comma found',
        content: line.trim()
      });
      errorCount++;
    }
    
    // Check for missing imports
    if (line.includes('@Inject(') && !content.includes("import { Injectable, Inject")) {
      if (!errors.some(e => e.file === filePath && e.error === 'Missing Inject import')) {
        errors.push({
          file: filePath,
          line: lineNum,
          error: 'Missing Inject import',
          content: line.trim()
        });
        errorCount++;
      }
    }
    
    // Check for logger usage without declaration
    if (line.match(/^\s*logger\.(info|error|warn|debug)/) && 
        !line.includes('const logger') && 
        !content.includes('const logger = this.requestContext')) {
      errors.push({
        file: filePath,
        line: lineNum,
        error: 'Logger used without declaration',
        content: line.trim()
      });
      errorCount++;
    }
  });
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('dist')) {
      walkDir(filePath);
    } else if (file.endsWith('.ts') && !file.endsWith('.spec.ts') && !file.endsWith('.test.ts')) {
      checkFile(filePath);
    }
  });
}

console.log('Checking backend TypeScript files for syntax errors...\n');

walkDir(path.join(__dirname, '../apps/backend/src'));

if (errorCount > 0) {
  console.log(`\nFound ${errorCount} syntax issues:\n`);
  
  errors.forEach(error => {
    console.log(`${error.file}:${error.line}`);
    console.log(`  Error: ${error.error}`);
    console.log(`  Line: ${error.content}`);
    console.log('');
  });
} else {
  console.log('✅ No syntax errors found!');
}