/**
 * CC64TimelineBuilder - Builds sustain pedal timeline from MIDI CC64 events
 *
 * Processes harmony control change events (CC64) to create a timeline
 * of pedal up/down states. Uses sample-accurate frame rounding to ensure
 * timeline keys exactly match note scheduling times.
 */

import * as Tone from 'tone';
import type { Region } from '../types/region.types.js';

export class CC64TimelineBuilder {
  private audioContext: AudioContext | null = null;
  private sampleRate: number = 48000;
  private transportStartTime: number = 0;
  private countdownOffsetBeats: number = 0;
  private countdownEnabled: boolean = true;
  private timeConverter: any; // MusicalTimeConverter - will be injected

  constructor() {
    // Empty constructor
  }

  /**
   * Set audio context and sample rate
   */
  setAudioContext(context: AudioContext): void {
    this.audioContext = context;
    this.sampleRate = context.sampleRate;
  }

  /**
   * Set transport start time anchor
   */
  setTransportStartTime(time: number): void {
    this.transportStartTime = time;
  }

  /**
   * Set countdown configuration
   */
  setCountdownConfig(offsetBeats: number, enabled: boolean): void {
    this.countdownOffsetBeats = offsetBeats;
    this.countdownEnabled = enabled;
  }

  /**
   * Set musical time converter (for parsePosition)
   */
  setTimeConverter(converter: any): void {
    this.timeConverter = converter;
  }

  /**
   * Build CC64 timeline from harmony events
   * Maps audioTime → pedal down/up state
   *
   * @param events - Array of pattern events
   * @param region - Region containing the events
   * @returns Map of audioTime to pedal state (true = down, false = up)
   */
  buildTimeline(events: any[], region: Region): Map<number, boolean> {
    const cc64Timeline = new Map<number, boolean>();

    let eventIndex = 0;
    events.forEach((event) => {
      if (event.type === 'harmony-control-change' && event.data?.cc === 64) {
        // 🚨 BUG FIX: Use absolute ticks for CC64 timing (not relative position.tick)
        // CC64 events have event.data.ticks (absolute) which must be used for accurate timing

        const absoluteTicks = (event.data as any).ticks;

        // DIAGNOSTIC: Show tick calculation for first 3 events
        if (eventIndex < 3) {
          const currentBpm = Tone.Transport.bpm.value;
          const secondsPerBeat = 60 / currentBpm;
          const ticksPerBeat = 480; // PPQ standard
          const beatsFromTicks = absoluteTicks / ticksPerBeat;
          const secondsFromTicks = beatsFromTicks * secondsPerBeat;

          // eslint-disable-next-line no-console, no-restricted-syntax
          console.log(`[CC64 TICK DIAGNOSTIC #${eventIndex}]`, {
            absoluteTicks,
            'position.tick (relative)': (event.position as any).tick,
            'position.beat': (event.position as any).beat,
            'position.measure': (event.position as any).measure,
            calculation: {
              ticksPerBeat,
              beatsFromTicks: beatsFromTicks.toFixed(4),
              currentBpm,
              secondsFromTicks: secondsFromTicks.toFixed(6),
            },
          });
        }

        // Calculate event time from ABSOLUTE ticks (not relative position)
        // 🚨 CRITICAL FIX: Use original MIDI file BPM, not current transport BPM
        const originalBpm = (event.data as any)?.originalBpm || Tone.Transport.bpm.value;
        const secondsPerBeat = 60 / originalBpm;
        const ticksPerBeat = 480; // PPQ standard
        const eventTime = (absoluteTicks / ticksPerBeat) * secondsPerBeat;

        // Apply countdown offset
        const offsetTime =
          this.countdownEnabled && !region.skipCountdownOffset
            ? this.timeConverter?.parsePosition(`0:${this.countdownOffsetBeats}:0`) || 0
            : 0;

        let absoluteTime = region.startTime + eventTime + offsetTime;

        // 🚨 CRITICAL FIX: Add transportStartTime to match note scheduling
        // Notes use: audioTime = transportStartTime + absoluteTime
        // CC64 timeline MUST use the same calculation for lookup to work
        const audioTime = this.transportStartTime + absoluteTime;

        // PRECISION FIX: Round to sample-accurate frames (matches note scheduling)
        // This ensures timeline keys EXACTLY match note audioTime values
        // Without this, floating-point precision differences cause lookup failures
        let timelineKey = audioTime;
        if (this.audioContext) {
          const frame = Math.round(audioTime * this.sampleRate);
          timelineKey = frame / this.sampleRate;
        }

        const pedalDown = event.data.value >= 64;
        cc64Timeline.set(timelineKey, pedalDown);

        // Enhanced diagnostic: show position data for first 5 CC64 events
        if (eventIndex < 5) {
          // eslint-disable-next-line no-console, no-restricted-syntax
          console.log(
            `[CC64 TIMELINE #${eventIndex}] timelineKey=${timelineKey.toFixed(6)}s (with transportStartTime + sample precision), pedal=${pedalDown ? 'DOWN' : 'UP'}, value=${event.data.value}, absoluteTime=${absoluteTime.toFixed(6)}s, audioTime=${audioTime.toFixed(6)}s`
          );
        }
        eventIndex++;
      }
    });

    return cc64Timeline;
  }
}
