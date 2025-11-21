/**
 * SimpleRegionScheduler - Temporary scheduler to connect regions to audio playback
 *
 * This is a minimal implementation to schedule region events and emit triggers
 * for the AudioEventRouter to play sounds.
 */

import { EventBus } from './EventBus.js';
import { getLogger } from '@/utils/logger.js';
import * as Tone from 'tone';

const logger = getLogger('SimpleRegionScheduler');

interface Region {
  id: string;
  trackId: string;
  startTime: number;
  duration: number;
  pattern?: {
    events?: Array<{
      position: string;
      type: string;
      velocity?: number;
    }>;
  };
}

interface Track {
  id: string;
  name: string;
  regions: Region[];
  instrumentType?: string;
}

export class SimpleRegionScheduler {
  private eventBus: EventBus;
  private isRunning = false;
  private scheduledEvents = new Map<string, any>();
  private currentLoopId: any = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Start scheduling regions for playback
   */
  start(tracks: Track[]): void {
    if (this.isRunning) return;

    logger.info('Starting SimpleRegionScheduler with tracks:', tracks.map(t => t.name));
    this.isRunning = true;

    // Schedule all regions
    tracks.forEach(track => {
      this.scheduleTrackRegions(track);
    });
  }

  /**
   * Stop all scheduled events
   */
  stop(): void {
    if (!this.isRunning) return;

    logger.info('Stopping SimpleRegionScheduler');
    this.isRunning = false;

    // Cancel loop
    if (this.currentLoopId) {
      Tone.Transport.clear(this.currentLoopId);
      this.currentLoopId = null;
    }

    // Clear all scheduled events
    this.scheduledEvents.forEach(id => {
      Tone.Transport.clear(id);
    });
    this.scheduledEvents.clear();
  }

  /**
   * Schedule regions for a track
   */
  private scheduleTrackRegions(track: Track): void {
    const instrumentType = track.instrumentType || track.name.toLowerCase();

    track.regions.forEach(region => {
      if (region.pattern?.events) {
        region.pattern.events.forEach(event => {
          // Parse Tone.js position format (e.g., "0:0:0")
          const [bar, beat, subdivision] = event.position.split(':').map(Number);
          const timeInBeats = bar * 4 + beat + subdivision / 4;
          const scheduleTime = region.startTime + timeInBeats;

          // Schedule the event
          const eventId = Tone.Transport.schedule((time) => {
            this.emitTriggerEvent(instrumentType, event, time);
          }, `${Math.floor(scheduleTime / 4)}:${scheduleTime % 4}:0`);

          this.scheduledEvents.set(`${region.id}_${event.position}`, eventId);
        });
      }
    });
  }

  /**
   * Emit trigger event based on instrument type
   */
  private emitTriggerEvent(instrumentType: string, event: any, time: number): void {
    const audioTime = time;
    const timestamp = Date.now();

    if (instrumentType.includes('metronome')) {
      // Emit metronome trigger
      const type = event.type === 'accent' ? 'accent' : 'click';
      logger.debug(`Emitting metronome-trigger: ${type} at ${audioTime.toFixed(3)}`);

      this.eventBus.emit('metronome-trigger', {
        type,
        audioTime,
        timestamp,
        velocity: event.velocity || 0.8,
      });
    } else if (instrumentType.includes('drum')) {
      // Map event type to drum piece
      const drumMap: Record<string, string> = {
        'kick': 'kick',
        'snare': 'snare',
        'hihat': 'hihat',
        'openhat': 'openHihat',
        'crash': 'crash',
        'ride': 'ride',
        'accent': 'kick',  // Default accent to kick
        'click': 'hihat',  // Default click to hihat
      };

      const drum = drumMap[event.type] || 'kick';
      logger.debug(`Emitting drum-trigger: ${drum} at ${audioTime.toFixed(3)}`);

      this.eventBus.emit('drum-trigger', {
        drum,
        audioTime,
        timestamp,
        velocity: event.velocity || 0.8,
      });
    }
  }

  /**
   * Create a simple looping pattern (for testing)
   */
  startSimpleLoop(type: 'metronome' | 'drums', bpm: number = 120): void {
    if (this.currentLoopId) {
      Tone.Transport.clear(this.currentLoopId);
    }

    // Create a simple 4/4 pattern
    const interval = '4n'; // Quarter notes
    let beat = 0;

    this.currentLoopId = Tone.Transport.scheduleRepeat((time) => {
      if (!this.isRunning) return;

      if (type === 'metronome') {
        const isAccent = beat % 4 === 0;
        this.eventBus.emit('metronome-trigger', {
          type: isAccent ? 'accent' : 'click',
          audioTime: time,
          timestamp: Date.now(),
          velocity: isAccent ? 1.0 : 0.8,
        });
      } else {
        // Simple drum pattern
        if (beat % 4 === 0) {
          // Kick on 1
          this.eventBus.emit('drum-trigger', {
            drum: 'kick',
            audioTime: time,
            timestamp: Date.now(),
            velocity: 0.9,
          });
        }
        if (beat % 4 === 2) {
          // Snare on 3
          this.eventBus.emit('drum-trigger', {
            drum: 'snare',
            audioTime: time,
            timestamp: Date.now(),
            velocity: 0.8,
          });
        }
        // Hihat on every beat
        this.eventBus.emit('drum-trigger', {
          drum: 'hihat',
          audioTime: time,
          timestamp: Date.now(),
          velocity: 0.6,
        });
      }

      beat++;
    }, interval);

    logger.info(`Started simple ${type} loop at ${bpm} BPM`);
  }
}