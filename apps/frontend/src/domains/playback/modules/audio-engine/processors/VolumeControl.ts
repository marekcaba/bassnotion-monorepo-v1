/**
 * VolumeControl - Advanced volume control with smooth transitions
 * 
 * Features:
 * - Smooth volume transitions (no clicks/pops)
 * - Logarithmic/linear scaling options
 * - Fade in/out capabilities
 * - Volume automation
 * - Metering support
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import { AudioNodeManager } from '../core/AudioNodeManager.js';
import { AudioNodeWrapper } from '../types/index.js';

const logger = createStructuredLogger('VolumeControl');

export type VolumeScaling = 'linear' | 'logarithmic' | 'exponential';

export interface VolumeAutomationPoint {
  time: number;
  value: number;
  curve?: 'linear' | 'exponential';
}

export class VolumeControl {
  private nodeManager: AudioNodeManager;
  private context: AudioContext;
  private gainNode: AudioNodeWrapper;
  private meterNode: AudioNodeWrapper | null = null;
  private currentVolume = 1.0;
  private scaling: VolumeScaling = 'logarithmic';
  private minDb = -60;
  private maxDb = 6;
  private fadeInProgress = false;

  constructor(context: AudioContext, initialVolume = 1.0, scaling: VolumeScaling = 'logarithmic') {
    this.context = context;
    this.nodeManager = new AudioNodeManager(context);
    this.gainNode = this.nodeManager.createGainNode(initialVolume);
    this.currentVolume = initialVolume;
    this.scaling = scaling;
    
    logger.info('VolumeControl created', { initialVolume, scaling });
  }

  /**
   * Set volume immediately
   */
  setVolume(volume: number): void {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    const scaledValue = this.scaleVolume(this.currentVolume);
    
    const gain = this.gainNode.node as GainNode;
    gain.gain.value = scaledValue;
    
    logger.debug('Volume set', { volume: this.currentVolume, scaled: scaledValue });
  }

  /**
   * Set volume smoothly over time
   */
  setVolumeSmooth(volume: number, duration = 0.05): void {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    const scaledValue = this.scaleVolume(this.currentVolume);
    
    const gain = this.gainNode.node as GainNode;
    const now = this.context.currentTime;
    
    // Cancel any scheduled changes
    gain.gain.cancelScheduledValues(now);
    
    // Set current value
    gain.gain.setValueAtTime(gain.gain.value, now);
    
    // Ramp to target
    if (this.scaling === 'exponential' && scaledValue > 0) {
      gain.gain.exponentialRampToValueAtTime(scaledValue, now + duration);
    } else {
      gain.gain.linearRampToValueAtTime(scaledValue, now + duration);
    }
    
    logger.debug('Volume ramped', { 
      volume: this.currentVolume, 
      scaled: scaledValue,
      duration 
    });
  }

  /**
   * Fade in
   */
  async fadeIn(duration: number, targetVolume = 1.0): Promise<void> {
    if (this.fadeInProgress) {
      logger.warn('Fade already in progress');
      return;
    }
    
    this.fadeInProgress = true;
    const startVolume = this.currentVolume;
    
    logger.info('Fade in started', { duration, targetVolume, startVolume });
    
    // Set to zero if starting from silence
    if (startVolume === 0) {
      this.setVolume(0.001); // Small value for exponential ramp
    }
    
    // Perform fade
    this.setVolumeSmooth(targetVolume, duration);
    
    // Wait for fade to complete
    await this.delay(duration * 1000);
    
    this.fadeInProgress = false;
    logger.info('Fade in completed');
  }

  /**
   * Fade out
   */
  async fadeOut(duration: number): Promise<void> {
    if (this.fadeInProgress) {
      logger.warn('Fade already in progress');
      return;
    }
    
    this.fadeInProgress = true;
    const startVolume = this.currentVolume;
    
    logger.info('Fade out started', { duration, startVolume });
    
    // Perform fade
    this.setVolumeSmooth(0, duration);
    
    // Wait for fade to complete
    await this.delay(duration * 1000);
    
    this.fadeInProgress = false;
    logger.info('Fade out completed');
  }

  /**
   * Cross-fade between current volume and target
   */
  async crossFade(targetVolume: number, duration: number): Promise<void> {
    const startVolume = this.currentVolume;
    const startTime = this.context.currentTime;
    
    logger.info('Cross-fade started', { startVolume, targetVolume, duration });
    
    // Schedule volume curve
    const gain = this.gainNode.node as GainNode;
    gain.gain.cancelScheduledValues(startTime);
    gain.gain.setValueAtTime(this.scaleVolume(startVolume), startTime);
    
    // Use appropriate curve
    const targetScaled = this.scaleVolume(targetVolume);
    if (targetVolume > startVolume && this.scaling === 'exponential') {
      gain.gain.exponentialRampToValueAtTime(targetScaled, startTime + duration);
    } else {
      gain.gain.linearRampToValueAtTime(targetScaled, startTime + duration);
    }
    
    this.currentVolume = targetVolume;
    
    await this.delay(duration * 1000);
    logger.info('Cross-fade completed');
  }

  /**
   * Apply volume automation
   */
  applyAutomation(points: VolumeAutomationPoint[]): void {
    if (points.length === 0) return;
    
    const gain = this.gainNode.node as GainNode;
    const now = this.context.currentTime;
    
    // Cancel existing automation
    gain.gain.cancelScheduledValues(now);
    
    // Sort points by time
    const sortedPoints = [...points].sort((a, b) => a.time - b.time);
    
    // Apply automation points
    sortedPoints.forEach((point, index) => {
      const time = now + point.time;
      const value = this.scaleVolume(Math.max(0, Math.min(1, point.value)));
      
      if (index === 0) {
        gain.gain.setValueAtTime(value, time);
      } else {
        const curve = point.curve || 'linear';
        if (curve === 'exponential' && value > 0) {
          gain.gain.exponentialRampToValueAtTime(value, time);
        } else {
          gain.gain.linearRampToValueAtTime(value, time);
        }
      }
    });
    
    // Update current volume to last point
    const lastPoint = sortedPoints[sortedPoints.length - 1];
    this.currentVolume = lastPoint.value;
    
    logger.info('Automation applied', { points: sortedPoints.length });
  }

  /**
   * Enable metering
   */
  enableMetering(): void {
    if (this.meterNode) return;
    
    this.meterNode = this.nodeManager.createAnalyser(2048);
    this.gainNode.connect(this.meterNode);
    
    logger.info('Metering enabled');
  }

  /**
   * Get current level (RMS)
   */
  getCurrentLevel(): number {
    if (!this.meterNode) return 0;
    
    const analyser = this.meterNode.node as AnalyserNode;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    
    analyser.getFloatTimeDomainData(dataArray);
    
    // Calculate RMS
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    
    return Math.sqrt(sum / bufferLength);
  }

  /**
   * Get peak level
   */
  getPeakLevel(): number {
    if (!this.meterNode) return 0;
    
    const analyser = this.meterNode.node as AnalyserNode;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    
    analyser.getFloatTimeDomainData(dataArray);
    
    // Find peak
    let peak = 0;
    for (let i = 0; i < bufferLength; i++) {
      peak = Math.max(peak, Math.abs(dataArray[i]));
    }
    
    return peak;
  }

  /**
   * Convert to decibels
   */
  toDecibels(linear: number): number {
    if (linear === 0) return -Infinity;
    return 20 * Math.log10(linear);
  }

  /**
   * Convert from decibels
   */
  fromDecibels(db: number): number {
    return Math.pow(10, db / 20);
  }

  /**
   * Set volume scaling type
   */
  setScaling(scaling: VolumeScaling): void {
    this.scaling = scaling;
    // Re-apply current volume with new scaling
    this.setVolume(this.currentVolume);
    logger.info('Scaling changed', { scaling });
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.currentVolume;
  }

  /**
   * Get current volume in dB
   */
  getVolumeDb(): number {
    return this.toDecibels(this.scaleVolume(this.currentVolume));
  }

  /**
   * Get input node
   */
  getInput(): AudioNodeWrapper {
    return this.gainNode;
  }

  /**
   * Get output node
   */
  getOutput(): AudioNodeWrapper {
    return this.gainNode;
  }

  /**
   * Mute
   */
  mute(): void {
    const gain = this.gainNode.node as GainNode;
    gain.gain.value = 0;
    logger.info('Muted');
  }

  /**
   * Unmute
   */
  unmute(): void {
    this.setVolume(this.currentVolume);
    logger.info('Unmuted');
  }

  /**
   * Scale volume based on scaling type
   */
  private scaleVolume(linear: number): number {
    switch (this.scaling) {
      case 'linear':
        return linear;
        
      case 'logarithmic':
        // Convert to dB scale
        if (linear === 0) return 0;
        const db = this.minDb + (this.maxDb - this.minDb) * linear;
        return this.fromDecibels(db);
        
      case 'exponential':
        // Exponential curve for more natural volume control
        return Math.pow(linear, 2);
        
      default:
        return linear;
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.gainNode.disconnect();
    if (this.meterNode) {
      this.meterNode.disconnect();
    }
    this.nodeManager.clear();
    logger.info('VolumeControl disposed');
  }
}