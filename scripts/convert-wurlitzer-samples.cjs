#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function convertWurlitzerToMP3() {
  const sourceDir = path.join(__dirname, '../temp-downloads/downloads/wurlitzer/Samples');
  const targetBaseDir = path.join(__dirname, '../apps/frontend/public/samples/wurlitzer-mp3');

  // Create target directories
  console.log('Creating directories...');
  const dirs = ['v1', 'v2', 'v3', 'v4', 'v5', 'pedal', 'key-press', 'key-release'];
  for (const dir of dirs) {
    fs.mkdirSync(path.join(targetBaseDir, dir), { recursive: true });
  }

  // Get all WAV files
  const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.wav')).sort();
  
  // Process note samples (variable velocities per note)
  console.log('Processing note samples...');
  const noteFiles = files.filter(f => !f.includes('Pedal') && !f.includes('CleanKeys') && !f.includes('KeyRelease'));
  
  // Group files by note name
  const noteGroups = {};
  
  for (const file of noteFiles) {
    const match = file.match(/^\d+\s+([A-G]#?\d)\.wav$/);
    if (match) {
      const note = match[1];
      if (!noteGroups[note]) {
        noteGroups[note] = [];
      }
      noteGroups[note].push(file);
    }
  }
  
  // Process each note group
  for (const [note, noteFileList] of Object.entries(noteGroups)) {
    console.log(`Processing ${note} with ${noteFileList.length} velocities`);
    
    for (let i = 0; i < noteFileList.length; i++) {
      const file = noteFileList[i];
      const velocityIndex = i + 1;
      
      const sourcePath = path.join(sourceDir, file);
      const targetNote = note.includes('#') ? note.replace('#', 's') : note;
      const targetPath = path.join(targetBaseDir, `v${velocityIndex}`, `${targetNote}.mp3`);
      
      const command = `ffmpeg -i "${sourcePath}" -acodec libmp3lame -b:a 192k -ar 44100 "${targetPath}" -y`;
      
      try {
        console.log(`  Converting ${file} to v${velocityIndex}/${targetNote}.mp3`);
        await execAsync(command);
      } catch (error) {
        console.error(`Error converting ${file}:`, error.message);
      }
    }
  }
  
  // Process pedal sounds
  console.log('\nProcessing pedal sounds...');
  const pedalFiles = files.filter(f => f.includes('Pedal'));
  for (const file of pedalFiles) {
    const sourcePath = path.join(sourceDir, file);
    const targetName = file.includes('press') ? 'pedal-press.mp3' : 'pedal-release.mp3';
    const targetPath = path.join(targetBaseDir, 'pedal', targetName);
    
    const command = `ffmpeg -i "${sourcePath}" -acodec libmp3lame -b:a 192k -ar 44100 "${targetPath}" -y`;
    
    try {
      console.log(`Converting ${file} to pedal/${targetName}`);
      await execAsync(command);
    } catch (error) {
      console.error(`Error converting ${file}:`, error.message);
    }
  }
  
  // Process clean key sounds (key press sounds)
  console.log('\nProcessing key press sounds...');
  const cleanKeyFiles = files.filter(f => f.includes('CleanKeys'));
  let keyPressIndex = 1;
  for (const file of cleanKeyFiles) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetBaseDir, 'key-press', `key-press-${keyPressIndex}.mp3`);
    
    const command = `ffmpeg -i "${sourcePath}" -acodec libmp3lame -b:a 128k -ar 44100 "${targetPath}" -y`;
    
    try {
      console.log(`Converting ${file} to key-press/key-press-${keyPressIndex}.mp3`);
      await execAsync(command);
      keyPressIndex++;
    } catch (error) {
      console.error(`Error converting ${file}:`, error.message);
    }
  }
  
  // Process key release sounds
  console.log('\nProcessing key release sounds...');
  const keyReleaseFiles = files.filter(f => f.includes('KeyRelease'));
  let keyReleaseIndex = 1;
  for (const file of keyReleaseFiles) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetBaseDir, 'key-release', `key-release-${keyReleaseIndex}.mp3`);
    
    const command = `ffmpeg -i "${sourcePath}" -acodec libmp3lame -b:a 128k -ar 44100 "${targetPath}" -y`;
    
    try {
      console.log(`Converting ${file} to key-release/key-release-${keyReleaseIndex}.mp3`);
      await execAsync(command);
      keyReleaseIndex++;
    } catch (error) {
      console.error(`Error converting ${file}:`, error.message);
    }
  }
  
  // Analyze velocity distribution
  const velocityDistribution = {};
  for (const [note, noteFileList] of Object.entries(noteGroups)) {
    const count = noteFileList.length;
    if (!velocityDistribution[count]) {
      velocityDistribution[count] = [];
    }
    velocityDistribution[count].push(note);
  }

  // Create metadata file
  const metadata = {
    instrument: 'Wurlitzer Electric Piano',
    velocityLayers: 'Variable (3-5 per note)',
    velocityDistribution: velocityDistribution,
    noteRange: 'A0-C6',
    features: {
      pedalSounds: true,
      keyPressSounds: true,
      keyReleaseSounds: true
    },
    articulations: {
      notes: noteFiles.length,
      uniqueNotes: Object.keys(noteGroups).length,
      pedalSounds: pedalFiles.length,
      keyPressSounds: cleanKeyFiles.length,
      keyReleaseSounds: keyReleaseFiles.length
    },
    license: 'Free for commercial use',
    notes: 'Comprehensive Wurlitzer sample set with mechanical noises and variable velocity layers'
  };

  fs.writeFileSync(
    path.join(targetBaseDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  console.log('\n✅ Wurlitzer conversion complete!');
  console.log(`Converted ${files.length} total samples`);
  console.log(`- Note samples: ${noteFiles.length}`);
  console.log(`- Pedal sounds: ${pedalFiles.length}`);
  console.log(`- Key press sounds: ${cleanKeyFiles.length}`);
  console.log(`- Key release sounds: ${keyReleaseFiles.length}`);
}

// Run the conversion
convertWurlitzerToMP3().catch(console.error);