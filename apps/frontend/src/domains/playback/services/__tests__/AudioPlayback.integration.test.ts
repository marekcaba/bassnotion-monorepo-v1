import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Tone from 'tone';
import { AudioEngine } from '../core/AudioEngine';
import { UnifiedTransport } from '../core/index.js';

describe('Audio Playback and Sample Swapping Integration Tests', () => {
  let audioEngine: AudioEngine;
  let transportController: UnifiedTransport;
  let testSamplers: Map<string, Tone.Sampler>;

  beforeEach(async () => {
    // Initialize audio engine
    audioEngine = AudioEngine.getInstance();
    await audioEngine.initialize();
    
    transportController = new UnifiedTransport(audioEngine);
    
    // Create test samplers
    testSamplers = new Map();
    
    // Reset transport
    Tone.Transport.stop();
    Tone.Transport.position = 0;
  });

  afterEach(() => {
    // Dispose samplers
    testSamplers.forEach(sampler => sampler.dispose());
    testSamplers.clear();
    
    // Clean up transport
    Tone.Transport.stop();
    Tone.Transport.cancel();
  });

  describe('Sample Loading and Playback', () => {
    it('should load and play drum samples correctly', async () => {
      const drumSampler = new Tone.Sampler({
        urls: {
          C1: 'kick.mp3',
          D1: 'snare.mp3',
          E1: 'hihat.mp3'
        },
        baseUrl: '/drums/test/',
        onload: () => {
          console.log('Drum sampler loaded');
        }
      }).toDestination();

      testSamplers.set('drums', drumSampler);

      // Create a drum pattern
      const drumPattern = new Tone.Part((time, note) => {
        drumSampler.triggerAttackRelease(note, '8n', time);
      }, [
        ['0:0:0', 'C1'], // Kick
        ['0:1:0', 'D1'], // Snare
        ['0:2:0', 'C1'], // Kick
        ['0:3:0', 'D1'], // Snare
      ]);

      drumPattern.loop = true;
      drumPattern.loopEnd = '1m';

      // Start playback
      await transportController.start();
      drumPattern.start(0);

      // Verify sampler is connected
      expect(drumSampler.disposed).toBe(false);
      expect(drumSampler.volume.value).toBeGreaterThan(-Infinity);

      // Let it play briefly
      await new Promise(resolve => setTimeout(resolve, 100));

      drumPattern.stop();
      await transportController.stop();
    });

    it('should play chord samples with velocity sensitivity', async () => {
      const pianoSampler = new Tone.Sampler({
        urls: {
          A0: 'A0.mp3',
          C1: 'C1.mp3',
          'D#1': 'Ds1.mp3',
          'F#1': 'Fs1.mp3',
          A1: 'A1.mp3',
        },
        baseUrl: '/piano/test/',
      }).toDestination();

      testSamplers.set('piano', pianoSampler);

      // Play chords with different velocities
      const chordSequence = new Tone.Part((time, chord) => {
        chord.notes.forEach(note => {
          pianoSampler.triggerAttackRelease(
            note, 
            chord.duration, 
            time, 
            chord.velocity
          );
        });
      }, [
        {
          time: '0:0:0',
          notes: ['C3', 'E3', 'G3'],
          duration: '2n',
          velocity: 0.8
        },
        {
          time: '0:2:0',
          notes: ['F3', 'A3', 'C4'],
          duration: '2n',
          velocity: 0.5
        }
      ]);

      chordSequence.start(0);
      await transportController.start();

      await new Promise(resolve => setTimeout(resolve, 200));

      chordSequence.stop();
      await transportController.stop();
    });
  });

  describe('Sample Swapping During Playback', () => {
    it('should swap drum kit samples without interruption', async () => {
      // Initial drum kit
      const drumSampler = new Tone.Sampler({
        urls: {
          C1: 'rock/kick.mp3',
          D1: 'rock/snare.mp3',
          E1: 'rock/hihat.mp3'
        },
        baseUrl: '/drums/',
      }).toDestination();

      testSamplers.set('drums', drumSampler);

      // Drum loop
      let currentKit = 'rock';
      const drumLoop = new Tone.Loop((time) => {
        drumSampler.triggerAttackRelease('C1', '8n', time);
      }, '4n');

      drumLoop.start(0);
      await transportController.start();

      // Let it play
      await new Promise(resolve => setTimeout(resolve, 500));

      // Swap to jazz kit
      const newUrls = {
        C1: 'jazz/kick.mp3',
        D1: 'jazz/snare.mp3',
        E1: 'jazz/hihat.mp3'
      };

      // Create new sampler
      const jazzSampler = new Tone.Sampler({
        urls: newUrls,
        baseUrl: '/drums/',
      }).toDestination();

      // Swap samplers
      drumSampler.dispose();
      testSamplers.delete('drums');
      testSamplers.set('drums', jazzSampler);
      
      // Update loop to use new sampler
      drumLoop.callback = (time) => {
        jazzSampler.triggerAttackRelease('C1', '8n', time);
      };

      currentKit = 'jazz';

      // Continue playing with new kit
      await new Promise(resolve => setTimeout(resolve, 500));

      drumLoop.stop();
      await transportController.stop();

      expect(currentKit).toBe('jazz');
    });

    it('should crossfade between instrument presets', async () => {
      // Create two samplers for crossfading
      const sampler1 = new Tone.Sampler({
        urls: { C3: 'piano/C3.mp3' },
        baseUrl: '/samples/',
      }).toDestination();

      const sampler2 = new Tone.Sampler({
        urls: { C3: 'rhodes/C3.mp3' },
        baseUrl: '/samples/',
      }).toDestination();

      testSamplers.set('sampler1', sampler1);
      testSamplers.set('sampler2', sampler2);

      // Set initial volumes
      sampler1.volume.value = 0;
      sampler2.volume.value = -Infinity;

      // Play note on both samplers
      const noteLoop = new Tone.Loop((time) => {
        sampler1.triggerAttackRelease('C3', '4n', time);
        sampler2.triggerAttackRelease('C3', '4n', time);
      }, '2n');

      noteLoop.start(0);
      await transportController.start();

      // Crossfade over 1 second
      const crossfadeDuration = 1;
      const startTime = Tone.now();
      
      sampler1.volume.linearRampTo(-Infinity, crossfadeDuration);
      sampler2.volume.linearRampTo(0, crossfadeDuration);

      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify crossfade completed
      expect(sampler1.volume.value).toBeLessThan(-20);
      expect(sampler2.volume.value).toBeCloseTo(0, 1);

      noteLoop.stop();
      await transportController.stop();
    });
  });

  describe('Multi-track Audio Playback', () => {
    it('should play multiple synchronized tracks', async () => {
      // Create multiple instrument tracks
      const tracks = {
        drums: new Tone.Sampler({
          urls: { C1: 'kick.mp3' },
          baseUrl: '/drums/',
        }).toDestination(),
        
        bass: new Tone.Sampler({
          urls: { C2: 'bass-C2.mp3' },
          baseUrl: '/bass/',
        }).toDestination(),
        
        keys: new Tone.Sampler({
          urls: { C4: 'keys-C4.mp3' },
          baseUrl: '/keys/',
        }).toDestination()
      };

      Object.entries(tracks).forEach(([name, sampler]) => {
        testSamplers.set(name, sampler);
      });

      // Create patterns for each track
      const drumPattern = new Tone.Loop((time) => {
        tracks.drums.triggerAttackRelease('C1', '8n', time);
      }, '4n');

      const bassPattern = new Tone.Loop((time) => {
        tracks.bass.triggerAttackRelease('C2', '4n', time);
      }, '2n');

      const keysPattern = new Tone.Loop((time) => {
        tracks.keys.triggerAttackRelease('C4', '1n', time);
      }, '1m');

      // Start all patterns at the same time
      const startTime = 0;
      drumPattern.start(startTime);
      bassPattern.start(startTime);
      keysPattern.start(startTime);

      await transportController.start();

      // Let them play together
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Stop all patterns
      drumPattern.stop();
      bassPattern.stop();
      keysPattern.stop();
      
      await transportController.stop();
    });

    it('should handle track muting and soloing', async () => {
      const tracks = new Map<string, { sampler: Tone.Sampler, muted: boolean }>();
      
      // Create tracks with mute state
      ['drums', 'bass', 'harmony'].forEach(name => {
        const sampler = new Tone.Sampler({
          urls: { C3: `${name}.mp3` },
          baseUrl: '/samples/',
        }).toDestination();
        
        tracks.set(name, { sampler, muted: false });
        testSamplers.set(name, sampler);
      });

      // Create a simple pattern that plays all tracks
      const pattern = new Tone.Loop((time) => {
        tracks.forEach((track, name) => {
          if (!track.muted) {
            track.sampler.triggerAttackRelease('C3', '8n', time);
          }
        });
      }, '4n');

      pattern.start(0);
      await transportController.start();

      // Mute drums
      const drumsTrack = tracks.get('drums')!;
      drumsTrack.muted = true;
      drumsTrack.sampler.volume.value = -Infinity;

      await new Promise(resolve => setTimeout(resolve, 500));

      // Solo bass (mute all others)
      tracks.forEach((track, name) => {
        if (name === 'bass') {
          track.muted = false;
          track.sampler.volume.value = 0;
        } else {
          track.muted = true;
          track.sampler.volume.value = -Infinity;
        }
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Unmute all
      tracks.forEach(track => {
        track.muted = false;
        track.sampler.volume.value = 0;
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      pattern.stop();
      await transportController.stop();
    });
  });

  describe('Audio Effects and Processing', () => {
    it('should apply effects to samples', async () => {
      // Create sampler with effects chain
      const reverb = new Tone.Reverb(2).toDestination();
      const delay = new Tone.Delay(0.25, 0.5).connect(reverb);
      
      const sampler = new Tone.Sampler({
        urls: { C3: 'piano.mp3' },
        baseUrl: '/samples/',
      }).connect(delay);

      testSamplers.set('effected', sampler);

      // Play with effects
      const pattern = new Tone.Loop((time) => {
        sampler.triggerAttackRelease('C3', '8n', time);
      }, '4n');

      pattern.start(0);
      await transportController.start();

      await new Promise(resolve => setTimeout(resolve, 1000));

      pattern.stop();
      await transportController.stop();

      // Clean up effects
      reverb.dispose();
      delay.dispose();
    });

    it('should handle dynamic parameter changes', async () => {
      const filter = new Tone.Filter(1000, 'lowpass').toDestination();
      const sampler = new Tone.Sampler({
        urls: { C3: 'synth.mp3' },
        baseUrl: '/samples/',
      }).connect(filter);

      testSamplers.set('filtered', sampler);

      // Automate filter frequency
      const lfo = new Tone.LFO(0.5, 200, 2000);
      lfo.connect(filter.frequency);
      lfo.start();

      const pattern = new Tone.Loop((time) => {
        sampler.triggerAttackRelease('C3', '4n', time);
      }, '8n');

      pattern.start(0);
      await transportController.start();

      await new Promise(resolve => setTimeout(resolve, 2000));

      pattern.stop();
      await transportController.stop();

      // Clean up
      lfo.dispose();
      filter.dispose();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle multiple simultaneous voices efficiently', async () => {
      const polySampler = new Tone.Sampler({
        urls: {
          C3: 'C3.mp3',
          C4: 'C4.mp3',
          C5: 'C5.mp3',
        },
        baseUrl: '/samples/',
      }).toDestination();

      testSamplers.set('poly', polySampler);

      // Play multiple notes simultaneously
      const chordPattern = new Tone.Loop((time) => {
        // Play a 5-note chord
        ['C3', 'E3', 'G3', 'C4', 'E4'].forEach((note, i) => {
          polySampler.triggerAttackRelease(
            note, 
            '4n', 
            time + i * 0.01 // Slight stagger
          );
        });
      }, '2n');

      chordPattern.start(0);
      await transportController.start();

      // Monitor performance
      const startCPU = performance.now();
      await new Promise(resolve => setTimeout(resolve, 1000));
      const cpuTime = performance.now() - startCPU;

      // Should complete without significant lag
      expect(cpuTime).toBeLessThan(1100); // Allow 100ms overhead

      chordPattern.stop();
      await transportController.stop();
    });

    it('should properly dispose of audio resources', async () => {
      const samplers: Tone.Sampler[] = [];
      
      // Create multiple samplers
      for (let i = 0; i < 5; i++) {
        const sampler = new Tone.Sampler({
          urls: { C3: 'test.mp3' },
          baseUrl: '/samples/',
        }).toDestination();
        
        samplers.push(sampler);
      }

      // Play briefly
      await transportController.start();
      samplers.forEach(sampler => {
        sampler.triggerAttackRelease('C3', '8n');
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      await transportController.stop();

      // Dispose all samplers
      samplers.forEach(sampler => {
        sampler.dispose();
        expect(sampler.disposed).toBe(true);
      });

      // Verify resources are freed
      expect(samplers.every(s => s.disposed)).toBe(true);
    });
  });
});