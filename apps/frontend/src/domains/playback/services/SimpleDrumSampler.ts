/**
 * Simple Drum Sampler for MVP
 *
 * Loads 3 basic drum samples (kick, snare, hihat) using Web Audio API
 * and provides a Tone.js-compatible interface
 */

import * as Tone from 'tone';
import { createStructuredLogger } from '@bassnotion/contracts';

interface DrumBuffers {
  kick: AudioBuffer | null;
  snare: AudioBuffer | null;
  hihat: AudioBuffer | null;
}

export class SimpleDrumSampler {
  private buffers: DrumBuffers = {
    kick: null,
    snare: null,
    hihat: null,
  };

  private context: AudioContext;
  private output: GainNode;
  private isLoaded = false;

  constructor() {
    this.context = Tone.context as unknown as AudioContext;
    this.output = this.context.createGain();
    this.output.connect(this.context.destination);
  }

  /**
   * Load drum samples from Supabase
   */
  async loadSamples(baseUrl: string): Promise<void> {
    logger.info('🥁 SimpleDrumSampler: Loading samples from', baseUrl);

    const samples = {
      kick: 'kick.mp3',
      snare: 'snare.mp3',
      hihat: 'hihat.mp3',
    };

    const loadPromises = Object.entries(samples).map(
      async ([drum, filename]) => {
        const url = `${baseUrl}${filename}`;

        try {
          logger.info(`🥁 Fetching ${drum} from ${url}`);
          const response = await fetch(url);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

          this.buffers[drum as keyof DrumBuffers] = audioBuffer;
          logger.info(
            `✅ ${drum} loaded: ${audioBuffer.duration}s, ${audioBuffer.sampleRate}Hz`,
          );
        } catch (error) {
          logger.error(`❌ Failed to load ${drum}:`, error);
          // Create synthetic fallback
          this.buffers[drum as keyof DrumBuffers] = this.createSyntheticDrum(
            drum as keyof DrumBuffers,
          );
        }
      },
    );

    await Promise.all(loadPromises);
    this.isLoaded = true;
    logger.info('🥁 SimpleDrumSampler: All samples loaded or synthesized');
  }

  /**
   * Create synthetic drum sound as fallback
   */
  private createSyntheticDrum(drumType: keyof DrumBuffers): AudioBuffer {
    const sampleRate = this.context.sampleRate;
    const duration = drumType === 'kick' ? 0.5 : 0.2;
    const length = sampleRate * duration;
    const buffer = this.context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    if (drumType === 'kick') {
      // Simple kick drum synthesis
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const frequency = 60 * Math.exp(-35 * t);
        data[i] = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-10 * t);
      }
    } else if (drumType === 'snare') {
      // Simple snare synthesis (noise + tone)
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const noise = (Math.random() - 0.5) * 2;
        const tone = Math.sin(2 * Math.PI * 200 * t);
        data[i] = (noise * 0.5 + tone * 0.5) * Math.exp(-30 * t);
      }
    } else {
      // Hihat (filtered noise)
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        data[i] = (Math.random() - 0.5) * Math.exp(-50 * t) * 0.3;
      }
    }

    logger.info(`🎵 Created synthetic ${drumType} drum`);
    return buffer;
  }

  /**
   * Play a drum sound
   */
  play(drumType: keyof DrumBuffers, time?: number, velocity = 1): void {
    const buffer = this.buffers[drumType];
    if (!buffer) {
      logger.warn(`❌ No buffer loaded for ${drumType}`);
      return;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.context.createGain();
    gainNode.gain.value = velocity;

    source.connect(gainNode);
    gainNode.connect(this.output);

    const startTime = time || this.context.currentTime;
    source.start(startTime);

    // Clean up
    source.onended = () => {
      source.disconnect();
      gainNode.disconnect();
    };
  }

  /**
   * Tone.js compatible trigger method
   */
  triggerAttackRelease(
    drumType: string,
    duration: string,
    time?: number,
    velocity = 1,
  ): void {
    if (drumType === 'C1' || drumType === 'C2') {
      // Map note to drum type based on calling context
      // This is a hack but works for MVP
      return;
    }

    this.play(drumType as keyof DrumBuffers, time, velocity);
  }

  get loaded(): boolean {
    return this.isLoaded;
  }

  dispose(): void {
    this.output.disconnect();
  }
}
