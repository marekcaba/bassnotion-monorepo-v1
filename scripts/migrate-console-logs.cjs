#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Configuration
const config = {
  // Directories to process
  directories: [
    'apps/frontend/src',
    'apps/backend/src',
    'libs/contracts/src'
  ],
  // File extensions to process
  extensions: ['ts', 'tsx', 'js', 'jsx'],
  // Files to skip
  skipFiles: [
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/test/**',
    '**/tests/**',
    '**/__tests__/**',
    '**/__mocks__/**',
    '**/utils/logger.ts',
    '**/utils/simpleLogger.ts',
    '**/utils/silenceConsole.ts',
    '**/structured-logger.ts',
    '**/correlation.ts',
  ],
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  interactive: process.argv.includes('--interactive'),
  domain: process.argv.find(arg => arg.startsWith('--domain='))?.split('=')[1],
};

// Statistics
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  logsReplaced: 0,
  errors: 0,
  skipped: 0,
  byType: {
    log: 0,
    error: 0,
    warn: 0,
    debug: 0,
    info: 0,
  }
};

// Helper to determine component name from file path
function getComponentName(filePath) {
  const basename = path.basename(filePath, path.extname(filePath));
  // Remove .test, .spec, .stories etc
  const cleanName = basename.replace(/\.(test|spec|stories|mock)$/, '');
  // Convert kebab-case to PascalCase
  return cleanName
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// Helper to determine if file is a React component
function isReactComponent(content) {
  return content.includes('import React') || 
         content.includes("from 'react'") ||
         content.includes('export function') ||
         content.includes('export const') ||
         content.includes('export default function');
}

// Helper to check if file already uses correlation
function hasCorrelationImport(content) {
  return content.includes("from '@/shared/hooks/useCorrelation'") ||
         content.includes("from '@bassnotion/contracts'") && content.includes('createStructuredLogger');
}

// Helper to add imports
function addImports(content, isComponent) {
  if (isComponent && !hasCorrelationImport(content)) {
    // Find the last import statement
    const importRegex = /^import\s+.*$/gm;
    let lastImportIndex = -1;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      lastImportIndex = match.index + match[0].length;
    }
    
    if (lastImportIndex > -1) {
      const importStatement = "\nimport { useCorrelation } from '@/shared/hooks/useCorrelation';";
      content = content.slice(0, lastImportIndex) + importStatement + content.slice(lastImportIndex);
    }
  } else if (!isComponent && !hasCorrelationImport(content)) {
    // For non-components, use the contracts logger
    const importRegex = /^import\s+.*$/gm;
    let lastImportIndex = -1;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      lastImportIndex = match.index + match[0].length;
    }
    
    if (lastImportIndex > -1) {
      const importStatement = "\nimport { createStructuredLogger } from '@bassnotion/contracts';";
      content = content.slice(0, lastImportIndex) + importStatement + content.slice(lastImportIndex);
    }
  }
  
  return content;
}

// Helper to add correlation hook to component
function addCorrelationHook(content, componentName) {
  // Find the first hook usage or the start of the component function
  const functionRegex = new RegExp(`(export\\s+)?function\\s+${componentName}\\s*\\([^)]*\\)\\s*{`, 'g');
  const match = functionRegex.exec(content);
  
  if (match) {
    const insertPosition = match.index + match[0].length;
    // Check if we already have the hook
    const nextLines = content.slice(insertPosition, insertPosition + 200);
    if (!nextLines.includes('useCorrelation')) {
      const hookStatement = `\n  const { correlationId, logger } = useCorrelation('${componentName}');`;
      content = content.slice(0, insertPosition) + hookStatement + content.slice(insertPosition);
    }
  }
  
  return content;
}

// Helper to add logger for non-components
function addLogger(content, componentName) {
  // Check if logger already exists
  if (content.includes('const logger =')) {
    return content;
  }
  
  // Find the first function or after imports
  const functionRegex = /^(export\s+)?(async\s+)?function/m;
  const match = functionRegex.exec(content);
  
  if (match) {
    const insertPosition = content.lastIndexOf('\n', match.index);
    const loggerStatement = `\nconst logger = createStructuredLogger('${componentName}');\n`;
    content = content.slice(0, insertPosition) + loggerStatement + content.slice(insertPosition);
  }
  
  return content;
}

// Convert console.log to structured logging
function convertConsoleLog(line, logType = 'log') {
  // Extract the arguments from console.log/error/warn
  const regex = new RegExp(`console\\.${logType}\\s*\\(([^;]+)\\)`, 'g');
  const match = regex.exec(line);
  
  if (!match) return line;
  
  const args = match[1];
  
  // Determine the log level
  let logLevel;
  switch (logType) {
    case 'error':
      logLevel = 'error';
      break;
    case 'warn':
      logLevel = 'warn';
      break;
    case 'debug':
      logLevel = 'debug';
      break;
    default:
      logLevel = 'info';
  }
  
  // Parse the arguments
  // Handle simple string
  if (args.match(/^['"`].*['"`]$/)) {
    return line.replace(regex, `logger.${logLevel}(${args})`);
  }
  
  // Handle string with object
  if (args.includes(',') && args.includes('{')) {
    const firstComma = args.indexOf(',');
    const message = args.slice(0, firstComma).trim();
    const data = args.slice(firstComma + 1).trim();
    
    // For error logs, handle Error objects specially
    if (logLevel === 'error' && data.match(/error|err|e\s*[,\)]|exception/i)) {
      return line.replace(regex, `logger.error(${message}, ${data})`);
    }
    
    return line.replace(regex, `logger.${logLevel}(${message}, ${data})`);
  }
  
  // Handle template literals or complex expressions
  return line.replace(regex, `logger.${logLevel}(${args})`);
}

// Process a single file
async function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Skip if file doesn't have console logs
    if (!content.match(/console\.(log|error|warn|debug|info)/)) {
      return;
    }
    
    stats.filesProcessed++;
    
    // Determine if this is a React component
    const isComponent = isReactComponent(content);
    const componentName = getComponentName(filePath);
    
    if (config.verbose) {
      console.log(`\n${colors.cyan}Processing: ${filePath}${colors.reset}`);
      console.log(`  Component: ${componentName}, IsReact: ${isComponent}`);
    }
    
    // Add necessary imports
    content = addImports(content, isComponent);
    
    // Add correlation hook or logger
    if (isComponent) {
      content = addCorrelationHook(content, componentName);
    } else {
      content = addLogger(content, componentName);
    }
    
    // Replace console.* calls
    const lines = content.split('\n');
    const modifiedLines = lines.map((line, index) => {
      let modifiedLine = line;
      let modified = false;
      
      // Check for different console methods
      ['log', 'error', 'warn', 'debug', 'info'].forEach(method => {
        if (line.includes(`console.${method}`)) {
          modifiedLine = convertConsoleLog(modifiedLine, method);
          if (modifiedLine !== line) {
            modified = true;
            stats.logsReplaced++;
            stats.byType[method]++;
          }
        }
      });
      
      if (modified && config.verbose) {
        console.log(`  ${colors.yellow}Line ${index + 1}:${colors.reset}`);
        console.log(`    ${colors.red}- ${line.trim()}${colors.reset}`);
        console.log(`    ${colors.green}+ ${modifiedLine.trim()}${colors.reset}`);
      }
      
      return modifiedLine;
    });
    
    content = modifiedLines.join('\n');
    
    // Write the file if changed
    if (content !== originalContent) {
      if (!config.dryRun) {
        fs.writeFileSync(filePath, content, 'utf8');
      }
      stats.filesModified++;
      console.log(`${colors.green}✓${colors.reset} Modified: ${filePath}`);
    }
    
  } catch (error) {
    console.error(`${colors.red}✗ Error processing ${filePath}: ${error.message}${colors.reset}`);
    stats.errors++;
  }
}

// Main function
async function main() {
  console.log(`${colors.bright}Console.log Migration Script${colors.reset}`);
  console.log(`${colors.cyan}Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}${colors.reset}`);
  
  if (config.domain) {
    console.log(`${colors.cyan}Domain filter: ${config.domain}${colors.reset}`);
  }
  
  console.log('');
  
  // Collect all files to process
  const files = [];
  
  for (const dir of config.directories) {
    for (const ext of config.extensions) {
      let pattern;
      if (config.domain) {
        // Use domain as a path filter
        pattern = path.join(dir, `**/*${config.domain}*/**/*.${ext}`);
      } else {
        pattern = path.join(dir, `**/*.${ext}`);
      }
      
      const matches = glob.sync(pattern, {
        ignore: config.skipFiles,
      });
      
      // Additional domain filtering
      const filteredMatches = config.domain 
        ? matches.filter(file => file.includes(config.domain))
        : matches;
        
      files.push(...filteredMatches);
    }
  }
  
  console.log(`Found ${files.length} files to process\n`);
  
  // Process files
  for (const file of files) {
    await processFile(file);
  }
  
  // Print statistics
  console.log(`\n${colors.bright}Summary:${colors.reset}`);
  console.log(`  Files processed: ${stats.filesProcessed}`);
  console.log(`  Files modified: ${stats.filesModified}`);
  console.log(`  Console logs replaced: ${stats.logsReplaced}`);
  console.log(`    - console.log: ${stats.byType.log}`);
  console.log(`    - console.error: ${stats.byType.error}`);
  console.log(`    - console.warn: ${stats.byType.warn}`);
  console.log(`    - console.debug: ${stats.byType.debug}`);
  console.log(`    - console.info: ${stats.byType.info}`);
  console.log(`  Errors: ${stats.errors}`);
  
  if (config.dryRun) {
    console.log(`\n${colors.yellow}This was a dry run. No files were modified.${colors.reset}`);
    console.log(`Run without --dry-run to apply changes.`);
  }
}

// Run the script
main().catch(console.error);