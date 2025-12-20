/**
 * Track Mixing Engine
 *
 * Professional-grade mixing engine for track-based audio processing.
 * Implements track-level controls, bus routing, and effects processing
 * with automation support and sample-accurate synchronization.
 *
 * Part of Story 3.21 Task 6 - Track Mixing and Routing System
 */

import { getTone } from '@/domains/playback/utils/tone';
import type * as ToneTypes from 'tone';
import { Track } from '../core/Track.js';
import {
  EventBus,
  createStructuredLogger,
  type MusicalPosition,
} from '../../shared/index.js';
import { AudioError } from '../../../errors/AudioErrors.js';
import type {
  TrackMixingState,
  TrackAutomation,
  AutomationPoint,
} from '../../../types/track.js';

// Type adapter for Tone.Timeline compatibility
type TimelineAutomationPoint = AutomationPoint & { time: number };

// Local service implementations
const serviceRegistry = {
  get<T>(name: string): T {
    if (typeof window !== 'undefined' && (window as any).__serviceRegistry) {
      return (window as any).__serviceRegistry.get(name);
    }
    throw new Error(`Service ${name} not found`);
  },
};

// Helper to get Tone from window (must be initialized before Mixer is used)
function getToneFromWindow(): any {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = (window as any).Tone || (window as any).__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error('Mixer: Tone.js not loaded. Ensure AudioEngine is initialized first.');
}

class AudioEngine {
  private static instance: AudioEngine | null = null;

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  getTone(): any {
    return getToneFromWindow();
  }
}

export interface TrackChannel {
  trackId: string;
  input: ToneTypes.ToneAudioNode;
  output: ToneTypes.ToneAudioNode;

  // Processing nodes
  gain: ToneTypes.Gain;
  panner: ToneTypes.Panner;
  mute: ToneTypes.Gain;
  solo: ToneTypes.Gain;

  // Effects chain
  effectsChain: ToneTypes.ToneAudioNode[];
  effectsSend: ToneTypes.Gain;

  // Sends
  sends: Map<string, ToneTypes.Gain>;

  // State
  isMuted: boolean;
  isSoloed: boolean;
  isBypassed: boolean;
}

export interface MixBus {
  busId: string;
  name: string;
  type: 'master' | 'sub' | 'aux';

  // Audio nodes
  input: ToneTypes.ToneAudioNode;
  output: ToneTypes.ToneAudioNode;
  gain: ToneTypes.Gain;

  // Processing
  effectsChain: ToneTypes.ToneAudioNode[];
  compressor?: ToneTypes.Compressor;
  limiter?: ToneTypes.Limiter;

  // Routing
  parentBusId?: string;
  childBusIds: string[];
}

export interface Send {
  sendId: string;
  sourceTracks: string[];
  destinationBusId: string;
  sendPoint: 'pre-fader' | 'post-fader';
  level: number;
  enabled: boolean;
}

export interface MixingSnapshot {
  timestamp: number;
  tracks: Map<string, TrackMixingState>;
  buses: Map<string, { busId: string; gain: number }>;
  sends: Map<string, Send>;
  soloActive: boolean;
}

/**
 * Professional mixing engine for multi-track audio
 */
const logger = createStructuredLogger('Mixer');

export class Mixer {
  // Singleton instance
  private static instance: Mixer | null = null;

  // Core dependencies
  private audioEngine: AudioEngine;
  private eventBus?: EventBus;
  private tone: any;

  // Mixing infrastructure
  private trackChannels = new Map<string, TrackChannel>();
  private mixBuses = new Map<string, MixBus>();
  private sends = new Map<string, Send>();

  // Master bus
  private masterBus: MixBus | null = null;

  // Solo management
  private soloedTracks = new Set<string>();
  private soloMute: ToneTypes.Gain | null = null;

  // Automation
  private automationTimelines = new Map<
    string,
    Map<string, ToneTypes.Timeline<TimelineAutomationPoint>>
  >();

  // Snapshots for recall
  private snapshots = new Map<string, MixingSnapshot>();

  private constructor() {
    this.audioEngine = AudioEngine.getInstance();

    // Try to get Tone from AudioEngine, fallback to window.Tone if not initialized
    try {
      this.tone = this.audioEngine.getTone();
    } catch (error) {
      logger.warn(
        'Mixer: AudioEngine not initialized, using window.Tone fallback',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
      this.tone = (window as any).Tone;
      if (!this.tone) {
        logger.error(
          'Mixer: No Tone.js instance available (neither AudioEngine nor window.Tone)',
        );
      }
    }

    try {
      this.eventBus = serviceRegistry.get<EventBus>('eventBus');
    } catch {
      logger.warn('EventBus not found in ServiceRegistry');
    }

    this.initialize();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): Mixer {
    if (!Mixer.instance) {
      Mixer.instance = new Mixer();
    }
    return Mixer.instance;
  }

  /**
   * Initialize mixing engine
   */
  private initialize(): void {
    // Create master bus
    this.createMasterBus();

    // Create solo mute control
    this.soloMute = new this.tone.Gain(1);

    logger.info('🎛️ Mixer: Initialized');
  }

  /**
   * Create master bus
   * Clean signal path - no processing on master bus for now
   */
  private createMasterBus(): void {
    const masterGain = new this.tone.Gain(1);

    // Clean routing: input -> gain -> output (no compression/limiting for now)
    masterGain.connect(this.tone.getDestination());

    this.masterBus = {
      busId: 'master',
      name: 'Master Bus',
      type: 'master',
      input: masterGain,
      output: masterGain,
      gain: masterGain,
      effectsChain: [],
      childBusIds: [],
    };

    this.mixBuses.set('master', this.masterBus);
  }

  /**
   * Create a track channel
   */
  public createTrackChannel(track: Track): TrackChannel {
    if (this.trackChannels.has(track.id)) {
      throw new AudioError(
        `Track channel already exists for ${track.id}`,
        'CHANNEL_EXISTS',
      );
    }

    // Create audio nodes
    const input = new this.tone.Gain(1);
    const gain = new this.tone.Gain(track.mixing.volume);
    const panner = new this.tone.Panner(track.mixing.pan);
    const mute = new this.tone.Gain(track.mixing.mute ? 0 : 1);
    const solo = new this.tone.Gain(1);
    const effectsSend = new this.tone.Gain(1);
    const output = new this.tone.Gain(1);

    // Build signal chain: input -> gain -> panner -> mute -> solo -> output
    input.connect(gain);
    gain.connect(panner);
    panner.connect(mute);
    mute.connect(solo);
    solo.connect(effectsSend);
    effectsSend.connect(output);

    // Connect to master bus by default
    if (this.masterBus) {
      output.connect(this.masterBus.input);
    }

    // Create channel
    const channel: TrackChannel = {
      trackId: track.id,
      input,
      output,
      gain,
      panner,
      mute,
      solo,
      effectsChain: [],
      effectsSend,
      sends: new Map(),
      isMuted: track.mixing.mute,
      isSoloed: track.mixing.solo,
      isBypassed: false,
    };

    this.trackChannels.set(track.id, channel);

    // Apply initial solo state
    if (track.mixing.solo) {
      this.setSolo(track.id, true);
    }

    // Setup automation if exists
    if (track.automation.length > 0) {
      this.setupTrackAutomation(track.id, track.automation);
    }

    logger.info(`🎛️ Created channel for track ${track.id}`);

    this.eventBus?.emit('mixing:channelCreated', {
      trackId: track.id,
      channelInfo: {
        volume: track.mixing.volume,
        pan: track.mixing.pan,
        mute: track.mixing.mute,
        solo: track.mixing.solo,
      },
    });

    return channel;
  }

  /**
   * Remove a track channel
   */
  public removeTrackChannel(trackId: string): void {
    const channel = this.trackChannels.get(trackId);
    if (!channel) return;

    // Disconnect all nodes
    channel.output.disconnect();
    channel.input.disconnect();
    channel.gain.dispose();
    channel.panner.dispose();
    channel.mute.dispose();
    channel.solo.dispose();
    channel.effectsSend.dispose();

    // Dispose effects
    for (const effect of channel.effectsChain) {
      if ('dispose' in effect) {
        (effect as any).dispose();
      }
    }

    // Dispose sends
    for (const send of channel.sends.values()) {
      send.dispose();
    }

    // Remove from solo if needed
    if (channel.isSoloed) {
      this.soloedTracks.delete(trackId);
      this.updateSoloState();
    }

    this.trackChannels.delete(trackId);

    logger.info(`🎛️ Removed channel for track ${trackId}`);
  }

  /**
   * Update track mixing parameters
   */
  public updateTrackMixing(
    trackId: string,
    params: Partial<TrackMixingState>,
  ): void {
    const channel = this.trackChannels.get(trackId);
    if (!channel) return;

    // Update volume
    if (params.volume !== undefined) {
      channel.gain.gain.rampTo(params.volume, 0.05);
    }

    // Update pan
    if (params.pan !== undefined) {
      channel.panner.pan.rampTo(params.pan, 0.05);
    }

    // Update mute
    if (params.mute !== undefined) {
      channel.isMuted = params.mute;
      channel.mute.gain.rampTo(params.mute ? 0 : 1, 0.01);
    }

    // Update solo
    if (params.solo !== undefined) {
      this.setSolo(trackId, params.solo);
    }

    this.eventBus?.emit('mixing:trackUpdated', {
      trackId,
      params,
    });
  }

  /**
   * Set track solo state
   */
  private setSolo(trackId: string, solo: boolean): void {
    const channel = this.trackChannels.get(trackId);
    if (!channel) return;

    channel.isSoloed = solo;

    if (solo) {
      this.soloedTracks.add(trackId);
    } else {
      this.soloedTracks.delete(trackId);
    }

    this.updateSoloState();
  }

  /**
   * Update solo muting for all tracks
   */
  private updateSoloState(): void {
    const hasSolo = this.soloedTracks.size > 0;

    for (const [trackId, channel] of this.trackChannels.entries()) {
      if (hasSolo) {
        // Mute non-soloed tracks
        const shouldMute = !this.soloedTracks.has(trackId);
        channel.solo.gain.rampTo(shouldMute ? 0 : 1, 0.01);
      } else {
        // Unmute all tracks
        channel.solo.gain.rampTo(1, 0.01);
      }
    }

    this.eventBus?.emit('mixing:soloStateChanged', {
      soloActive: hasSolo,
      soloedTracks: Array.from(this.soloedTracks),
    });
  }

  /**
   * Create a sub-mix bus
   */
  public createSubBus(
    busId: string,
    name: string,
    parentBusId = 'master',
  ): MixBus {
    if (this.mixBuses.has(busId)) {
      throw new AudioError(`Bus ${busId} already exists`, 'BUS_EXISTS');
    }

    const parentBus = this.mixBuses.get(parentBusId);
    if (!parentBus) {
      throw new AudioError(
        `Parent bus ${parentBusId} not found`,
        'PARENT_BUS_NOT_FOUND',
      );
    }

    // Create bus nodes
    const busGain = new this.tone.Gain(1);
    const busCompressor = new this.tone.Compressor({
      threshold: -18,
      ratio: 2,
      attack: 0.005,
      release: 0.1,
    });

    // Chain: input -> compressor -> gain -> parent
    busCompressor.connect(busGain);
    busGain.connect(parentBus.input);

    const bus: MixBus = {
      busId,
      name,
      type: 'sub',
      input: busCompressor,
      output: busGain,
      gain: busGain,
      effectsChain: [],
      compressor: busCompressor,
      parentBusId,
      childBusIds: [],
    };

    this.mixBuses.set(busId, bus);
    parentBus.childBusIds.push(busId);

    logger.info(`🎛️ Created sub-bus ${busId} -> ${parentBusId}`);

    return bus;
  }

  /**
   * Create an aux/effects bus
   */
  public createAuxBus(busId: string, name: string): MixBus {
    if (this.mixBuses.has(busId)) {
      throw new AudioError(`Bus ${busId} already exists`, 'BUS_EXISTS');
    }

    // Create bus nodes
    const busGain = new this.tone.Gain(1);
    const busInput = new this.tone.Gain(1);

    // Connect to master
    busInput.connect(busGain);
    if (this.masterBus) {
      busGain.connect(this.masterBus.input);
    }

    const bus: MixBus = {
      busId,
      name,
      type: 'aux',
      input: busInput,
      output: busGain,
      gain: busGain,
      effectsChain: [],
      childBusIds: [],
    };

    this.mixBuses.set(busId, bus);

    logger.info(`🎛️ Created aux bus ${busId}`);

    return bus;
  }

  /**
   * Route track to bus
   */
  public routeTrackToBus(trackId: string, busId: string): void {
    const channel = this.trackChannels.get(trackId);
    const bus = this.mixBuses.get(busId);

    if (!channel || !bus) {
      throw new AudioError(
        `Track ${trackId} or bus ${busId} not found`,
        'ROUTING_ERROR',
      );
    }

    // Disconnect from current routing
    channel.output.disconnect();

    // Connect to new bus
    channel.output.connect(bus.input);

    logger.info(`🎛️ Routed track ${trackId} to bus ${busId}`);
  }

  /**
   * Create a send from track to aux bus
   */
  public createSend(
    trackId: string,
    auxBusId: string,
    level = 0.5,
    sendPoint: 'pre-fader' | 'post-fader' = 'post-fader',
  ): string {
    const channel = this.trackChannels.get(trackId);
    const auxBus = this.mixBuses.get(auxBusId);

    if (!channel || !auxBus || auxBus.type !== 'aux') {
      throw new AudioError('Invalid track or aux bus for send', 'SEND_ERROR');
    }

    // Create send gain
    const sendGain = new this.tone.Gain(level);
    const sendId = `send-${trackId}-${auxBusId}`;

    // Connect based on send point
    if (sendPoint === 'pre-fader') {
      channel.input.connect(sendGain);
    } else {
      channel.gain.connect(sendGain);
    }

    sendGain.connect(auxBus.input);

    // Store send info
    channel.sends.set(auxBusId, sendGain);

    const send: Send = {
      sendId,
      sourceTracks: [trackId],
      destinationBusId: auxBusId,
      sendPoint,
      level,
      enabled: true,
    };

    this.sends.set(sendId, send);

    logger.info(`🎛️ Created send from track ${trackId} to aux ${auxBusId}`);

    return sendId;
  }

  /**
   * Update send level
   */
  public updateSendLevel(
    trackId: string,
    auxBusId: string,
    level: number,
  ): void {
    const channel = this.trackChannels.get(trackId);
    if (!channel) return;

    const sendGain = channel.sends.get(auxBusId);
    if (sendGain) {
      sendGain.gain.rampTo(level, 0.05);
    }
  }

  /**
   * Add effect to track
   */
  public addTrackEffect(trackId: string, effect: ToneTypes.ToneAudioNode): void {
    const channel = this.trackChannels.get(trackId);
    if (!channel) return;

    // Disconnect current chain
    if (channel.effectsChain.length > 0) {
      const lastEffect = channel.effectsChain[channel.effectsChain.length - 1];
      if (lastEffect) {
        lastEffect.disconnect();
      }
    } else {
      channel.solo.disconnect();
    }

    // Add effect to chain
    if (channel.effectsChain.length > 0) {
      const lastEffect = channel.effectsChain[channel.effectsChain.length - 1];
      if (lastEffect) {
        lastEffect.connect(effect);
      }
    } else {
      channel.solo.connect(effect);
    }

    effect.connect(channel.effectsSend);
    channel.effectsChain.push(effect);

    logger.info(`🎛️ Added effect to track ${trackId}`);
  }

  /**
   * Add effect to bus (including aux return channels)
   */
  public addBusEffect(busId: string, effect: ToneTypes.ToneAudioNode): void {
    const bus = this.mixBuses.get(busId);
    if (!bus) return;

    // Disconnect current chain
    if (bus.effectsChain.length > 0) {
      const lastEffect = bus.effectsChain[bus.effectsChain.length - 1];
      if (lastEffect) {
        lastEffect.disconnect();
      }
    } else {
      bus.input.disconnect();
    }

    // Add effect to chain
    if (bus.effectsChain.length > 0) {
      const lastEffect = bus.effectsChain[bus.effectsChain.length - 1];
      if (lastEffect) {
        lastEffect.connect(effect);
      }
    } else {
      bus.input.connect(effect);
    }

    // Connect to output
    if (bus.type === 'master') {
      effect.connect(bus.compressor || bus.gain);
    } else {
      effect.connect(bus.gain);
    }

    bus.effectsChain.push(effect);

    logger.info(`🎛️ Added effect to ${bus.type} bus ${busId}`);

    this.eventBus?.emit('mixing:busEffectAdded', {
      busId,
      busType: bus.type,
      effectCount: bus.effectsChain.length,
    });
  }

  /**
   * Remove effect from bus
   */
  public removeBusEffect(busId: string, effectIndex: number): void {
    const bus = this.mixBuses.get(busId);
    if (!bus || effectIndex < 0 || effectIndex >= bus.effectsChain.length)
      return;

    const effect = bus.effectsChain[effectIndex];

    // Reconnect chain without this effect
    if (effectIndex === 0) {
      // First effect
      bus.input.disconnect();
      if (bus.effectsChain.length > 1) {
        const nextEffect = bus.effectsChain[1];
        if (nextEffect) {
          bus.input.connect(nextEffect);
        }
      } else {
        bus.input.connect(
          bus.type === 'master' ? bus.compressor || bus.gain : bus.gain,
        );
      }
    } else {
      // Middle or last effect
      const prevEffect = bus.effectsChain[effectIndex - 1];
      if (prevEffect) {
        prevEffect.disconnect();

        if (effectIndex < bus.effectsChain.length - 1) {
          // Connect to next effect
          const nextEffect = bus.effectsChain[effectIndex + 1];
          if (nextEffect) {
            prevEffect.connect(nextEffect);
          }
        } else {
          // Connect to output
          prevEffect.connect(
            bus.type === 'master' ? bus.compressor || bus.gain : bus.gain,
          );
        }
      }
    }

    // Dispose effect if possible
    if (effect && 'dispose' in effect) {
      (effect as any).dispose();
    }

    // Remove from chain
    bus.effectsChain.splice(effectIndex, 1);

    logger.info(`🎛️ Removed effect from ${bus.type} bus ${busId}`);
  }

  /**
   * Create reverb return with effect
   */
  public createReverbReturn(
    name = 'Reverb',
    roomSize = 0.7,
    dampening = 3000,
  ): string {
    const busId = `aux-reverb-${Date.now()}`;
    this.createAuxBus(busId, name);

    // Create reverb effect
    const reverb = new this.tone.Reverb({
      decay: roomSize * 10, // Convert room size to decay time
      preDelay: 0.01,
      wet: 1.0, // 100% wet for return channel
    });

    // Add high-frequency dampening
    const filter = new this.tone.Filter({
      frequency: dampening,
      type: 'lowpass',
    });

    // Add effects to aux bus
    this.addBusEffect(busId, reverb);
    this.addBusEffect(busId, filter);

    logger.info(`🎛️ Created reverb return: ${name}`);

    return busId;
  }

  /**
   * Create delay return with effect
   */
  public createDelayReturn(
    name = 'Delay',
    delayTime = '8n',
    feedback = 0.3,
    mix = 1.0,
  ): string {
    const busId = `aux-delay-${Date.now()}`;
    this.createAuxBus(busId, name);

    // Create delay effect
    const delay = new this.tone.FeedbackDelay({
      delayTime,
      feedback,
      wet: mix,
    });

    // Add high-pass filter to clean up low frequencies
    const highpass = new this.tone.Filter({
      frequency: 100,
      type: 'highpass',
    });

    // Add effects to aux bus
    this.addBusEffect(busId, highpass);
    this.addBusEffect(busId, delay);

    logger.info(`🎛️ Created delay return: ${name}`);

    return busId;
  }

  /**
   * Create compression return for parallel compression
   */
  public createCompressionReturn(
    name = 'Parallel Compression',
    threshold = -20,
    ratio = 8,
  ): string {
    const busId = `aux-compression-${Date.now()}`;
    this.createAuxBus(busId, name);

    // Create compressor
    const compressor = new this.tone.Compressor({
      threshold,
      ratio,
      attack: 0.003,
      release: 0.1,
    });

    // Add slight saturation for character
    const distortion = new this.tone.Distortion({
      distortion: 0.05,
      wet: 0.3,
    });

    // Add effects to aux bus
    this.addBusEffect(busId, compressor);
    this.addBusEffect(busId, distortion);

    logger.info(`🎛️ Created compression return: ${name}`);

    return busId;
  }

  /**
   * Setup track automation
   */
  private setupTrackAutomation(
    trackId: string,
    automations: TrackAutomation[],
  ): void {
    const channel = this.trackChannels.get(trackId);
    if (!channel) return;

    // Create timeline for each automated parameter
    const trackTimelines = new Map<
      string,
      ToneTypes.Timeline<TimelineAutomationPoint>
    >();

    for (const automation of automations) {
      const timeline = new this.tone.Timeline<TimelineAutomationPoint>();

      // Add all automation points with time conversion
      for (const point of automation.points) {
        const timelinePoint: TimelineAutomationPoint = {
          ...point,
          time: this.tone.Transport.toSeconds(point.position),
        };
        timeline.add(timelinePoint);
      }

      trackTimelines.set(automation.parameter, timeline);
    }

    this.automationTimelines.set(trackId, trackTimelines);
  }

  /**
   * Apply automation at current transport position
   */
  public applyAutomation(position: MusicalPosition): void {
    const positionSeconds = this.musicalPositionToSeconds(position);

    for (const [trackId, timelines] of this.automationTimelines.entries()) {
      const channel = this.trackChannels.get(trackId);
      if (!channel) continue;

      // Apply volume automation
      const volumeTimeline = timelines.get('volume');
      if (volumeTimeline) {
        const point = volumeTimeline.get(positionSeconds);
        if (point) {
          channel.gain.gain.rampTo(point.value, 0.01);
        }
      }

      // Apply pan automation
      const panTimeline = timelines.get('pan');
      if (panTimeline) {
        const point = panTimeline.get(positionSeconds);
        if (point) {
          channel.panner.pan.rampTo(point.value, 0.01);
        }
      }
    }
  }

  /**
   * Create mixing snapshot
   */
  public createSnapshot(name: string): void {
    const snapshot: MixingSnapshot = {
      timestamp: Date.now(),
      tracks: new Map(),
      buses: new Map(),
      sends: new Map(this.sends),
      soloActive: this.soloedTracks.size > 0,
    };

    // Capture track states
    for (const [trackId, channel] of this.trackChannels.entries()) {
      snapshot.tracks.set(trackId, {
        volume: channel.gain.gain.value,
        pan: channel.panner.pan.value,
        mute: channel.isMuted,
        solo: channel.isSoloed,
        recordArm: false,
        phaseInvert: false,
        delayCompensation: 0,
      });
    }

    // Capture bus states
    for (const [busId, bus] of this.mixBuses.entries()) {
      snapshot.buses.set(busId, {
        busId,
        gain: bus.gain.gain.value,
      });
    }

    this.snapshots.set(name, snapshot);

    logger.info(`🎛️ Created mixing snapshot: ${name}`);
  }

  /**
   * Recall mixing snapshot
   */
  public recallSnapshot(name: string): void {
    const snapshot = this.snapshots.get(name);
    if (!snapshot) return;

    // Restore track states
    for (const [trackId, state] of snapshot.tracks.entries()) {
      this.updateTrackMixing(trackId, state);
    }

    // Restore bus gains
    for (const [busId, busState] of snapshot.buses.entries()) {
      const bus = this.mixBuses.get(busId);
      if (bus) {
        bus.gain.gain.rampTo(busState.gain, 0.1);
      }
    }

    logger.info(`🎛️ Recalled mixing snapshot: ${name}`);
  }

  /**
   * Get channel for track
   */
  public getTrackChannel(trackId: string): TrackChannel | undefined {
    return this.trackChannels.get(trackId);
  }

  /**
   * Get all buses
   */
  public getBuses(): Map<string, MixBus> {
    return new Map(this.mixBuses);
  }

  /**
   * Get the master bus for external access
   */
  public getMasterBus(): MixBus | null {
    return this.masterBus;
  }

  /**
   * Get the master bus input node for connecting instruments
   * This routes audio through the master compressor and limiter
   *
   * @returns The master bus input node, or null if mixer not initialized
   */
  public getMasterBusInput(): ToneTypes.ToneAudioNode | null {
    if (!this.masterBus) {
      logger.warn('🎛️ Mixer: Master bus not initialized');
      return null;
    }
    return this.masterBus.input;
  }

  /**
   * Get the AudioNode version of master bus input for Web Audio API connections
   * Used when connecting native AudioNodes (like from WamDrummer) to the mixer
   *
   * @returns The underlying AudioNode of the master bus input, or null if not available
   */
  public getMasterBusInputAsAudioNode(): AudioNode | null {
    const input = this.getMasterBusInput();
    if (!input) return null;

    // Tone.js nodes have an underlying Web Audio node we can access
    // Most Tone nodes expose this as .input or can be used directly in connect()
    return (input as any).input || (input as any)._gainNode || input as unknown as AudioNode;
  }

  /**
   * Convert musical position to seconds
   */
  private musicalPositionToSeconds(position: MusicalPosition): number {
    // MusicalPosition is a string in "bars:beats:sixteenths" format
    // Use Tone.js to convert it
    return this.tone.Transport.toSeconds(position);
  }

  /**
   * Apply master fade-in to prevent audio spike on playback start
   *
   * @param startTime - AudioContext time when playback starts
   * @param fadeDuration - Fade duration in seconds (default 20ms)
   *
   * This prevents the audio spike/click that occurs when playback starts
   * by ramping the master gain from near-zero to full over a short duration.
   */
  public applyMasterFadeIn(startTime: number, fadeDuration = 0.02): void {
    if (!this.masterBus) {
      logger.warn('🎛️ Mixer: Cannot apply master fade-in - no master bus');
      return;
    }

    const masterGain = this.masterBus.gain;
    const targetGain = masterGain.gain.value || 1;

    // CRITICAL: Use exponential ramp from near-zero to prevent audio spike
    // Start at 0.001 (not 0, as exponential ramp requires non-zero start)
    masterGain.gain.setValueAtTime(0.001, startTime);
    masterGain.gain.exponentialRampToValueAtTime(targetGain, startTime + fadeDuration);

    logger.info('🎛️ Mixer: Applied master fade-in', {
      startTime: startTime.toFixed(3),
      fadeDuration: `${fadeDuration * 1000}ms`,
      targetGain,
    });
  }

  /**
   * Get mixing metrics
   */
  public getMixingMetrics(): any {
    return {
      trackCount: this.trackChannels.size,
      busCount: this.mixBuses.size,
      sendCount: this.sends.size,
      soloActive: this.soloedTracks.size > 0,
      soloedTracks: Array.from(this.soloedTracks),
    };
  }

  /**
   * Dispose mixing engine
   */
  public dispose(): void {
    // Remove all channels
    for (const trackId of this.trackChannels.keys()) {
      this.removeTrackChannel(trackId);
    }

    // Dispose buses
    for (const bus of this.mixBuses.values()) {
      bus.gain.dispose();
      if (bus.compressor) bus.compressor.dispose();
      if (bus.limiter) bus.limiter.dispose();
    }

    // Clear collections
    this.mixBuses.clear();
    this.sends.clear();
    this.snapshots.clear();
    this.automationTimelines.clear();

    if (this.soloMute) {
      this.soloMute.dispose();
    }

    logger.info('🎛️ Mixer: Disposed');
  }
}
