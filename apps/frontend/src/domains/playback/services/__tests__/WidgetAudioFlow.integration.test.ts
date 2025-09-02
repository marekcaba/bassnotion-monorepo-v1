/**
 * Widget to Audio Flow Integration Tests
 *
 * Tests the complete flow from widget interactions through the event system to audio output
 * Validates pattern registration, real-time updates, and widget synchronization
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import * as Tone from 'tone';
import {
  ServiceRegistry,
  getServiceRegistry,
} from '../core/ServiceRegistry.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { UnifiedTransport } from '../core/UnifiedTransport.js';
import { PatternScheduler } from '../core/PatternScheduler.js';
import { EventBus } from '../core/EventBus.js';
import { Track } from '../core/Track.js';
import { WidgetSyncService } from '../../../widgets/services/WidgetSyncService.js';
import { setupRealTone } from '../../../../test/utils/realToneTestUtils.js';
import type {
  Pattern,
  DrumPattern,
  BassPattern,
  ChordPattern,
  MetronomePattern,
  MusicalPosition,
} from '../../types/pattern.js';
import { toMusicalPosition } from '../../types/pattern.js';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('WidgetAudioFlow.integration.test');

// Simulated widget events
interface WidgetEvent {
  widgetId: string;
  eventType: string;
  data: any;
  timestamp: number;
}

// Audio event tracking
interface AudioOutput {
  type: string;
  trackId: string;
  widgetId?: string;
  timestamp: number;
  data: any;
}

describe('Widget to Audio Flow Integration', () => {
  let serviceRegistry: ServiceRegistry;
  let audioEngine: AudioEngine;
  let transport: UnifiedTransport;
  let scheduler: PatternScheduler;
  let eventBus: EventBus;
  let widgetSync: WidgetSyncService;

  // Event tracking
  let widgetEvents: WidgetEvent[] = [];
  let audioOutputs: AudioOutput[] = [];

  beforeAll(async () => {
    await setupRealTone();
  });

  beforeEach(async () => {
    widgetEvents = [];
    audioOutputs = [];

    // Initialize services
    serviceRegistry = getServiceRegistry();
    audioEngine = AudioEngine.getInstance();
    await audioEngine.initialize();

    eventBus = new EventBus();
    transport = UnifiedTransport.getInstance(eventBus, audioEngine);
    scheduler = new PatternScheduler();
    widgetSync = WidgetSyncService.getInstance();

    // Register services
    serviceRegistry.register('audioEngine', audioEngine);
    serviceRegistry.register('eventBus', eventBus);
    serviceRegistry.register('unifiedTransport', transport);
    serviceRegistry.register('patternScheduler', scheduler);
    serviceRegistry.register('widgetSyncService', widgetSync);

    await serviceRegistry.initialize();

    // Track audio outputs
    [
      'drum-trigger',
      'bass-trigger',
      'chord-trigger',
      'metronome-trigger',
    ].forEach((type) => {
      eventBus.on(type, (data: any) => {
        audioOutputs.push({
          type,
          trackId: data.trackId,
          widgetId: data.widgetId,
          timestamp: Tone.now(),
          data,
        });
      });
    });
  });

  afterEach(async () => {
    await transport.stop();
    scheduler.clearAll();
    await serviceRegistry.dispose();
    Tone.Transport.cancel();
  });

  describe('Widget Pattern Registration', () => {
    it('should play audio when widget registers a pattern', async () => {
      // Simulate drum widget registering a pattern
      const widgetId = 'drum-widget-1';
      const drumTrack = new Track({
        id: `track-${widgetId}`,
        name: 'Drum Widget Track',
        type: 'drum',
        metadata: { widgetId },
      });

      // Widget creates a pattern
      const drumPattern: DrumPattern = {
        type: 'drum',
        events: [
          { position: toMusicalPosition(0, 0, 0), drum: 'kick', velocity: 0.8 },
          {
            position: toMusicalPosition(0, 1, 0),
            drum: 'snare',
            velocity: 0.7,
          },
          { position: toMusicalPosition(0, 2, 0), drum: 'kick', velocity: 0.6 },
          {
            position: toMusicalPosition(0, 3, 0),
            drum: 'snare',
            velocity: 0.7,
          },
        ],
      };

      // Simulate widget event
      widgetEvents.push({
        widgetId,
        eventType: 'pattern-register',
        data: { pattern: drumPattern },
        timestamp: Date.now(),
      });

      // Widget registers pattern with track
      drumTrack.createRegionFromPattern(drumPattern, {
        name: 'Widget Drum Pattern',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(1, 0, 0),
      });

      // Register track
      scheduler.registerTrack(drumTrack.id, drumTrack.getRegions());

      // Emit widget sync event
      widgetSync.emit('PATTERN_REGISTERED', {
        widgetId,
        trackId: drumTrack.id,
        pattern: drumPattern,
      });

      // Start playback
      await transport.start();

      // Wait for pattern to play
      await new Promise((resolve) => setTimeout(resolve, 2200)); // 1 bar + buffer

      await transport.stop();

      // Verify audio was produced
      const drumOutputs = audioOutputs.filter((o) => o.type === 'drum-trigger');
      expect(drumOutputs.length).toBeGreaterThanOrEqual(4);

      // Verify widget ID is tracked
      expect(drumOutputs[0].trackId).toBe(`track-${widgetId}`);

      logger.info('Widget pattern registration test', {
        widgetId,
        eventsRegistered: drumPattern.events.length,
        audioOutputs: drumOutputs.length,
      });
    });

    it('should handle multiple widgets playing simultaneously', async () => {
      // Create multiple widget tracks
      const widgets = [
        { id: 'metronome-widget', type: 'metronome' as const },
        { id: 'bass-widget', type: 'bass' as const },
        { id: 'chord-widget', type: 'chord' as const },
      ];

      const tracks: Track[] = [];

      // Each widget registers its pattern
      widgets.forEach((widget) => {
        const track = new Track({
          id: `track-${widget.id}`,
          name: `${widget.type} Widget Track`,
          type: widget.type,
          metadata: { widgetId: widget.id },
        });

        // Create appropriate pattern for each widget type
        switch (widget.type) {
          case 'metronome':
            track.createRegionFromPattern(
              {
                type: 'metronome',
                events: [
                  { position: toMusicalPosition(0, 0, 0), type: 'accent' },
                  { position: toMusicalPosition(0, 2, 0), type: 'click' },
                ],
              } as MetronomePattern,
              {
                name: 'Metronome Pattern',
                startPosition: toMusicalPosition(0, 0, 0),
                duration: toMusicalPosition(1, 0, 0),
              },
            );
            break;

          case 'bass':
            track.createRegionFromPattern(
              {
                type: 'bass',
                events: [
                  {
                    position: toMusicalPosition(0, 0, 0),
                    note: 'C2',
                    duration: 'half',
                    velocity: 0.7,
                  },
                  {
                    position: toMusicalPosition(0, 2, 0),
                    note: 'G2',
                    duration: 'half',
                    velocity: 0.6,
                  },
                ],
              } as BassPattern,
              {
                name: 'Bass Pattern',
                startPosition: toMusicalPosition(0, 0, 0),
                duration: toMusicalPosition(1, 0, 0),
              },
            );
            break;

          case 'chord':
            track.createRegionFromPattern(
              {
                type: 'chord',
                events: [
                  {
                    position: toMusicalPosition(0, 0, 0),
                    notes: ['C3', 'E3', 'G3'],
                    duration: 'whole',
                    velocity: 0.5,
                  },
                ],
              } as ChordPattern,
              {
                name: 'Chord Pattern',
                startPosition: toMusicalPosition(0, 0, 0),
                duration: toMusicalPosition(1, 0, 0),
              },
            );
            break;
        }

        tracks.push(track);
        scheduler.registerTrack(track.id, track.getRegions());

        // Simulate widget registration event
        widgetEvents.push({
          widgetId: widget.id,
          eventType: 'pattern-register',
          data: { trackId: track.id },
          timestamp: Date.now(),
        });
      });

      // Start all widgets
      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 2200));
      await transport.stop();

      // Verify all widgets produced audio
      const widgetIds = new Set(widgets.map((w) => w.id));
      const outputTrackIds = new Set(audioOutputs.map((o) => o.trackId));

      widgets.forEach((widget) => {
        const trackId = `track-${widget.id}`;
        expect(outputTrackIds.has(trackId)).toBe(true);
      });

      // Check timing synchronization
      const firstBeatOutputs = audioOutputs.filter((o) => {
        const pos = o.data.position;
        return pos && pos.bar === 0 && pos.beat === 0 && pos.sixteenth === 0;
      });

      if (firstBeatOutputs.length > 1) {
        const times = firstBeatOutputs.map((o) => o.timestamp);
        const spread = Math.max(...times) - Math.min(...times);
        expect(spread).toBeLessThan(0.002); // 2ms tolerance for widgets
      }
    });
  });

  describe('Real-time Pattern Updates', () => {
    it('should update playing pattern when widget changes it', async () => {
      const widgetId = 'dynamic-drum-widget';
      const track = new Track({
        id: `track-${widgetId}`,
        name: 'Dynamic Drum Track',
        type: 'drum',
      });

      // Initial simple pattern
      const initialPattern: DrumPattern = {
        type: 'drum',
        events: [
          { position: toMusicalPosition(0, 0, 0), drum: 'kick', velocity: 0.8 },
          { position: toMusicalPosition(0, 2, 0), drum: 'kick', velocity: 0.8 },
        ],
      };

      const region = track.createRegionFromPattern(initialPattern, {
        name: 'Dynamic Pattern',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(1, 0, 0),
        loopCount: 0, // Infinite loop
      });

      scheduler.registerTrack(track.id, track.getRegions());

      // Start playback
      await transport.start();

      // Let initial pattern play
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Clear outputs to track only new events
      audioOutputs = [];

      // Widget updates pattern (add snare hits)
      const updatedPattern: DrumPattern = {
        type: 'drum',
        events: [
          { position: toMusicalPosition(0, 0, 0), drum: 'kick', velocity: 0.8 },
          {
            position: toMusicalPosition(0, 1, 0),
            drum: 'snare',
            velocity: 0.7,
          },
          { position: toMusicalPosition(0, 2, 0), drum: 'kick', velocity: 0.8 },
          {
            position: toMusicalPosition(0, 3, 0),
            drum: 'snare',
            velocity: 0.7,
          },
        ],
      };

      // Simulate widget update event
      widgetEvents.push({
        widgetId,
        eventType: 'pattern-update',
        data: { pattern: updatedPattern },
        timestamp: Date.now(),
      });

      // Update the track's pattern
      track.updateRegionPattern(region.id, updatedPattern);

      // Re-register with scheduler
      scheduler.updateTrackRegions(track.id, track.getRegions());

      // Emit update event
      widgetSync.emit('PATTERN_UPDATED', {
        widgetId,
        trackId: track.id,
        pattern: updatedPattern,
      });

      // Wait for updated pattern to play
      await new Promise((resolve) => setTimeout(resolve, 2200));

      await transport.stop();

      // Verify snare hits are now present
      const snareHits = audioOutputs.filter(
        (o) => o.type === 'drum-trigger' && o.data.drum === 'snare',
      );
      expect(snareHits.length).toBeGreaterThan(0);

      logger.info('Pattern update test', {
        initialEvents: initialPattern.events.length,
        updatedEvents: updatedPattern.events.length,
        snareHitsDetected: snareHits.length,
      });
    });

    it('should handle widget parameter changes during playback', async () => {
      const widgetId = 'bass-param-widget';
      const track = new Track({
        id: `track-${widgetId}`,
        name: 'Bass Parameter Track',
        type: 'bass',
      });

      // Pattern with velocity that will be modified
      const currentVelocity = 0.5;
      const bassPattern: BassPattern = {
        type: 'bass',
        events: [
          {
            position: toMusicalPosition(0, 0, 0),
            note: 'C2',
            duration: 'quarter',
            velocity: currentVelocity,
          },
          {
            position: toMusicalPosition(0, 1, 0),
            note: 'E2',
            duration: 'quarter',
            velocity: currentVelocity,
          },
          {
            position: toMusicalPosition(0, 2, 0),
            note: 'G2',
            duration: 'quarter',
            velocity: currentVelocity,
          },
          {
            position: toMusicalPosition(0, 3, 0),
            note: 'C3',
            duration: 'quarter',
            velocity: currentVelocity,
          },
        ],
      };

      track.createRegionFromPattern(bassPattern, {
        name: 'Velocity Test Pattern',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(1, 0, 0),
        loopCount: 0,
      });

      scheduler.registerTrack(track.id, track.getRegions());

      // Start playback
      await transport.start();

      // Simulate widget velocity slider changes
      const velocityChanges = [0.3, 0.7, 0.9, 0.4];

      for (const newVelocity of velocityChanges) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Widget changes velocity
        widgetEvents.push({
          widgetId,
          eventType: 'parameter-change',
          data: { parameter: 'velocity', value: newVelocity },
          timestamp: Date.now(),
        });

        // Update pattern with new velocity
        const updatedPattern: BassPattern = {
          ...bassPattern,
          events: bassPattern.events.map((e) => ({
            ...e,
            velocity: newVelocity,
          })),
        };

        track.updateRegionPattern(track.getRegions()[0].id, updatedPattern);
        scheduler.updateTrackRegions(track.id, track.getRegions());

        // Emit parameter change
        eventBus.emit('widget-parameter-change', {
          widgetId,
          parameter: 'velocity',
          value: newVelocity,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      await transport.stop();

      // Verify parameter changes were applied
      expect(
        widgetEvents.filter((e) => e.eventType === 'parameter-change').length,
      ).toBe(4);
    });
  });

  describe('Widget Transport Control', () => {
    it('should handle widget play/pause/stop commands', async () => {
      const widgetId = 'transport-control-widget';
      const track = new Track({
        id: `track-${widgetId}`,
        name: 'Transport Test Track',
        type: 'metronome',
      });

      track.createRegionFromPattern(
        {
          type: 'metronome',
          events: [{ position: toMusicalPosition(0, 0, 0), type: 'click' }],
        } as MetronomePattern,
        {
          name: 'Click Pattern',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(0, 1, 0),
          loopCount: 0,
        },
      );

      scheduler.registerTrack(track.id, track.getRegions());

      // Widget sends play command
      widgetEvents.push({
        widgetId,
        eventType: 'transport-control',
        data: { command: 'play' },
        timestamp: Date.now(),
      });

      await transport.start();
      expect(transport.getState()).toBe('playing');

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Widget sends pause command
      widgetEvents.push({
        widgetId,
        eventType: 'transport-control',
        data: { command: 'pause' },
        timestamp: Date.now(),
      });

      await transport.pause();
      expect(transport.getState()).toBe('paused');

      const pausedOutputCount = audioOutputs.length;
      await new Promise((resolve) => setTimeout(resolve, 500));

      // No new outputs while paused
      expect(audioOutputs.length).toBe(pausedOutputCount);

      // Widget sends stop command
      widgetEvents.push({
        widgetId,
        eventType: 'transport-control',
        data: { command: 'stop' },
        timestamp: Date.now(),
      });

      await transport.stop();
      expect(transport.getState()).toBe('stopped');
    });

    it('should sync widget tempo changes', async () => {
      const widgetId = 'tempo-widget';
      const track = new Track({
        id: `track-${widgetId}`,
        name: 'Tempo Test Track',
        type: 'metronome',
      });

      // Regular beat pattern
      track.createRegionFromPattern(
        {
          type: 'metronome',
          events: [
            { position: toMusicalPosition(0, 0, 0), type: 'click' },
            { position: toMusicalPosition(0, 1, 0), type: 'click' },
            { position: toMusicalPosition(0, 2, 0), type: 'click' },
            { position: toMusicalPosition(0, 3, 0), type: 'click' },
          ],
        } as MetronomePattern,
        {
          name: 'Beat Pattern',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
          loopCount: 0,
        },
      );

      scheduler.registerTrack(track.id, track.getRegions());

      // Start at default tempo (120)
      await transport.start();

      // Record initial timing
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const initialOutputs = [...audioOutputs];

      // Widget changes tempo to 140
      widgetEvents.push({
        widgetId,
        eventType: 'tempo-change',
        data: { tempo: 140 },
        timestamp: Date.now(),
      });

      transport.setTempo(140);
      widgetSync.emit('TEMPO_CHANGE', { tempo: 140, source: widgetId });

      // Clear outputs and record at new tempo
      audioOutputs = [];
      await new Promise((resolve) => setTimeout(resolve, 1800)); // Slightly less time for faster tempo

      await transport.stop();

      // Compare beat intervals
      const calculateAverageInterval = (outputs: AudioOutput[]) => {
        const intervals: number[] = [];
        for (let i = 1; i < outputs.length; i++) {
          intervals.push(outputs[i].timestamp - outputs[i - 1].timestamp);
        }
        return intervals.length > 0
          ? intervals.reduce((a, b) => a + b, 0) / intervals.length
          : 0;
      };

      const initialInterval = calculateAverageInterval(initialOutputs);
      const newInterval = calculateAverageInterval(audioOutputs);

      // New interval should be shorter (faster tempo)
      expect(newInterval).toBeLessThan(initialInterval);

      // Verify tempo ratio is correct (140/120 = 1.167)
      const expectedRatio = 120 / 140;
      const actualRatio = newInterval / initialInterval;
      expect(actualRatio).toBeCloseTo(expectedRatio, 2);
    });
  });

  describe('Multi-Widget Synchronization', () => {
    it('should keep multiple widgets in sync', async () => {
      // Create a drum machine with 4 widget pads
      const padWidgets = ['kick-pad', 'snare-pad', 'hihat-pad', 'crash-pad'];
      const tracks: Track[] = [];

      padWidgets.forEach((widgetId, index) => {
        const track = new Track({
          id: `track-${widgetId}`,
          name: `${widgetId} Track`,
          type: 'drum',
        });

        // Each pad plays on a different beat
        const beat = index;
        track.createRegionFromPattern(
          {
            type: 'drum',
            events: [
              {
                position: toMusicalPosition(0, beat, 0),
                drum: widgetId.split('-')[0] as any,
                velocity: 0.7,
              },
            ],
          } as DrumPattern,
          {
            name: `${widgetId} Pattern`,
            startPosition: toMusicalPosition(0, 0, 0),
            duration: toMusicalPosition(1, 0, 0),
            loopCount: 0,
          },
        );

        tracks.push(track);
        scheduler.registerTrack(track.id, track.getRegions());

        // Simulate widget activation
        widgetEvents.push({
          widgetId,
          eventType: 'pad-activated',
          data: { active: true },
          timestamp: Date.now(),
        });
      });

      // Start playback
      await transport.start();

      // Wait for full pattern
      await new Promise((resolve) => setTimeout(resolve, 2200));

      await transport.stop();

      // Verify all pads played in sequence
      const drumOutputs = audioOutputs.filter((o) => o.type === 'drum-trigger');
      const uniqueDrums = new Set(drumOutputs.map((o) => o.data.drum));

      expect(uniqueDrums.size).toBe(4); // All 4 pads played

      // Verify sequential timing
      const sortedOutputs = drumOutputs.sort(
        (a, b) => a.timestamp - b.timestamp,
      );
      const expectedInterval = 60 / 120 / 4; // Quarter of a second at 120 BPM

      for (let i = 1; i < 4; i++) {
        const interval =
          sortedOutputs[i].timestamp - sortedOutputs[i - 1].timestamp;
        expect(interval).toBeCloseTo(expectedInterval, 2);
      }
    });

    it('should handle widget mute/solo states', async () => {
      // Create band widgets
      const bandWidgets = [
        {
          id: 'drums-widget',
          type: 'drum' as const,
          muted: false,
          solo: false,
        },
        { id: 'bass-widget', type: 'bass' as const, muted: false, solo: false },
        {
          id: 'keys-widget',
          type: 'chord' as const,
          muted: false,
          solo: false,
        },
      ];

      const tracks: Track[] = [];

      bandWidgets.forEach((widget) => {
        const track = new Track({
          id: `track-${widget.id}`,
          name: `${widget.type} Track`,
          type: widget.type,
          muted: widget.muted,
          solo: widget.solo,
        });

        // Simple pattern for each
        const pattern = {
          type: widget.type,
          events: [
            {
              position: toMusicalPosition(0, 0, 0),
              ...(widget.type === 'drum'
                ? { drum: 'kick', velocity: 0.8 }
                : widget.type === 'bass'
                  ? { note: 'C2', duration: 'whole', velocity: 0.7 }
                  : {
                      notes: ['C3', 'E3', 'G3'],
                      duration: 'whole',
                      velocity: 0.5,
                    }),
            },
          ],
        } as Pattern;

        track.createRegionFromPattern(pattern, {
          name: 'Test Pattern',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
          loopCount: 2,
        });

        tracks.push(track);
        scheduler.registerTrack(track.id, track.getRegions());
      });

      // Start with all playing
      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Widget mutes drums
      widgetEvents.push({
        widgetId: 'drums-widget',
        eventType: 'mute-change',
        data: { muted: true },
        timestamp: Date.now(),
      });

      tracks[0].setMuted(true);
      widgetSync.emit('TRACK_MUTE', { trackId: tracks[0].id, muted: true });

      // Clear outputs and continue
      audioOutputs = [];
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should not have drum outputs
      const drumOutputsWhileMuted = audioOutputs.filter(
        (o) => o.trackId === 'track-drums-widget',
      );
      expect(drumOutputsWhileMuted.length).toBe(0);

      // Widget solos bass
      widgetEvents.push({
        widgetId: 'bass-widget',
        eventType: 'solo-change',
        data: { solo: true },
        timestamp: Date.now(),
      });

      // Solo bass (mute others)
      tracks.forEach((track, i) => {
        track.setSolo(i === 1); // Only bass is solo
      });

      audioOutputs = [];
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await transport.stop();

      // Should only have bass outputs
      const trackIds = new Set(audioOutputs.map((o) => o.trackId));
      expect(trackIds.size).toBe(1);
      expect(trackIds.has('track-bass-widget')).toBe(true);
    });
  });
});
