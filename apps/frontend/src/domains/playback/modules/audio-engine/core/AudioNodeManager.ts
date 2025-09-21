/**
 * AudioNodeManager - Manages Web Audio API nodes and routing
 *
 * Responsibilities:
 * - Create and manage audio nodes
 * - Handle audio routing and connections
 * - Provide node wrappers for easier management
 * - Track active nodes for cleanup
 */

import { createStructuredLogger } from '../../shared/index.js';
import { AudioNodeWrapper } from '../types/index.js';

const logger = createStructuredLogger('AudioNodeManager');

export class AudioNodeManager {
  private context: AudioContext;
  private nodes: Map<string, AudioNodeWrapper> = new Map();
  private nodeIdCounter = 0;

  constructor(context: AudioContext) {
    this.context = context;
    logger.info('AudioNodeManager created');
  }

  /**
   * Create a gain node wrapper
   */
  createGainNode(initialValue = 1.0): AudioNodeWrapper {
    const node = this.context.createGain();
    node.gain.value = initialValue;

    return this.wrapNode(node, 'gain');
  }

  /**
   * Create a dynamics compressor node wrapper
   */
  createCompressor(config?: {
    threshold?: number;
    knee?: number;
    ratio?: number;
    attack?: number;
    release?: number;
  }): AudioNodeWrapper {
    const node = this.context.createDynamicsCompressor();

    if (config) {
      if (config.threshold !== undefined)
        node.threshold.value = config.threshold;
      if (config.knee !== undefined) node.knee.value = config.knee;
      if (config.ratio !== undefined) node.ratio.value = config.ratio;
      if (config.attack !== undefined) node.attack.value = config.attack;
      if (config.release !== undefined) node.release.value = config.release;
    }

    return this.wrapNode(node, 'compressor');
  }

  /**
   * Create a biquad filter node wrapper
   */
  createFilter(
    type: BiquadFilterType = 'lowpass',
    frequency = 1000,
    q = 1,
  ): AudioNodeWrapper {
    const node = this.context.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;

    return this.wrapNode(node, 'filter');
  }

  /**
   * Create a convolver (reverb) node wrapper
   */
  createConvolver(impulseResponse?: AudioBuffer): AudioNodeWrapper {
    const node = this.context.createConvolver();

    if (impulseResponse) {
      node.buffer = impulseResponse;
    }

    return this.wrapNode(node, 'convolver');
  }

  /**
   * Create a delay node wrapper
   */
  createDelay(maxDelay = 1.0, delayTime = 0.5): AudioNodeWrapper {
    const node = this.context.createDelay(maxDelay);
    node.delayTime.value = delayTime;

    return this.wrapNode(node, 'delay');
  }

  /**
   * Create an analyser node wrapper
   */
  createAnalyser(fftSize = 2048): AudioNodeWrapper {
    const node = this.context.createAnalyser();
    node.fftSize = fftSize;

    return this.wrapNode(node, 'analyser');
  }

  /**
   * Create a channel splitter node wrapper
   */
  createChannelSplitter(channels = 2): AudioNodeWrapper {
    const node = this.context.createChannelSplitter(channels);
    return this.wrapNode(node, 'splitter');
  }

  /**
   * Create a channel merger node wrapper
   */
  createChannelMerger(channels = 2): AudioNodeWrapper {
    const node = this.context.createChannelMerger(channels);
    return this.wrapNode(node, 'merger');
  }

  /**
   * Create a stereo panner node wrapper
   */
  createStereoPanner(pan = 0): AudioNodeWrapper {
    const node = this.context.createStereoPanner();
    node.pan.value = pan;

    return this.wrapNode(node, 'panner');
  }

  /**
   * Get the master output (destination)
   */
  getMasterOutput(): AudioNode {
    return this.context.destination;
  }

  /**
   * Connect nodes
   */
  connect(
    source: AudioNode | AudioNodeWrapper,
    destination: AudioNode | AudioNodeWrapper,
  ): void {
    const sourceNode = this.unwrapNode(source);
    const destNode = this.unwrapNode(destination);

    sourceNode.connect(destNode);
    logger.debug('Connected nodes', {
      source: sourceNode.constructor.name,
      destination: destNode.constructor.name,
    });
  }

  /**
   * Disconnect nodes
   */
  disconnect(source: AudioNode | AudioNodeWrapper): void {
    const sourceNode = this.unwrapNode(source);
    sourceNode.disconnect();
    logger.debug('Disconnected node', { type: sourceNode.constructor.name });
  }

  /**
   * Get a node by ID
   */
  getNode(id: string): AudioNodeWrapper | undefined {
    return this.nodes.get(id);
  }

  /**
   * Remove a node
   */
  removeNode(id: string): void {
    const wrapper = this.nodes.get(id);
    if (wrapper) {
      wrapper.disconnect();
      this.nodes.delete(id);
      logger.debug('Removed node', { id });
    }
  }

  /**
   * Get all active nodes
   */
  getActiveNodes(): Map<string, AudioNodeWrapper> {
    return new Map(this.nodes);
  }

  /**
   * Clear all nodes
   */
  clear(): void {
    this.nodes.forEach((wrapper) => {
      wrapper.disconnect();
    });
    this.nodes.clear();
    logger.info('Cleared all nodes');
  }

  /**
   * Wrap a native audio node
   */
  private wrapNode(node: AudioNode, type: string): AudioNodeWrapper {
    const id = `${type}-${++this.nodeIdCounter}`;

    const wrapper: AudioNodeWrapper = {
      node,
      input: node,
      output: node,
      connect: (destination: AudioNode | AudioNodeWrapper) => {
        this.connect(wrapper, destination);
      },
      disconnect: () => {
        this.disconnect(wrapper);
      },
      dispose: () => {
        this.removeNode(id);
      },
    };

    this.nodes.set(id, wrapper);
    logger.debug('Created node', { id, type });

    return wrapper;
  }

  /**
   * Unwrap a node to get the native AudioNode
   */
  private unwrapNode(node: AudioNode | AudioNodeWrapper): AudioNode {
    if ('node' in node) {
      return node.output;
    }
    return node;
  }

  /**
   * Create an impulse response for reverb
   */
  createImpulseResponse(duration = 2, decay = 2): AudioBuffer {
    const length = duration * this.context.sampleRate;
    const impulse = this.context.createBuffer(
      2,
      length,
      this.context.sampleRate,
    );

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] =
          (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }

    return impulse;
  }
}
