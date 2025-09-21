/**
 * Example: Using DrumKit with External Configuration
 *
 * This example demonstrates how to use the refactored DrumKit
 * that loads its configuration from external JSON files.
 */

import { DrumKit } from '../implementations/drums/DrumKit.js';
import type { DrumKitInstrumentConfig } from '../implementations/drums/DrumKit.js';
import { ToneWrapper } from '../../audio-engine/core/ToneWrapper.js';

// Example 1: Load drum kit with external JSON configuration
async function loadExternalDrumKit() {
  const config: DrumKitInstrumentConfig = {
    id: 'drum-1',
    name: 'Basic Kit',
    type: 'drums',
    volume: 0.8,
    pan: 0,
    muted: false,
    enabled: true,
    // Specify the path to the JSON config file
    kitConfigPath: '/data/instruments/drums/basic-kit.json',
    baseUrl: '/samples/drums', // Base URL for sample loading
    grooveStyle: 'straight',
    swingAmount: 0,
    humanization: 0.1,
  };

  const toneWrapper = new ToneWrapper();
  await toneWrapper.initialize();

  const drumKit = new DrumKit(config);
  await drumKit.initialize();

  // The kit is now loaded from external JSON
  const kitInfo = drumKit.getKitInfo();
  console.log('Loaded kit:', kitInfo.name);
  console.log('Version:', kitInfo.version);
  console.log('Total samples:', kitInfo.totalSamples);
  console.log('Available drums:', drumKit.getAvailableDrums());

  return drumKit;
}

// Example 2: Backward compatibility - inline configuration
async function loadInlineDrumKit() {
  const config: DrumKitInstrumentConfig = {
    id: 'drum-2',
    name: 'Custom Kit',
    type: 'drums',
    volume: 0.8,
    pan: 0,
    muted: false,
    enabled: true,
    // Inline configuration (backward compatibility)
    kit: {
      name: 'Custom Drum Kit',
      samples: {
        kick: ['/samples/drums/kick-1.mp3', '/samples/drums/kick-2.mp3'],
        snare: ['/samples/drums/snare-1.mp3', '/samples/drums/snare-2.mp3'],
        hihat: ['/samples/drums/hihat-closed.mp3'],
        openHihat: ['/samples/drums/hihat-open.mp3'],
        crash: ['/samples/drums/crash-1.mp3'],
        ride: ['/samples/drums/ride-1.mp3'],
        tom1: ['/samples/drums/tom-high.mp3'],
        tom2: ['/samples/drums/tom-mid.mp3'],
        tom3: ['/samples/drums/tom-low.mp3'],
        rimshot: ['/samples/drums/rimshot.mp3'],
        clap: ['/samples/drums/clap.mp3'],
        cowbell: ['/samples/drums/cowbell.mp3'],
        tambourine: ['/samples/drums/tambourine.mp3'],
        shaker: ['/samples/drums/shaker.mp3'],
      },
    },
  };

  const drumKit = new DrumKit(config);
  await drumKit.initialize();

  return drumKit;
}

// Example 3: Trigger drums with velocity sensitivity
async function playVelocitySensitiveDrums() {
  const drumKit = await loadExternalDrumKit();

  // Trigger kick with different velocities
  drumKit.triggerDrum('kick', 0.3); // Soft
  setTimeout(() => drumKit.triggerDrum('kick', 0.6), 500); // Medium
  setTimeout(() => drumKit.triggerDrum('kick', 1.0), 1000); // Hard

  // The external config will automatically select
  // the appropriate sample based on velocity
}

// Example 4: Trigger drums by MIDI note
async function playDrumsViaMIDI() {
  const drumKit = await loadExternalDrumKit();

  // Standard General MIDI drum mapping
  drumKit.triggerByNote(36); // C2 = Kick
  drumKit.triggerByNote(38); // D2 = Snare
  drumKit.triggerByNote(42); // F#2 = Closed Hi-Hat
  drumKit.triggerByNote(46); // A#2 = Open Hi-Hat
  drumKit.triggerByNote(49); // C#3 = Crash Cymbal
}

// Example 5: Switch drum kits dynamically
async function switchDrumKits() {
  const drumKit = await loadExternalDrumKit();

  // Play with basic kit
  drumKit.triggerDrum('kick');

  // Switch to another kit
  await drumKit.loadKit('/data/instruments/drums/rock-kit.json');

  // Now playing with rock kit
  drumKit.triggerDrum('kick');

  // Get updated kit info
  const kitInfo = drumKit.getKitInfo();
  console.log('Now using:', kitInfo.name);
}

// Example 6: Custom drum volume control
async function adjustDrumVolumes() {
  const drumKit = await loadExternalDrumKit();

  // Set individual drum volumes
  drumKit.setDrumVolume('kick', 0.9);
  drumKit.setDrumVolume('snare', 0.8);
  drumKit.setDrumVolume('hihat', 0.5); // Quieter hi-hat
  drumKit.setDrumVolume('crash', 0.7);

  // Master volume control
  drumKit.setVolume(0.7); // 70% master volume
}

// Export examples
export {
  loadExternalDrumKit,
  loadInlineDrumKit,
  playVelocitySensitiveDrums,
  playDrumsViaMIDI,
  switchDrumKits,
  adjustDrumVolumes,
};
