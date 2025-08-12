#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sourceDir = path.join(__dirname, '../apps/frontend/public/samples/long-pad');
const targetDir = path.join(__dirname, '../apps/frontend/public/samples/long-pad-mp3');

// Create target directory
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Check if ffmpeg is installed
try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ ffmpeg is not installed. Please install ffmpeg first:');
  console.error('   brew install ffmpeg');
  process.exit(1);
}

console.log('🎹 Converting Long Pad AIF files to MP3...');

// Get all AIF files
const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.aif'));
console.log(`Found ${files.length} AIF files to convert`);

let converted = 0;
let errors = 0;

files.forEach((file, index) => {
  try {
    const sourcePath = path.join(sourceDir, file);
    const targetFile = file.replace('.aif', '.mp3');
    const targetPath = path.join(targetDir, targetFile);
    
    // Skip if already converted
    if (fs.existsSync(targetPath)) {
      console.log(`⏭️  Skipping ${file} (already converted)`);
      converted++;
      return;
    }
    
    console.log(`Converting ${index + 1}/${files.length}: ${file}`);
    
    // Convert using ffmpeg with high quality settings
    // -ar 44100: Sample rate 44.1kHz
    // -ab 192k: Bitrate 192kbps
    // -ac 2: Stereo
    execSync(`ffmpeg -i "${sourcePath}" -ar 44100 -ab 192k -ac 2 "${targetPath}"`, { 
      stdio: 'ignore' 
    });
    
    converted++;
  } catch (error) {
    console.error(`❌ Error converting ${file}:`, error.message);
    errors++;
  }
});

console.log('\n✅ Conversion complete!');
console.log(`   Converted: ${converted} files`);
console.log(`   Errors: ${errors} files`);
console.log(`   Output directory: ${targetDir}`);