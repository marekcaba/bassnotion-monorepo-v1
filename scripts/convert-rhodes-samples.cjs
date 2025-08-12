#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sourceDir = "/Users/marekcaba/Downloads/Matt's Fender Rhodes/samples/original";
const targetDir = path.join(__dirname, '../apps/frontend/public/samples/rhodes-mp3');

// Velocity mapping
const velocityMap = {
  'p': 'v1',   // piano (soft)
  'mp': 'v2',  // mezzo-piano
  'mf': 'v3',  // mezzo-forte
  'f': 'v4'    // forte (loud)
};

// Create target directories
Object.values(velocityMap).forEach(v => {
  const dir = path.join(targetDir, v);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Check if ffmpeg is installed
try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ ffmpeg is not installed. Please install ffmpeg first:');
  console.error('   brew install ffmpeg');
  process.exit(1);
}

console.log('🎹 Converting Rhodes samples to MP3...');
console.log(`Source: ${sourceDir}`);
console.log(`Target: ${targetDir}`);

// Get all WAV files
const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.wav'));
console.log(`Found ${files.length} WAV files to convert`);

let converted = 0;
let skipped = 0;
let errors = 0;

// Process each file
files.forEach((file, index) => {
  try {
    const sourcePath = path.join(sourceDir, file);
    
    // Parse filename: A#0-mp.wav -> note: A#0, velocity: mp
    const match = file.match(/^([A-G]#?\d)-([pmf]+)\.wav$/);
    if (!match) {
      console.warn(`⚠️  Skipping invalid filename: ${file}`);
      skipped++;
      return;
    }
    
    const [, note, velocity] = match;
    const velocityDir = velocityMap[velocity];
    
    if (!velocityDir) {
      console.warn(`⚠️  Unknown velocity: ${velocity} in ${file}`);
      skipped++;
      return;
    }
    
    // Replace # with s in filename to avoid URL issues
    const safeNote = note.replace('#', 's');
    const targetFile = `${safeNote}.mp3`;
    const targetPath = path.join(targetDir, velocityDir, targetFile);
    
    // Skip if already converted
    if (fs.existsSync(targetPath)) {
      console.log(`⏭️  Skipping ${file} (already converted)`);
      converted++;
      return;
    }
    
    console.log(`Converting ${index + 1}/${files.length}: ${file} -> ${velocityDir}/${targetFile}`);
    
    // Convert using ffmpeg with high quality settings
    execSync(`ffmpeg -i "${sourcePath}" -ar 44100 -ab 192k -ac 2 "${targetPath}"`, { 
      stdio: 'ignore' 
    });
    
    converted++;
  } catch (error) {
    console.error(`❌ Error converting ${file}:`, error.message);
    errors++;
  }
});

// Create metadata file
const metadata = {
  instrument: 'Fender Rhodes',
  velocityLayers: 4,
  noteRange: 'A0-C7',
  velocityMapping: velocityMap,
  convertedAt: new Date().toISOString()
};

fs.writeFileSync(
  path.join(targetDir, 'metadata.json'),
  JSON.stringify(metadata, null, 2)
);

console.log('\n✅ Conversion complete!');
console.log(`   Converted: ${converted} files`);
console.log(`   Skipped: ${skipped} files`);
console.log(`   Errors: ${errors} files`);
console.log(`   Output directory: ${targetDir}`);