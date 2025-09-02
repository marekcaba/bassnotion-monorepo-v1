/**
 * MixerNode - Multi-channel audio mixer
 * 
 * Provides a flexible mixing console with:
 * - Multiple input channels
 * - Per-channel volume, pan, mute, solo
 * - Auxiliary sends
 * - Master output with limiter
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import { AudioNodeManager } from '../core/AudioNodeManager.js';
import { AudioNodeWrapper } from '../types/index.js';

const logger = createStructuredLogger('MixerNode');

export interface ChannelStrip {
  id: string;
  name: string;
  input: AudioNodeWrapper;
  gainNode: AudioNodeWrapper;
  panNode: AudioNodeWrapper;
  muteNode: AudioNodeWrapper;
  auxSends: Map<string, AudioNodeWrapper>;
  isMuted: boolean;
  isSoloed: boolean;
  volume: number; // 0-1
  pan: number; // -1 to 1
}

export interface AuxBus {
  id: string;
  name: string;
  input: AudioNodeWrapper;
  output: AudioNodeWrapper;
  returnGain: AudioNodeWrapper;
}

export class MixerNode {
  private nodeManager: AudioNodeManager;
  private channels: Map<string, ChannelStrip> = new Map();
  private auxBuses: Map<string, AuxBus> = new Map();
  private masterGain: AudioNodeWrapper;
  private masterLimiter: AudioNodeWrapper;
  private output: AudioNodeWrapper;
  private soloActive = false;
  private channelIdCounter = 0;
  private auxIdCounter = 0;

  constructor(context: AudioContext) {
    this.nodeManager = new AudioNodeManager(context);
    
    // Create master section
    this.masterGain = this.nodeManager.createGainNode(0.8);
    this.masterLimiter = this.nodeManager.createCompressor({
      threshold: -3,
      knee: 0,
      ratio: 20,
      attack: 0.001,
      release: 0.1,
    });
    
    // Connect master chain
    this.masterGain.connect(this.masterLimiter);
    this.output = this.masterLimiter;
    
    logger.info('MixerNode created');
  }

  /**
   * Add a channel to the mixer
   */
  addChannel(name?: string): string {
    const channelId = `ch-${++this.channelIdCounter}`;
    const channelName = name || `Channel ${this.channelIdCounter}`;
    
    // Create channel strip nodes
    const input = this.nodeManager.createGainNode(1.0);
    const gainNode = this.nodeManager.createGainNode(0.7); // Default 70% volume
    const panNode = this.nodeManager.createStereoPanner(0);
    const muteNode = this.nodeManager.createGainNode(1.0);
    
    // Connect channel strip
    input.connect(gainNode);
    gainNode.connect(panNode);
    panNode.connect(muteNode);
    muteNode.connect(this.masterGain);
    
    const channel: ChannelStrip = {
      id: channelId,
      name: channelName,
      input,
      gainNode,
      panNode,
      muteNode,
      auxSends: new Map(),
      isMuted: false,
      isSoloed: false,
      volume: 0.7,
      pan: 0,
    };
    
    this.channels.set(channelId, channel);
    
    logger.info('Channel added', { id: channelId, name: channelName });
    return channelId;
  }

  /**
   * Remove a channel
   */
  removeChannel(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    
    // Disconnect all nodes
    channel.input.disconnect();
    channel.gainNode.disconnect();
    channel.panNode.disconnect();
    channel.muteNode.disconnect();
    channel.auxSends.forEach(send => send.disconnect());
    
    this.channels.delete(channelId);
    this.updateSoloState();
    
    logger.info('Channel removed', { id: channelId });
  }

  /**
   * Set channel volume
   */
  setChannelVolume(channelId: string, volume: number): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    
    channel.volume = Math.max(0, Math.min(1, volume));
    const gain = channel.gainNode.node as GainNode;
    gain.gain.value = channel.volume;
    
    logger.debug('Channel volume set', { channelId, volume: channel.volume });
  }

  /**
   * Set channel pan
   */
  setChannelPan(channelId: string, pan: number): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    
    channel.pan = Math.max(-1, Math.min(1, pan));
    const panner = channel.panNode.node as StereoPannerNode;
    panner.pan.value = channel.pan;
    
    logger.debug('Channel pan set', { channelId, pan: channel.pan });
  }

  /**
   * Mute/unmute channel
   */
  setChannelMute(channelId: string, muted: boolean): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    
    channel.isMuted = muted;
    this.updateChannelMuteState(channel);
    
    logger.debug('Channel mute set', { channelId, muted });
  }

  /**
   * Solo/unsolo channel
   */
  setChannelSolo(channelId: string, soloed: boolean): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    
    channel.isSoloed = soloed;
    this.updateSoloState();
    
    logger.debug('Channel solo set', { channelId, soloed });
  }

  /**
   * Add auxiliary bus
   */
  addAuxBus(name?: string): string {
    const auxId = `aux-${++this.auxIdCounter}`;
    const auxName = name || `Aux ${this.auxIdCounter}`;
    
    const input = this.nodeManager.createGainNode(1.0);
    const output = this.nodeManager.createGainNode(1.0);
    const returnGain = this.nodeManager.createGainNode(0.5); // Default 50% return
    
    // Aux output goes to master
    returnGain.connect(this.masterGain);
    
    const auxBus: AuxBus = {
      id: auxId,
      name: auxName,
      input,
      output,
      returnGain,
    };
    
    this.auxBuses.set(auxId, auxBus);
    
    logger.info('Aux bus added', { id: auxId, name: auxName });
    return auxId;
  }

  /**
   * Set auxiliary send level for a channel
   */
  setAuxSend(channelId: string, auxId: string, level: number): void {
    const channel = this.channels.get(channelId);
    const auxBus = this.auxBuses.get(auxId);
    
    if (!channel || !auxBus) return;
    
    // Get or create send
    let send = channel.auxSends.get(auxId);
    if (!send) {
      send = this.nodeManager.createGainNode(0);
      channel.panNode.connect(send); // Post-pan send
      send.connect(auxBus.input);
      channel.auxSends.set(auxId, send);
    }
    
    // Set level
    const gain = send.node as GainNode;
    gain.gain.value = Math.max(0, Math.min(1, level));
    
    logger.debug('Aux send set', { channelId, auxId, level });
  }

  /**
   * Set auxiliary return level
   */
  setAuxReturn(auxId: string, level: number): void {
    const auxBus = this.auxBuses.get(auxId);
    if (!auxBus) return;
    
    const gain = auxBus.returnGain.node as GainNode;
    gain.gain.value = Math.max(0, Math.min(1, level));
    
    logger.debug('Aux return set', { auxId, level });
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume: number): void {
    const gain = this.masterGain.node as GainNode;
    gain.gain.value = Math.max(0, Math.min(1, volume));
    
    logger.info('Master volume set', { volume });
  }

  /**
   * Get channel input
   */
  getChannelInput(channelId: string): AudioNodeWrapper | undefined {
    return this.channels.get(channelId)?.input;
  }

  /**
   * Get aux bus input
   */
  getAuxInput(auxId: string): AudioNodeWrapper | undefined {
    return this.auxBuses.get(auxId)?.input;
  }

  /**
   * Get aux bus output
   */
  getAuxOutput(auxId: string): AudioNodeWrapper | undefined {
    return this.auxBuses.get(auxId)?.output;
  }

  /**
   * Get master output
   */
  getMasterOutput(): AudioNodeWrapper {
    return this.output;
  }

  /**
   * Get all channels
   */
  getChannels(): Map<string, ChannelStrip> {
    return new Map(this.channels);
  }

  /**
   * Get channel info
   */
  getChannelInfo(channelId: string) {
    const channel = this.channels.get(channelId);
    if (!channel) return null;
    
    return {
      id: channel.id,
      name: channel.name,
      volume: channel.volume,
      pan: channel.pan,
      isMuted: channel.isMuted,
      isSoloed: channel.isSoloed,
    };
  }

  /**
   * Update channel mute state
   */
  private updateChannelMuteState(channel: ChannelStrip): void {
    const muteGain = channel.muteNode.node as GainNode;
    
    // If solo is active and this channel is not soloed, mute it
    if (this.soloActive && !channel.isSoloed) {
      muteGain.gain.value = 0;
    } else if (channel.isMuted) {
      muteGain.gain.value = 0;
    } else {
      muteGain.gain.value = 1;
    }
  }

  /**
   * Update solo state for all channels
   */
  private updateSoloState(): void {
    // Check if any channel is soloed
    this.soloActive = Array.from(this.channels.values()).some(ch => ch.isSoloed);
    
    // Update all channel mute states
    this.channels.forEach(channel => {
      this.updateChannelMuteState(channel);
    });
    
    logger.debug('Solo state updated', { soloActive: this.soloActive });
  }

  /**
   * Clear all channels
   */
  clear(): void {
    // Remove all channels
    const channelIds = Array.from(this.channels.keys());
    channelIds.forEach(id => this.removeChannel(id));
    
    // Remove all aux buses
    this.auxBuses.forEach(aux => {
      aux.input.disconnect();
      aux.output.disconnect();
      aux.returnGain.disconnect();
    });
    this.auxBuses.clear();
    
    logger.info('Mixer cleared');
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.clear();
    this.masterGain.disconnect();
    this.masterLimiter.disconnect();
    this.nodeManager.clear();
    
    logger.info('MixerNode disposed');
  }
}