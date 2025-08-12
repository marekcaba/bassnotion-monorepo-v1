#!/usr/bin/env node

/**
 * Extract samples from SF2 soundfont files
 * Requires: sf2-parser and fluidsynthsf2 or similar tools
 */

import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Note mapping for Rhodes (typical range)
const RHODES_NOTE_MAPPING = {
  'C1': 24, 'C2': 36, 'C3': 48, 'C4': 60, 'C5': 72,
  'E1': 28, 'E2': 40, 'E3': 52, 'E4': 64, 'E5': 76,
  'G1': 31, 'G2': 43, 'G3': 55, 'G4': 67, 'G5': 79,
  'A1': 33, 'A2': 45, 'A3': 57, 'A4': 69, 'A5': 81,
  'C6': 84, 'E6': 88, 'G6': 91, 'A6': 93, 'C7': 96
};

async function checkDependencies() {
  try {
    // Check if fluidsynth is installed
    await execAsync('which fluidsynth');
    console.log('✅ fluidsynth is installed');
    return true;
  } catch (error) {
    console.error('❌ fluidsynth is not installed');
    console.log('Please install fluidsynth:');
    console.log('  brew install fluidsynth');
    return false;
  }
}

async function extractSF2Samples(sf2Path, outputDir, instrumentName) {
  console.log(`\n🎹 Extracting samples from ${instrumentName}...`);
  
  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });
  
  // For each note, render it using fluidsynth
  for (const [noteName, midiNote] of Object.entries(RHODES_NOTE_MAPPING)) {
    const outputFile = join(outputDir, `${noteName}.mp3`);
    
    console.log(`  Rendering ${noteName} (MIDI ${midiNote})...`);
    
    // Create a simple MIDI file that plays the note
    const midiCommands = `
noteon 0 ${midiNote} 100
sleep 3
noteoff 0 ${midiNote}
`;
    
    // Write MIDI commands to temp file
    const tempMidiScript = join(outputDir, `temp_${noteName}.txt`);
    await fs.writeFile(tempMidiScript, midiCommands);
    
    try {
      // Use fluidsynth to render the note
      // First render to WAV
      const wavFile = join(outputDir, `${noteName}.wav`);
      const fluidsynthCmd = `fluidsynth -ni "${sf2Path}" -F "${wavFile}" -r 44100 -g 1.0 < "${tempMidiScript}"`;
      
      await execAsync(fluidsynthCmd);
      
      // Convert WAV to MP3 using ffmpeg
      await execAsync(`ffmpeg -i "${wavFile}" -acodec mp3 -ab 192k "${outputFile}" -y`);
      
      // Clean up WAV file
      await fs.unlink(wavFile);
      
      console.log(`    ✅ ${noteName}.mp3 created`);
    } catch (error) {
      console.error(`    ❌ Failed to render ${noteName}:`, error.message);
    }
    
    // Clean up temp script
    await fs.unlink(tempMidiScript).catch(() => {});
  }
}

async function createManualSynthesisAlternative(outputDir) {
  console.log('\n🎵 Creating synthesis-based Rhodes samples as alternative...');
  
  // Since we can't easily extract from SF2, let's create a script to generate
  // Rhodes-like samples using Web Audio API in the browser
  
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Rhodes Sample Generator</title>
    <script src="https://unpkg.com/tone@15.0.4/build/Tone.js"></script>
</head>
<body>
    <h1>Rhodes Electric Piano Sample Generator</h1>
    <p>This page generates Rhodes-like samples using FM synthesis.</p>
    <button onclick="generateSamples()">Generate Rhodes Samples</button>
    <div id="status"></div>
    
    <script>
    const NOTES = ${JSON.stringify(Object.entries(RHODES_NOTE_MAPPING))};
    
    async function generateSamples() {
        const status = document.getElementById('status');
        status.innerHTML = 'Starting sample generation...';
        
        await Tone.start();
        
        // Create Rhodes-like FM synthesis
        const synth = new Tone.FMSynth({
            harmonicity: 7,
            modulationIndex: 12,
            detune: 0,
            oscillator: {
                type: "sine"
            },
            envelope: {
                attack: 0.01,
                decay: 0.3,
                sustain: 0.4,
                release: 1.2
            },
            modulation: {
                type: "sine"
            },
            modulationEnvelope: {
                attack: 0.002,
                decay: 0.2,
                sustain: 0.3,
                release: 0.9
            }
        }).toDestination();
        
        // Add chorus for Rhodes character
        const chorus = new Tone.Chorus(4, 2.5, 0.5).toDestination();
        synth.connect(chorus);
        
        for (const [noteName, midiNote] of NOTES) {
            status.innerHTML = \`Generating \${noteName}...\`;
            
            // Convert MIDI to frequency
            const freq = Tone.Frequency(midiNote, "midi").toFrequency();
            
            // Record the note
            const recorder = new Tone.Recorder();
            synth.connect(recorder);
            
            recorder.start();
            synth.triggerAttackRelease(freq, "2n");
            
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const recording = await recorder.stop();
            const url = URL.createObjectURL(recording);
            
            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = \`\${noteName}.webm\`;
            a.click();
            
            synth.disconnect(recorder);
        }
        
        status.innerHTML = '✅ All samples generated! Check your downloads folder.';
    }
    </script>
</body>
</html>`;
  
  const generatorPath = join(outputDir, 'rhodes-generator.html');
  await fs.writeFile(generatorPath, htmlContent);
  console.log(`\n📄 Created sample generator at: ${generatorPath}`);
  console.log('Open this file in a browser and click "Generate Rhodes Samples" to create the samples.');
}

async function main() {
  console.log('🎹 Rhodes Sample Extraction Tool\n');
  
  const sf2Path = join(__dirname, '..', 'apps', 'frontend', 'public', 'soundfonts', 'nice-keys-rhodes', 'nice-keys-rhodes.sf2');
  const outputDir = join(__dirname, '..', 'apps', 'frontend', 'public', 'rhodes-samples');
  
  // Check if SF2 file exists
  try {
    await fs.access(sf2Path);
    console.log(`✅ Found SF2 file: ${sf2Path}`);
  } catch (error) {
    console.error(`❌ SF2 file not found: ${sf2Path}`);
    return;
  }
  
  // Check dependencies
  const hasFluidsynth = await checkDependencies();
  
  if (hasFluidsynth) {
    // Try to extract using fluidsynth
    try {
      await extractSF2Samples(sf2Path, outputDir, 'Nice Keys Rhodes');
      console.log('\n✅ Sample extraction complete!');
      console.log(`📁 Samples saved to: ${outputDir}`);
    } catch (error) {
      console.error('❌ Extraction failed:', error);
      console.log('\nFalling back to synthesis alternative...');
      await createManualSynthesisAlternative(outputDir);
    }
  } else {
    // Create synthesis alternative
    await createManualSynthesisAlternative(outputDir);
  }
  
  // Create metadata file
  const metadata = {
    instrument: 'Nice Keys Rhodes',
    type: 'electric-piano',
    samples: Object.keys(RHODES_NOTE_MAPPING).reduce((acc, note) => {
      acc[note] = `${note}.mp3`;
      return acc;
    }, {}),
    created: new Date().toISOString()
  };
  
  await fs.writeFile(
    join(outputDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  console.log('\n📄 Created metadata.json');
}

main().catch(console.error);