#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SOURCE_DIR = '/Users/marekcaba/Downloads/JiKay - The Saw/JiKay - The Saw Samples';
const OUTPUT_DIR = path.join(__dirname, '../temp/thesaw-mp3');

// Mapping of original filenames to web-friendly names
const fileMapping = {
  '1. THE SAW_C0.wav': 'C0.mp3',
  '2. THE SAW_G0.wav': 'G0.mp3',
  '3. THE SAW_D1.wav': 'D1.mp3',
  '4. THE SAW_A1.wav': 'A1.mp3',
  '5. THE SAW_E2.wav': 'E2.mp3',
  '6. THE SAW_B2.wav': 'B2.mp3',
  '7. THE SAW_F#3.wav': 'Fs3.mp3',
  '8. THE SAW_C#4.wav': 'Cs4.mp3',
  '9. THE SAW_G#4.wav': 'Gs4.mp3',
  '10. THE SAW_D#5.wav': 'Ds5.mp3',
  '11. THE SAW_A#5.wav': 'As5.mp3'
};

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('🎹 Converting The Saw samples to MP3...');

Object.entries(fileMapping).forEach(([originalFile, newFile]) => {
  const inputPath = path.join(SOURCE_DIR, originalFile);
  const outputPath = path.join(OUTPUT_DIR, newFile);
  
  if (fs.existsSync(inputPath)) {
    console.log(`Converting ${originalFile} -> ${newFile}`);
    
    try {
      // Convert to MP3 with high quality settings
      execSync(`ffmpeg -i "${inputPath}" -acodec libmp3lame -b:a 320k -ar 44100 "${outputPath}" -y`, {
        stdio: 'pipe'
      });
      console.log(`✅ Converted ${newFile}`);
    } catch (error) {
      console.error(`❌ Failed to convert ${originalFile}:`, error.message);
    }
  } else {
    console.error(`❌ File not found: ${inputPath}`);
  }
});

console.log('\n✅ Conversion complete!');
console.log(`Output directory: ${OUTPUT_DIR}`);

// Show summary
const convertedFiles = fs.readdirSync(OUTPUT_DIR);
console.log(`\nConverted ${convertedFiles.length} files:`);
convertedFiles.forEach(file => console.log(`  - ${file}`));