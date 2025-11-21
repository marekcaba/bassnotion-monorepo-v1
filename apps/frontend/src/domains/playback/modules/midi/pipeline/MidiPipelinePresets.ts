/**
 * MIDI Pipeline Presets
 *
 * Pre-configured pipelines for common MIDI processing tasks
 */

import { MidiPipelineBuilder } from './MidiPipelineBuilder.js';
import { MidiProcessingPipeline } from './MidiProcessingPipeline.js';
import { MidiVelocityProcessor, MidiQuantizer } from '../index.js';
import type { ParsedMidiFile } from '../parser/index.js';

export interface PresetOptions {
  // Common options for all presets
  validateFirst?: boolean;
  validateAfter?: boolean;
  saveIntermediate?: boolean;
}

/**
 * Collection of preset MIDI processing pipelines
 */
export class MidiPipelinePresets {
  /**
   * Production-ready pipeline
   * Validates, cleans up, and optimizes MIDI for production use
   */
  static production(options: PresetOptions = {}): MidiProcessingPipeline {
    const builder = new MidiPipelineBuilder({
      name: 'Production Pipeline',
      stopOnError: true,
      validateBetweenSteps: true,
      saveIntermediateResults: options.saveIntermediate,
    });

    if (options.validateFirst !== false) {
      builder.validate({
        validateFormat: true,
        validateEvents: true,
        validateTiming: true,
        ruleSet: 'standard',
      });
    }

    return builder
      .quantize({
        resolution: 32,
        strength: 90,
        threshold: 30,
        preserveDurations: true,
      })
      .processVelocity({
        compression: 2.0,
        threshold: 80,
        min: 30,
        max: 120,
        smooth: true,
        smoothWindow: 5,
      })
      .conditional(
        (file) => this.hasTempoChanges(file),
        (b) =>
          b.timeStretch({
            factor: 1.0,
            adjustTempo: true,
            preserveTempo: false,
          }),
      )
      .build();
  }

  /**
   * Live performance pipeline
   * Optimizes MIDI for real-time performance
   */
  static livePerformance(): MidiProcessingPipeline {
    return new MidiPipelineBuilder({
      name: 'Live Performance Pipeline',
      stopOnError: false, // Don't stop on errors during live performance
      validateBetweenSteps: false, // Skip validation for speed
    })
      .quantize({
        resolution: 16,
        strength: 70,
        swing: 10,
        humanize: 15,
      })
      .processVelocity(MidiVelocityProcessor.presets.punchy())
      .addCustomStep('Optimize for latency', async (file) => {
        // Remove unnecessary events for live performance
        return {
          ...file,
          tracks: file.tracks.map((track) => ({
            ...track,
            events: track.events.filter((e) =>
              // Keep only essential events
              [
                'channelNoteOn',
                'channelNoteOff',
                'channelControlChange',
                'channelProgramChange',
                'setTempo',
              ].includes(e.type),
            ),
          })),
        };
      })
      .build();
  }

  /**
   * Educational pipeline
   * Simplifies MIDI for teaching and learning
   */
  static educational(
    options: {
      targetDifficulty?: 'beginner' | 'intermediate' | 'advanced';
      simplifyRhythm?: boolean;
      reduceVelocityRange?: boolean;
    } = {},
  ): MidiProcessingPipeline {
    const {
      targetDifficulty = 'intermediate',
      simplifyRhythm = true,
      reduceVelocityRange = true,
    } = options;

    const builder = new MidiPipelineBuilder({
      name: 'Educational Pipeline',
    });

    // Simplify rhythm if requested
    if (simplifyRhythm) {
      const quantizeResolution = {
        beginner: 8,
        intermediate: 16,
        advanced: 32,
      }[targetDifficulty];

      builder.quantize({
        resolution: quantizeResolution,
        strength: 100,
        preserveDurations: false,
      });
    }

    // Reduce velocity range for beginners
    if (reduceVelocityRange) {
      const velocityRange = {
        beginner: { min: 60, max: 80 },
        intermediate: { min: 50, max: 100 },
        advanced: { min: 30, max: 120 },
      }[targetDifficulty];

      builder.processVelocity({
        scale: 1.0,
        ...velocityRange,
        compression: targetDifficulty === 'beginner' ? 4.0 : 2.0,
        threshold: 70,
      });
    }

    // Slow down for beginners
    if (targetDifficulty === 'beginner') {
      builder.timeStretch({
        factor: 0.75, // 75% speed
        preserveDurations: true,
      });
    }

    return builder.build();
  }

  /**
   * Remix/mashup pipeline
   * Prepares MIDI for remixing and mashups
   */
  static remix(
    options: {
      targetBPM?: number;
      targetKey?: string;
      splitByChannel?: boolean;
    } = {},
  ): MidiProcessingPipeline {
    const builder = new MidiPipelineBuilder({
      name: 'Remix Pipeline',
    });

    // Transpose to target key if specified
    if (options.targetKey) {
      builder.transpose({
        targetKey: options.targetKey,
        sourceKey: 'C', // Assume C if not known
        constrainToScale: true,
        scale: 'major',
      });
    }

    // Adjust tempo if specified
    if (options.targetBPM) {
      builder.addCustomStep('Adjust to target BPM', async (file) => {
        const currentBPM = this.detectBPM(file);
        const factor = options.targetBPM! / currentBPM;

        const result = await import('../transformers/index.js').then((m) =>
          m.MidiTimeStretchProcessor.stretch(file, {
            factor: 1 / factor, // Inverse for BPM change
            adjustTempo: true,
          }),
        );

        return result.stretchedFile;
      });
    }

    // Clean up for remixing
    builder
      .quantize({
        resolution: 16,
        strength: 95,
        swing: 0, // Remove swing for clean remix
      })
      .processVelocity({
        compression: 3.0,
        threshold: 64,
        smooth: true,
      });

    // Split by channel if requested
    if (options.splitByChannel) {
      builder.addCustomStep('Split by channel', async (file) => {
        // This would normally split into multiple files
        // For now, we'll just mark channels in metadata
        const channelsUsed = new Set<number>();

        for (const track of file.tracks) {
          for (const event of track.events) {
            if ('channel' in event) {
              channelsUsed.add(event.channel);
            }
          }
        }

        logger.info('Channels found', { channels: Array.from(channelsUsed) });
        return file;
      });
    }

    return builder.build();
  }

  /**
   * Archive/preservation pipeline
   * Prepares MIDI for long-term archival
   */
  static archive(): MidiProcessingPipeline {
    return new MidiPipelineBuilder({
      name: 'Archive Pipeline',
      stopOnError: true,
      validateBetweenSteps: true,
      saveIntermediateResults: true,
    })
      .validate({
        validateFormat: true,
        validateEvents: true,
        validateTiming: true,
        ruleSet: 'strict', // Strict validation for archival
      })
      .addCustomStep('Add metadata', async (file) => {
        // Add archival metadata
        const archiveTrack = {
          events: [
            {
              type: 'text',
              deltaTime: 0,
              text: `Archived on ${new Date().toISOString()}`,
              data: [],
            },
            {
              type: 'text',
              deltaTime: 0,
              text: 'Processed with BassNotion MIDI Pipeline',
              data: [],
            },
            {
              type: 'endOfTrack',
              deltaTime: 0,
              data: [],
            },
          ],
        };

        return {
          ...file,
          tracks: [archiveTrack, ...file.tracks],
        };
      })
      .build();
  }

  /**
   * Game/interactive pipeline
   * Optimizes MIDI for game engines and interactive applications
   */
  static gameOptimized(): MidiProcessingPipeline {
    return new MidiPipelineBuilder({
      name: 'Game Optimization Pipeline',
    })
      .quantize({
        resolution: 16,
        strength: 100, // Perfect timing for game sync
      })
      .processVelocity({
        fixed: 80, // Consistent velocity for predictable game audio
      })
      .addCustomStep('Optimize for game engine', async (file) => {
        // Remove non-essential events
        const optimized = {
          ...file,
          tracks: file.tracks.map((track) => ({
            ...track,
            events: track.events.filter((e) => {
              // Keep only game-relevant events
              const gameEvents = [
                'channelNoteOn',
                'channelNoteOff',
                'channelProgramChange',
                'setTempo',
                'timeSignature',
                'endOfTrack',
              ];
              return gameEvents.includes(e.type);
            }),
          })),
        };

        // Ensure consistent timing
        for (const track of optimized.tracks) {
          let accumulated = 0;
          for (const event of track.events) {
            // Round to nearest 16th note for game timing
            const rounded = Math.round(event.deltaTime / 30) * 30;
            event.deltaTime = rounded;
            accumulated += rounded;
          }
        }

        return optimized;
      })
      .build();
  }

  /**
   * Helper: Check if file has tempo changes
   */
  private static hasTempoChanges(file: ParsedMidiFile): boolean {
    let tempoCount = 0;
    for (const track of file.tracks) {
      tempoCount += track.events.filter((e) => e.type === 'setTempo').length;
    }
    return tempoCount > 1;
  }

  /**
   * Helper: Detect approximate BPM
   */
  private static detectBPM(file: ParsedMidiFile): number {
    // Find first tempo event
    for (const track of file.tracks) {
      const tempoEvent = track.events.find((e) => e.type === 'setTempo');
      if (tempoEvent && 'bpm' in tempoEvent) {
        return (tempoEvent as any).bpm;
      }
    }
    return 120; // Default BPM
  }
}

const logger = {
  info: (message: string, data?: any) => {
    // SUPPRESSED: MIDI pipeline logging disabled to reduce console noise
  },
};
