#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const mp3Dir = path.join(__dirname, '../apps/frontend/public/samples/long-pad-mp3');

console.log('🎹 Renaming sharp notes to avoid URL issues...');

// Get all MP3 files
const files = fs.readdirSync(mp3Dir).filter(f => f.endsWith('.mp3') && f.includes('#'));
console.log(`Found ${files.length} files with # to rename`);

files.forEach(file => {
  const oldPath = path.join(mp3Dir, file);
  // Replace # with s (sharp)
  const newFile = file.replace(/#/g, 's');
  const newPath = path.join(mp3Dir, newFile);
  
  console.log(`Renaming: ${file} -> ${newFile}`);
  fs.renameSync(oldPath, newPath);
});

console.log('✅ Renaming complete!');