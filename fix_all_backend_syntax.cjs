const fs = require('fs');
const path = require('path');

// Manually list the files we need to fix
const filesToFix = [
  'apps/backend/src/domains/exercises/services/file-upload.service.ts',
  'apps/backend/src/domains/exercises/user-basslines.service.ts',
  'apps/backend/src/domains/user/auth/guards/auth.guard.ts'
];

filesToFix.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix double commas
    content = content.replace(/,\s*,\s*createStructuredLogger/g, ', createStructuredLogger');
    
    // Fix specific file issues
    if (filePath.includes('file-upload.service.ts')) {
      content = content.replace('type ExerciseDifficulty,, createStructuredLogger', 'type ExerciseDifficulty, createStructuredLogger');
    }
    
    if (filePath.includes('user-basslines.service.ts')) {
      content = content.replace('type AutoSaveResponseInput,, createStructuredLogger', 'type AutoSaveResponseInput, createStructuredLogger');
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
});

console.log('Backend syntax fixes complete\!');
