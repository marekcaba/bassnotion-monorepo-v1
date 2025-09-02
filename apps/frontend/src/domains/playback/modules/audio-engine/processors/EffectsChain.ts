/**
 * EffectsChain - Manages audio effects processing chain
 * 
 * Provides a flexible effects chain with common audio effects:
 * - EQ (filters)
 * - Compression
 * - Reverb
 * - Delay
 * - Distortion
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import { AudioNodeManager } from '../core/AudioNodeManager.js';
import { AudioNodeWrapper, EffectsConfig } from '../types/index.js';

const logger = createStructuredLogger('EffectsChain');

export interface EffectNode {
  id: string;
  type: string;
  node: AudioNodeWrapper;
  enabled: boolean;
  wetness?: AudioNodeWrapper; // For wet/dry mix
}

export class EffectsChain {
  private nodeManager: AudioNodeManager;
  private effects: Map<string, EffectNode> = new Map();
  private input: AudioNodeWrapper;
  private output: AudioNodeWrapper;
  private effectOrder: string[] = [];

  constructor(context: AudioContext) {
    this.nodeManager = new AudioNodeManager(context);
    
    // Create input/output gain nodes
    this.input = this.nodeManager.createGainNode(1.0);
    this.output = this.nodeManager.createGainNode(1.0);
    
    // Connect input directly to output initially
    this.input.connect(this.output);
    
    logger.info('EffectsChain created');
  }

  /**
   * Add EQ (high/low shelf filters)
   */
  addEQ(config?: {
    lowShelfFreq?: number;
    lowShelfGain?: number;
    highShelfFreq?: number;
    highShelfGain?: number;
  }): string {
    const lowShelf = this.nodeManager.createFilter('lowshelf', config?.lowShelfFreq || 320, 1);
    const highShelf = this.nodeManager.createFilter('highshelf', config?.highShelfFreq || 3200, 1);
    
    // Set gains
    if (config?.lowShelfGain !== undefined) {
      (lowShelf.node as BiquadFilterNode).gain.value = config.lowShelfGain;
    }
    if (config?.highShelfGain !== undefined) {
      (highShelf.node as BiquadFilterNode).gain.value = config.highShelfGain;
    }
    
    // Connect in series
    lowShelf.connect(highShelf);
    
    const effectId = this.addEffect('eq', lowShelf, highShelf);
    logger.info('Added EQ effect', { id: effectId, config });
    
    return effectId;
  }

  /**
   * Add compressor
   */
  addCompressor(config?: {
    threshold?: number;
    ratio?: number;
    attack?: number;
    release?: number;
  }): string {
    const compressor = this.nodeManager.createCompressor(config);
    
    const effectId = this.addEffect('compressor', compressor);
    logger.info('Added compressor effect', { id: effectId, config });
    
    return effectId;
  }

  /**
   * Add reverb
   */
  addReverb(config?: {
    wetness?: number;
    roomSize?: number;
    decay?: number;
  }): string {
    const wetness = config?.wetness ?? 0.3;
    const roomSize = config?.roomSize ?? 2;
    const decay = config?.decay ?? 2;
    
    // Create impulse response
    const impulse = this.nodeManager.createImpulseResponse(roomSize, decay);
    const convolver = this.nodeManager.createConvolver(impulse);
    
    // Create wet/dry mix
    const dryGain = this.nodeManager.createGainNode(1 - wetness);
    const wetGain = this.nodeManager.createGainNode(wetness);
    const merger = this.nodeManager.createGainNode(1.0);
    
    // Connect wet path
    convolver.connect(wetGain);
    wetGain.connect(merger);
    
    // Dry path will be connected in the chain
    dryGain.connect(merger);
    
    const effectId = this.addEffect('reverb', convolver, merger, wetGain);
    logger.info('Added reverb effect', { id: effectId, config });
    
    return effectId;
  }

  /**
   * Add delay
   */
  addDelay(config?: {
    time?: number;
    feedback?: number;
    wetness?: number;
  }): string {
    const delayTime = config?.time ?? 0.25;
    const feedback = config?.feedback ?? 0.3;
    const wetness = config?.wetness ?? 0.3;
    
    // Create delay nodes
    const delay = this.nodeManager.createDelay(2.0, delayTime);
    const feedbackGain = this.nodeManager.createGainNode(feedback);
    const wetGain = this.nodeManager.createGainNode(wetness);
    const dryGain = this.nodeManager.createGainNode(1 - wetness);
    const merger = this.nodeManager.createGainNode(1.0);
    
    // Create feedback loop
    delay.connect(feedbackGain);
    feedbackGain.connect(delay);
    
    // Connect wet path
    delay.connect(wetGain);
    wetGain.connect(merger);
    
    // Dry path
    dryGain.connect(merger);
    
    const effectId = this.addEffect('delay', delay, merger, wetGain);
    logger.info('Added delay effect', { id: effectId, config });
    
    return effectId;
  }

  /**
   * Add distortion
   */
  addDistortion(amount = 50): string {
    // Create a custom distortion node wrapper
    const distortionWrapper = this.createDistortionNode(amount);
    
    const effectId = this.addEffect('distortion', distortionWrapper);
    logger.info('Added distortion effect', { id: effectId, amount });
    
    return effectId;
  }

  /**
   * Create a distortion node wrapper
   */
  private createDistortionNode(amount: number): AudioNodeWrapper {
    // Get the audio context from one of our existing nodes
    const context = (this.input.node as GainNode).context as AudioContext;
    
    // Create waveshaper
    const waveshaper = context.createWaveShaper();
    waveshaper.curve = this.makeDistortionCurve(amount);
    waveshaper.oversample = '4x';
    
    // Create manual wrapper
    const wrapper: AudioNodeWrapper = {
      node: waveshaper,
      input: waveshaper,
      output: waveshaper,
      connect: (destination: AudioNode | AudioNodeWrapper) => {
        if ('node' in destination) {
          waveshaper.connect(destination.input);
        } else {
          waveshaper.connect(destination);
        }
      },
      disconnect: () => {
        waveshaper.disconnect();
      },
      dispose: () => {
        waveshaper.disconnect();
      },
    };
    
    return wrapper;
  }

  /**
   * Enable/disable an effect
   */
  setEffectEnabled(effectId: string, enabled: boolean): void {
    const effect = this.effects.get(effectId);
    if (!effect) {
      logger.warn('Effect not found', { effectId });
      return;
    }
    
    effect.enabled = enabled;
    this.rebuildChain();
    
    logger.info('Effect enabled state changed', { effectId, enabled });
  }

  /**
   * Update effect wetness (for effects that support it)
   */
  setEffectWetness(effectId: string, wetness: number): void {
    const effect = this.effects.get(effectId);
    if (!effect || !effect.wetness) {
      logger.warn('Effect does not support wetness control', { effectId });
      return;
    }
    
    const wetGain = effect.wetness.node as GainNode;
    wetGain.gain.value = Math.max(0, Math.min(1, wetness));
    
    // Update dry gain if it's a wet/dry effect
    const dryNode = this.effects.get(`${effectId}-dry`);
    if (dryNode) {
      const dryGain = dryNode.node.node as GainNode;
      dryGain.gain.value = 1 - wetness;
    }
    
    logger.info('Effect wetness updated', { effectId, wetness });
  }

  /**
   * Remove an effect
   */
  removeEffect(effectId: string): void {
    const effect = this.effects.get(effectId);
    if (!effect) {
      return;
    }
    
    effect.node.disconnect();
    if (effect.wetness) {
      effect.wetness.disconnect();
    }
    
    this.effects.delete(effectId);
    this.effectOrder = this.effectOrder.filter(id => id !== effectId);
    
    this.rebuildChain();
    logger.info('Effect removed', { effectId });
  }

  /**
   * Clear all effects
   */
  clearEffects(): void {
    this.effects.forEach(effect => {
      effect.node.disconnect();
      if (effect.wetness) {
        effect.wetness.disconnect();
      }
    });
    
    this.effects.clear();
    this.effectOrder = [];
    
    // Reconnect input to output
    this.input.disconnect();
    this.input.connect(this.output);
    
    logger.info('All effects cleared');
  }

  /**
   * Get input node
   */
  getInput(): AudioNodeWrapper {
    return this.input;
  }

  /**
   * Get output node
   */
  getOutput(): AudioNodeWrapper {
    return this.output;
  }

  /**
   * Add effect to the chain
   */
  private addEffect(
    type: string, 
    inputNode: AudioNodeWrapper, 
    outputNode?: AudioNodeWrapper,
    wetnessNode?: AudioNodeWrapper
  ): string {
    const effectId = `${type}-${Date.now()}`;
    
    this.effects.set(effectId, {
      id: effectId,
      type,
      node: inputNode,
      enabled: true,
      wetness: wetnessNode,
    });
    
    if (outputNode && outputNode !== inputNode) {
      this.effects.set(`${effectId}-output`, {
        id: `${effectId}-output`,
        type: `${type}-output`,
        node: outputNode,
        enabled: true,
      });
    }
    
    this.effectOrder.push(effectId);
    this.rebuildChain();
    
    return effectId;
  }

  /**
   * Rebuild the effects chain
   */
  private rebuildChain(): void {
    // Disconnect everything
    this.input.disconnect();
    this.effects.forEach(effect => {
      effect.node.disconnect();
    });
    
    // Start with input
    let currentNode = this.input;
    
    // Connect enabled effects in order
    for (const effectId of this.effectOrder) {
      const effect = this.effects.get(effectId);
      if (!effect || !effect.enabled) continue;
      
      currentNode.connect(effect.node);
      
      // Handle output node if it exists
      const outputEffect = this.effects.get(`${effectId}-output`);
      if (outputEffect) {
        currentNode = outputEffect.node;
      } else {
        currentNode = effect.node;
      }
    }
    
    // Connect to output
    currentNode.connect(this.output);
    
    logger.debug('Effects chain rebuilt', { 
      enabledEffects: this.effectOrder.filter(id => this.effects.get(id)?.enabled) 
    });
  }

  /**
   * Create distortion curve
   */
  private makeDistortionCurve(amount: number): Float32Array {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    
    return curve;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.clearEffects();
    this.nodeManager.clear();
    logger.info('EffectsChain disposed');
  }
}