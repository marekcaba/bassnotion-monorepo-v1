#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const BACKEND_PATH = 'apps/backend/src';
const DRY_RUN = process.argv.includes('--dry-run');

// Files to skip
const SKIP_PATTERNS = [
  '**/*.spec.ts',
  '**/*.test.ts',
  '**/test/**',
  '**/__tests__/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/*.example.ts',
];

console.log('🔄 Backend Logging Migration Script');
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

// Find all TypeScript files in backend
const files = glob.sync(`${BACKEND_PATH}/**/*.ts`, {
  ignore: SKIP_PATTERNS,
});

let totalModified = 0;
let totalLoggerReplacements = 0;
let totalConsoleReplacements = 0;

files.forEach((filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let modified = false;
  
  // Check if file uses NestJS Logger
  const hasNestLogger = content.includes('new Logger(');
  const hasLoggerImport = content.includes("from '@nestjs/common'") && content.includes('Logger');
  
  if (!hasNestLogger && !hasLoggerImport) {
    return; // Skip files that don't use Logger
  }
  
  console.log(`\nProcessing: ${filePath}`);
  
  // Step 1: Update imports
  if (hasLoggerImport) {
    // Remove Logger from @nestjs/common imports
    content = content.replace(
      /import\s*{\s*([^}]*)\s*}\s*from\s*['"]@nestjs\/common['"]/g,
      (match, imports) => {
        const importList = imports.split(',').map(i => i.trim());
        const filteredImports = importList.filter(i => i !== 'Logger');
        
        if (filteredImports.length === 0) {
          modified = true;
          return ''; // Remove entire import if Logger was the only import
        } else if (filteredImports.length < importList.length) {
          modified = true;
          return `import { ${filteredImports.join(', ')} } from '@nestjs/common'`;
        }
        return match;
      }
    );
    
    // Add structured logger import
    if (!content.includes("from '@bassnotion/contracts'")) {
      // Find the last import statement
      const lastImportMatch = content.match(/import[^;]+;(?![\s\S]*import[^;]+;)/);
      if (lastImportMatch) {
        const insertPos = content.indexOf(lastImportMatch[0]) + lastImportMatch[0].length;
        content = content.slice(0, insertPos) + 
          "\nimport { createStructuredLogger } from '@bassnotion/contracts';" +
          content.slice(insertPos);
        modified = true;
      }
    } else {
      // Add to existing @bassnotion/contracts import
      content = content.replace(
        /import\s*{\s*([^}]*)\s*}\s*from\s*['"]@bassnotion\/contracts['"]/,
        (match, imports) => {
          if (!imports.includes('createStructuredLogger')) {
            modified = true;
            return `import { ${imports}, createStructuredLogger } from '@bassnotion/contracts'`;
          }
          return match;
        }
      );
    }
  }
  
  // Step 2: Check if service is injectable and needs RequestContextService
  const isInjectable = content.includes('@Injectable()');
  const hasConstructor = content.includes('constructor(');
  const needsRequestContext = isInjectable && hasConstructor && !content.includes('RequestContextService');
  
  if (needsRequestContext) {
    // Add RequestContextService import
    if (!content.includes("from '../../shared/services/request-context.service.js'") &&
        !content.includes("from '../shared/services/request-context.service.js'") &&
        !content.includes("from './shared/services/request-context.service.js'")) {
      
      // Calculate relative path to shared services
      const fileDir = path.dirname(filePath);
      const sharedPath = path.join(BACKEND_PATH, 'shared/services/request-context.service.js');
      const relativePath = path.relative(fileDir, sharedPath).replace(/\\/g, '/');
      
      const lastImportMatch = content.match(/import[^;]+;(?![\s\S]*import[^;]+;)/);
      if (lastImportMatch) {
        const insertPos = content.indexOf(lastImportMatch[0]) + lastImportMatch[0].length;
        content = content.slice(0, insertPos) + 
          `\nimport { RequestContextService } from '${relativePath}';` +
          content.slice(insertPos);
        modified = true;
      }
    }
  }
  
  // Step 3: Replace Logger instantiation
  content = content.replace(
    /private\s+readonly\s+logger\s*=\s*new\s+Logger\([^)]+\);?/g,
    (match) => {
      const className = match.match(/Logger\(([^)]+)\)/)?.[1] || 'Service';
      totalLoggerReplacements++;
      modified = true;
      return `private readonly staticLogger = createStructuredLogger(${className});`;
    }
  );
  
  // Step 4: Add RequestContextService to constructor (if needed)
  if (needsRequestContext && isInjectable) {
    // Find constructor and add RequestContextService
    content = content.replace(
      /constructor\s*\(\s*([^)]*)\s*\)/,
      (match, params) => {
        if (!params.includes('RequestContextService')) {
          const newParam = params.trim() 
            ? `${params},\n    @Inject(RequestContextService)\n    private readonly requestContext: RequestContextService,`
            : `@Inject(RequestContextService)\n    private readonly requestContext: RequestContextService,`;
          modified = true;
          
          // Also add Inject import if not present
          if (!content.includes("Inject")) {
            content = content.replace(
              /import\s*{\s*([^}]*)\s*}\s*from\s*['"]@nestjs\/common['"]/,
              (match, imports) => {
                return `import { ${imports}, Inject } from '@nestjs/common'`;
              }
            );
          }
          
          return `constructor(\n    ${newParam}\n  )`;
        }
        return match;
      }
    );
  }
  
  // Step 5: Update logger method calls in methods
  if (isInjectable) {
    // For methods that might have request context
    content = content.replace(
      /async\s+(\w+)\s*\([^)]*\)[^{]*{/g,
      (match, methodName) => {
        // Don't modify constructor
        if (methodName === 'constructor') return match;
        
        // Check if this method uses logger
        const methodEnd = content.indexOf('}', content.indexOf(match));
        const methodBody = content.slice(content.indexOf(match), methodEnd);
        
        if (methodBody.includes('this.logger.') || methodBody.includes('this.staticLogger.')) {
          // Add logger getter at the beginning of method
          const lines = match.split('\n');
          const lastLine = lines[lines.length - 1];
          const indent = lastLine.match(/^\s*/)?.[0] || '    ';
          
          return match + `\n${indent}const logger = this.requestContext?.getLogger() || this.staticLogger;\n${indent}const correlationId = this.requestContext?.getCorrelationId();`;
        }
        
        return match;
      }
    );
    
    // Replace logger calls
    content = content.replace(/this\.logger\./g, 'logger.');
    content = content.replace(/this\.staticLogger\./g, 'logger.');
  } else {
    // For non-injectable classes, just replace with staticLogger
    content = content.replace(/this\.logger\./g, 'this.staticLogger.');
  }
  
  // Step 6: Update log method calls to include correlation ID
  content = content.replace(
    /logger\.(debug|info|warn|error|log)\s*\(\s*([^)]+)\s*\)/g,
    (match, method, args) => {
      // Simple heuristic: if args doesn't include an object literal, add correlation ID
      if (!args.includes('{') && !args.includes('correlationId')) {
        // For simple string logs
        if (args.match(/^['"`]/)) {
          return `logger.${method}(${args}, { correlationId })`;
        }
      }
      return match;
    }
  );
  
  // Step 7: Replace any console.log/error/warn
  if (content.includes('console.')) {
    content = content.replace(/console\.log\(/g, 'logger.info(');
    content = content.replace(/console\.error\(/g, 'logger.error(');
    content = content.replace(/console\.warn\(/g, 'logger.warn(');
    content = content.replace(/console\.debug\(/g, 'logger.debug(');
    totalConsoleReplacements++;
    modified = true;
  }
  
  // Write file if modified
  if (modified && content !== originalContent) {
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
    totalModified++;
    console.log(`  ✅ Modified (${totalLoggerReplacements} logger replacements)`);
  }
});

console.log('\n📊 Summary:');
console.log(`  Files processed: ${files.length}`);
console.log(`  Files modified: ${totalModified}`);
console.log(`  Logger replacements: ${totalLoggerReplacements}`);
console.log(`  Console replacements: ${totalConsoleReplacements}`);

if (DRY_RUN) {
  console.log('\n⚠️  This was a dry run. No files were modified.');
  console.log('Run without --dry-run to apply changes.');
}