#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files to skip - these legitimately use console
const SKIP_FILES = [
  '**/ConsoleProtectedWrapper.tsx',
  '**/forceBrowserConsole.ts',
  '**/forceConsoleRestore.ts',
  '**/aggressiveConsoleRestore.ts',
  '**/consoleDebugWindow.ts',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/test/**',
  '**/tests/**',
  '**/__tests__/**',
  '**/node_modules/**',
];

// Find all TypeScript/React files
const files = glob.sync('apps/frontend/src/**/*.{ts,tsx}', {
  ignore: SKIP_FILES,
});

let totalFixed = 0;
let filesModified = 0;

files.forEach((filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Skip if file already has useCorrelation hook
  const hasCorrelationHook = content.includes('useCorrelation');
  const hasStructuredLogger = content.includes('createStructuredLogger');
  
  // Count console statements
  const consoleMatches = content.match(/console\.(log|error|warn|debug|info)/g);
  if (!consoleMatches || consoleMatches.length === 0) {
    return;
  }
  
  console.log(`\nProcessing ${filePath} (${consoleMatches.length} console statements)`);
  
  // For React components (has JSX)
  if (content.includes('return (') || content.includes('return <')) {
    if (!hasCorrelationHook) {
      // Add import if not present
      if (!content.includes("from '@/shared/hooks/useCorrelation'")) {
        const importMatch = content.match(/import .* from ['"].*['"](;)?/);
        if (importMatch) {
          const lastImportIndex = content.lastIndexOf(importMatch[0]) + importMatch[0].length;
          content = content.slice(0, lastImportIndex) + 
            "\nimport { useCorrelation } from '@/shared/hooks/useCorrelation';" +
            content.slice(lastImportIndex);
        }
      }
      
      // Find component name
      const componentMatch = content.match(/(?:export\s+)?(?:function|const)\s+(\w+)/);
      const componentName = componentMatch ? componentMatch[1] : 'Component';
      
      // Add useCorrelation hook after function declaration
      const functionBodyMatch = content.match(/(function\s+\w+[^{]*{|const\s+\w+[^=]*=[^{]*{)/);
      if (functionBodyMatch) {
        const insertIndex = content.indexOf(functionBodyMatch[0]) + functionBodyMatch[0].length;
        const nextLineIndex = content.indexOf('\n', insertIndex) + 1;
        
        // Check if hook already exists
        const nextFewLines = content.slice(nextLineIndex, nextLineIndex + 200);
        if (!nextFewLines.includes('useCorrelation')) {
          content = content.slice(0, nextLineIndex) +
            `  const { correlationId, logger } = useCorrelation('${componentName}');\n` +
            content.slice(nextLineIndex);
        }
      }
    }
    
    // Replace console statements
    content = content.replace(/console\.log\(/g, 'logger.info(');
    content = content.replace(/console\.error\(/g, 'logger.error(');
    content = content.replace(/console\.warn\(/g, 'logger.warn(');
    content = content.replace(/console\.debug\(/g, 'logger.debug(');
    content = content.replace(/console\.info\(/g, 'logger.info(');
    
  } else {
    // For non-React files (services, utilities)
    if (!hasStructuredLogger) {
      // Add import if not present
      if (!content.includes("from '@bassnotion/contracts'")) {
        const importMatch = content.match(/import .* from ['"].*['"](;)?/);
        if (importMatch) {
          const lastImportIndex = content.lastIndexOf(importMatch[0]) + importMatch[0].length;
          content = content.slice(0, lastImportIndex) + 
            "\nimport { createStructuredLogger } from '@bassnotion/contracts';" +
            content.slice(lastImportIndex);
        }
      }
      
      // Add logger declaration after imports
      const firstNonImportLine = content.split('\n').findIndex(line => 
        !line.startsWith('import') && 
        !line.startsWith('//') && 
        !line.startsWith('/*') &&
        !line.trim() === '' &&
        line.trim().length > 0
      );
      
      if (firstNonImportLine > 0) {
        const lines = content.split('\n');
        const fileName = path.basename(filePath, path.extname(filePath));
        lines.splice(firstNonImportLine, 0, `\nconst logger = createStructuredLogger('${fileName}');\n`);
        content = lines.join('\n');
      }
    }
    
    // Replace console statements
    content = content.replace(/console\.log\(/g, 'logger.info(');
    content = content.replace(/console\.error\(/g, 'logger.error(');
    content = content.replace(/console\.warn\(/g, 'logger.warn(');
    content = content.replace(/console\.debug\(/g, 'logger.debug(');
    content = content.replace(/console\.info\(/g, 'logger.info(');
  }
  
  // Write back if changed
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFixed += consoleMatches.length;
    filesModified++;
    console.log(`✓ Fixed ${consoleMatches.length} console statements`);
  }
});

console.log(`\n✅ Summary:`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Console statements fixed: ${totalFixed}`);