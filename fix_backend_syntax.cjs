const fs = require('fs');
const path = require('path');

const filesToFix = [
  'apps/backend/src/domains/exercises/exercises.service.ts',
  'apps/backend/src/domains/exercises/exercises.service.original.ts',
  'apps/backend/src/domains/exercises/services/file-upload.service.ts',
  'apps/backend/src/domains/exercises/user-basslines.service.ts',
  'apps/backend/src/domains/user/auth/auth.module.ts',
  'apps/backend/src/domains/user/auth/auth.service.ts'
];

filesToFix.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix double comma patterns
    content = content.replace(/,\s*,\s*{/g, ', {');
    
    // Fix import at beginning of line (should be on same line)
    content = content.replace(/\n,\s*createStructuredLogger/g, ', createStructuredLogger');
    
    // Fix @Inject patterns with missing closing parenthesis
    content = content.replace(/@Inject\(forwardRef\(\(,/g, '@Inject(forwardRef(() => DatabaseService))');
    
    // Fix misplaced import statements inside classes
    content = content.replace(/}\nimport\s*{([^}]+)}\s*from\s*['"]([^'"]+)['"]\s*;\s*\n@/g, '}\n\n@');
    
    // Fix "private readonly" patterns with wrong syntax
    content = content.replace(/\)\s*=>\s*DatabaseService\)\)\s*private readonly db: DatabaseService,/g, ') => DatabaseService))\n    private readonly db: DatabaseService,');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
});

console.log('Backend syntax fixes complete\!');
