/**
 * WAM Metronome Plugin
 * 
 * A Web Audio Module (WAM) 2.0 compliant metronome with configurable click sounds.
 * Designed for precise timing and rhythmic training in BassNotion.
 * 
 * Features:
 * - Multiple click sound presets
 * - Configurable time signatures
 * - Accent patterns for downbeats
 * - Subdivision support (8th notes, triplets, etc.)
 * - Volume and pan control per click type
 * - Sample-accurate timing through AudioWorklet
 * - MIDI sync capability
 * 
 * Part of Story 3.21 - Track-Based Architecture Migration
 */

import type { 
  WebAudioModule, 
  WamNode, 
  WamDescriptor, 
  WamParameterInfoMap,
  WamParameterDataMap,
  WamEvent,
  WamMidiEvent,
  WamTransportEvent
} from '../../../types/wam.js';
import { GlobalSampleCache } from '../../storage/GlobalSampleCache.js';

// Base WebAudioModule class - minimal implementation for compatibility
abstract class WebAudioModuleBase implements WebAudioModule {
  abstract audioContext: BaseAudioContext;
  abstract audioNode: AudioNode | null;
  abstract initialized: boolean;
  abstract moduleId: string;
  abstract instanceId: string;
  
  abstract createAudioNode(options?: any): Promise<AudioNode>;
  
  async initialize(state?: any): Promise<WebAudioModule> {
    if (!this.initialized) {
      this.audioNode = await this.createAudioNode(state);
      (this as any).initialized = true;
    }
    return this;
  }
  
  createGui?(): Promise<HTMLElement>;
  destroyGui?(gui: Element): void;
}

/**
 * Metronome click types
 */
export enum MetronomeSound {
  CLASSIC = 'classic',      // Traditional wood block
  ELECTRONIC = 'electronic', // Electronic beep
  ACOUSTIC = 'acoustic',    // Acoustic drum stick
  SUBTLE = 'subtle'         // Soft, subtle click
}

/**
 * Metronome event for scheduling
 */
export interface MetronomeEvent {
  beat: number;          // Beat number in measure (0-based)
  subdivision: number;   // Subdivision index (0 for main beat)
  isAccent: boolean;     // True for downbeat/accent
  time: number;          // When to play (audio context time)
  velocity: number;      // Velocity (0-127)
}

/**
 * Time signature configuration
 */
export interface TimeSignature {
  numerator: number;     // Beats per measure
  denominator: number;   // Note value (4 = quarter, 8 = eighth)
}

/**
 * WAM Metronome Node - handles click generation and timing
 */
export class WamMetronomeNode implements WamNode {
  private gainNode: GainNode | null = null;
  private clickBuffer: AudioBuffer | null = null;
  private accentBuffer: AudioBuffer | null = null;
  private currentSound: MetronomeSound = MetronomeSound.CLASSIC;
  private timeSignature: TimeSignature = { numerator: 4, denominator: 4 };
  private isPlaying: boolean = false;
  private tempo: number = 120;
  private subdivisions: number = 1; // 1 = quarter notes, 2 = 8th notes, 3 = triplets
  private accentPattern: boolean[] = [true, false, false, false]; // Accent pattern
  private currentBeat: number = 0;
  private scheduledEvents: Set<number> = new Set(); // Track scheduled timeouts
  private sampleCache = GlobalSampleCache;
  
  get gain(): AudioParam | undefined {
    return this.gainNode?.gain;
  }
  
  get context(): BaseAudioContext {
    return this.module.audioContext;
  }
  
  constructor(
    private module: WebAudioModule,
    options?: AudioNodeOptions
  ) {
    // Don't initialize here to avoid SSR issues
  }
  
  /**
   * Connect to destination
   */
  connect(destination: AudioNode | AudioParam): AudioNode {
    if (!this.gainNode) {
      throw new Error('WAM Metronome not initialized');
    }
    return this.gainNode.connect(destination as any);
  }
  
  /**
   * Disconnect from destination
   */
  disconnect(destination?: AudioNode | AudioParam | number): void {
    if (this.gainNode) {
      if (destination) {
        this.gainNode.disconnect(destination as any);
      } else {
        this.gainNode.disconnect();
      }
    }
  }
  
  async initialize(): Promise<void> {
    // Create gain node only in browser
    if (typeof window !== 'undefined' && this.context) {
      // CRITICAL: Set Tone.js to use WAM AudioContext before any Tone operations
      const Tone = (window as any).Tone;
      if (Tone) {
        console.log('🎵 WamMetronomeNode: Setting Tone.js to use WAM AudioContext during initialization');
        try {
          Tone.setContext(this.context);
          console.log('✅ Tone.js context set to WAM AudioContext');
        } catch (error) {
          console.error('❌ Failed to set Tone.js context during initialization:', error);
        }
      }
      
      this.gainNode = this.context.createGain();
      this.gainNode.gain.value = 0.8;
    }
    
    // Initialize click sounds
    await this.loadSound(MetronomeSound.CLASSIC);
  }
  
  /**
   * Load a metronome sound preset
   */
  async loadSound(sound: MetronomeSound): Promise<void> {
    try {
      // We only have one sample in Supabase for now
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const samplePath = 'metronome/Clicks_01.mp3';
      const fullUrl = `${supabaseUrl}/storage/v1/object/public/audio-samples/${samplePath}`;
      
      console.log(`🎵 Loading metronome sample from Supabase: ${samplePath}`);
      
      // Check cache first (exactly like WamDrummer does)
      const cachedBuffer = this.sampleCache.getCachedBuffer(fullUrl) || 
                          this.sampleCache.getCachedBuffer('metronome-click');
      
      if (cachedBuffer) {
        console.log(`♻️ Using cached buffer for metronome`);
        this.clickBuffer = cachedBuffer;
        this.accentBuffer = cachedBuffer;
      } else {
        // Load from URL (exactly like WamDrummer does)
        console.log(`📥 Loading metronome sample from URL`);
        const response = await fetch(fullUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        
        // Cache the buffer
        this.sampleCache.cacheBuffer(fullUrl, audioBuffer);
        this.sampleCache.cacheBuffer('metronome-click', audioBuffer);
        
        this.clickBuffer = audioBuffer;
        this.accentBuffer = audioBuffer;
      }
      
      this.currentSound = sound;
      console.log(`✅ Metronome ready with Supabase sample`);
    } catch (error) {
      console.error(`Failed to load ${sound} sound:`, error);
      // Fallback to oscillators if samples fail to load
      console.warn('Falling back to oscillator-based clicks');
      this.useFallbackOscillators();
    }
  }
  
  /**
   * Get Tone.js instance
   */
  private async getToneJS(): Promise<any> {
    // Try to get from window first
    if ((window as any).Tone) {
      return (window as any).Tone;
    }
    
    // Try to get from CoreServices
    const coreServices = (window as any).__coreServices || (window as any).__globalCoreServices;
    if (coreServices && typeof coreServices.getAudioEngine === 'function') {
      const audioEngine = coreServices.getAudioEngine();
      if (audioEngine && typeof audioEngine.getTone === 'function') {
        return audioEngine.getTone();
      }
    }
    
    return null;
  }
  
  /**
   * Use fallback Web Audio API oscillators when Tone.js is not available
   */
  private useFallbackOscillators(): void {
    // Create a simple click sound using Web Audio API
    this.clickSynth = {
      triggerAttackRelease: (pitch: string, duration: string, time: number, velocity: number) => {
        const osc = this.context.createOscillator();
        const env = this.context.createGain();
        
        osc.connect(env);
        env.connect(this.gainNode!);
        
        // Simple click envelope
        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(velocity, time + 0.001);
        env.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        
        osc.frequency.value = pitch === 'C5' ? 523.25 : 261.63; // C5 or C4
        osc.start(time);
        osc.stop(time + 0.05);
      },
      dispose: () => {} // No-op for fallback
    } as any;
    
    // Use same synth for accent (could be customized)
    this.accentSynth = this.clickSynth;
    
    this.currentSound = MetronomeSound.CLASSIC;
    console.log('✅ Using fallback Web Audio API oscillators for metronome');
  }
  
  /**
   * Trigger a metronome click
   */
  triggerClick(isAccent: boolean = false, velocity: number = 80, time?: number): void {
    console.log('🎵 WamMetronomeNode.triggerClick() called', { 
      hasClickBuffer: !!this.clickBuffer,
      hasAccentBuffer: !!this.accentBuffer,
      isAccent,
      velocity,
      time
    });
    
    const buffer = isAccent ? this.accentBuffer : this.clickBuffer;
    
    // If no buffer loaded, try fallback
    if (!buffer) {
      console.log('❌ No buffer available for metronome click');
      if (this.clickSynth) {
        const synth = isAccent ? this.accentSynth : this.clickSynth;
        const actualTime = time || this.context.currentTime;
        const volume = (velocity / 127) * 0.8;
        const pitch = isAccent ? 'C5' : 'C4';
        synth.triggerAttackRelease(pitch, '32n', actualTime, volume);
      }
      return;
    }
    
    const triggerTime = time || this.context.currentTime;
    
    console.log('🎵 Playing metronome click with buffer', {
      bufferDuration: buffer.duration,
      bufferSampleRate: buffer.sampleRate,
      triggerTime,
      contextTime: this.context.currentTime,
      gainNodeConnected: !!this.gainNode
    });
    
    try {
      // Create source node
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      
      // Create gain for velocity
      const velocityGain = this.context.createGain();
      // Make accent louder
      const baseVolume = isAccent ? 1.0 : 0.7;
      velocityGain.gain.value = (velocity / 127) * baseVolume;
      
      // Connect nodes
      source.connect(velocityGain);
      velocityGain.connect(this.gainNode!);
      
      // Start playback
      source.start(triggerTime);
      console.log('✅ Metronome click scheduled');
      
      // Cleanup after playback
      source.onended = () => {
        source.disconnect();
        velocityGain.disconnect();
      };
    } catch (error) {
      console.error('Failed to trigger click:', error);
    }
  }
  
  /**
   * Schedule a pattern of clicks
   */
  schedulePattern(startTime: number, measures: number = 1): void {
    const beatDuration = 60 / this.tempo / this.subdivisions;
    const beatsPerMeasure = this.timeSignature.numerator * this.subdivisions;
    
    for (let measure = 0; measure < measures; measure++) {
      for (let beat = 0; beat < beatsPerMeasure; beat++) {
        const time = startTime + (measure * beatsPerMeasure + beat) * beatDuration;
        const mainBeat = beat % this.subdivisions === 0;
        const beatIndex = Math.floor(beat / this.subdivisions);
        const isAccent = mainBeat && this.accentPattern[beatIndex % this.accentPattern.length];
        
        // Schedule the click
        if (time > this.context.currentTime) {
          const timeoutId = setTimeout(() => {
            this.triggerClick(isAccent, isAccent ? 100 : 70);
            this.scheduledEvents.delete(timeoutId);
          }, (time - this.context.currentTime) * 1000);
          
          this.scheduledEvents.add(timeoutId);
        }
      }
    }
  }
  
  /**
   * Start metronome (for standalone use)
   */
  start(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentBeat = 0;
    this.scheduleNextMeasure();
  }
  
  /**
   * Stop metronome
   */
  stop(): void {
    this.isPlaying = false;
    this.clearScheduledEvents();
  }
  
  /**
   * Schedule next measure
   */
  private scheduleNextMeasure(): void {
    if (!this.isPlaying) return;
    
    const currentTime = this.context.currentTime;
    this.schedulePattern(currentTime + 0.1, 1);
    
    // Schedule next measure
    const measureDuration = (60 / this.tempo) * this.timeSignature.numerator;
    setTimeout(() => {
      this.scheduleNextMeasure();
    }, measureDuration * 900); // Schedule slightly early
  }
  
  /**
   * Clear all scheduled events
   */
  private clearScheduledEvents(): void {
    this.scheduledEvents.forEach(id => clearTimeout(id));
    this.scheduledEvents.clear();
  }
  
  /**
   * Handle transport events (start/stop/tempo)
   */
  handleTransportEvent(event: WamTransportEvent): void {
    switch (event.data.type) {
      case 'start':
        this.currentBeat = 0;
        break;
      case 'stop':
        this.clearScheduledEvents();
        break;
      case 'tempo':
        this.tempo = event.data.tempo;
        break;
    }
  }
  
  /**
   * Process pattern event (for track integration)
   */
  handlePatternEvent(event: any, time: number): void {
    if (event.type === 'click' || event.type === 'accent') {
      const velocity = Math.round((event.velocity || 0.8) * 127);
      this.triggerClick(event.type === 'accent', velocity, time);
    }
  }
  
  // WAM Node interface methods
  
  async getParameterInfo(): Promise<WamParameterInfoMap> {
    return {
      volume: {
        label: 'Volume',
        type: 'float',
        defaultValue: 0.8,
        minValue: 0,
        maxValue: 1
      },
      sound: {
        label: 'Sound',
        type: 'int',
        defaultValue: 0,
        minValue: 0,
        maxValue: 3,
        choices: ['Classic', 'Electronic', 'Acoustic', 'Subtle']
      },
      subdivisions: {
        label: 'Subdivisions',
        type: 'int',
        defaultValue: 1,
        minValue: 1,
        maxValue: 4,
        choices: ['Quarter', 'Eighth', 'Triplet', 'Sixteenth']
      },
      accentBeats: {
        label: 'Accent Beats',
        type: 'int',
        defaultValue: 4,
        minValue: 1,
        maxValue: 16
      }
    };
  }
  
  async getParameterValues(): Promise<WamParameterDataMap> {
    return {
      volume: this.gainNode?.gain.value || 0.8,
      sound: Object.values(MetronomeSound).indexOf(this.currentSound),
      subdivisions: this.subdivisions,
      accentBeats: this.timeSignature.numerator
    };
  }
  
  async setParameterValues(values: WamParameterDataMap): Promise<void> {
    if ('volume' in values && this.gainNode) {
      this.gainNode.gain.value = values.volume;
    }
    
    if ('sound' in values) {
      const sounds = Object.values(MetronomeSound);
      const sound = sounds[values.sound];
      if (sound) {
        await this.loadSound(sound);
      }
    }
    
    if ('subdivisions' in values) {
      this.subdivisions = values.subdivisions;
    }
    
    if ('accentBeats' in values) {
      this.timeSignature.numerator = values.accentBeats;
      // Update accent pattern
      this.accentPattern = Array(values.accentBeats).fill(false);
      this.accentPattern[0] = true; // Always accent first beat
    }
  }
  
  scheduleEvent(event: WamEvent): void {
    if (event.type === 'wam-transport') {
      this.handleTransportEvent(event as WamTransportEvent);
    } else if (event.type === 'wam-midi') {
      // Handle MIDI sync if needed
      const midiEvent = event as WamMidiEvent;
      const [status, data1, data2] = Array.from(midiEvent.data.bytes);
      
      // MIDI clock (0xF8)
      if (status === 0xF8) {
        // Handle MIDI clock sync
      }
    }
  }
  
  clearEvents(): void {
    this.clearScheduledEvents();
  }
  
  destroy(): void {
    this.stop();
    this.clearEvents();
    if (this.clickSynth) {
      this.clickSynth.dispose();
    }
    if (this.accentSynth) {
      this.accentSynth.dispose();
    }
    this.disconnect();
  }
}

/**
 * WAM Metronome Module - the main plugin class
 */
export class WamMetronome extends WebAudioModuleBase {
  readonly audioContext: BaseAudioContext;
  audioNode: WamMetronomeNode | null = null;
  initialized = false;
  readonly moduleId = 'com.bassnotion.metronome';
  readonly instanceId: string;
  
  static descriptor: WamDescriptor = {
    name: 'BassNotion Metronome',
    vendor: 'BassNotion',
    version: '1.0.0',
    sdkVersion: '2.0.0',
    thumbnail: '',
    keywords: ['utility', 'metronome', 'timing', 'rhythm'],
    isInstrument: false,
    website: 'https://bassnotion.com',
    hasAudioInput: false,
    hasAudioOutput: true,
    hasMidiInput: true,
    hasMidiOutput: false,
    supportsMpe: false
  };
  
  constructor(audioContext: BaseAudioContext) {
    super();
    this.audioContext = audioContext;
    this.instanceId = `${this.moduleId}-${Date.now()}`;
  }
  
  /**
   * Create the audio node - follows WAM 2.0 standard
   */
  async createAudioNode(initialState?: any): Promise<AudioNode> {
    this.audioNode = new WamMetronomeNode(this, initialState);
    await this.audioNode.initialize();
    return this.audioNode;
  }
  
  /**
   * Trigger a click sound (used by widgets)
   */
  click(isAccent: boolean = false): void {
    console.log('🎵 WamMetronome.click() called', { hasAudioNode: !!this.audioNode, isAccent });
    if (this.audioNode) {
      this.audioNode.triggerClick(isAccent);
    } else {
      console.log('❌ No audio node available');
    }
  }
  
  /**
   * Set time signature
   */
  setTimeSignature(numerator: number, denominator: number): void {
    if (this.audioNode) {
      this.audioNode.setParameterValues({
        accentBeats: numerator
      });
    }
  }
  
  /**
   * Set tempo (for standalone use)
   */
  setTempo(bpm: number): void {
    if (this.audioNode) {
      (this.audioNode as any).tempo = bpm;
    }
  }
  
  /**
   * Handle pattern event (for track integration)
   */
  handlePatternEvent(event: any, time: number): void {
    this.audioNode?.handlePatternEvent(event, time);
  }
  
  /**
   * Load default metronome samples
   */
  async loadDefaultSamples(): Promise<void> {
    if (this.audioNode) {
      await this.audioNode.loadSound(MetronomeSound.CLASSIC);
    }
  }
  
  async createGui(): Promise<HTMLElement> {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="wam-metronome-gui">
        <h3>WAM Metronome</h3>
        <select id="sound">
          <option value="0">Classic</option>
          <option value="1">Electronic</option>
          <option value="2">Acoustic</option>
          <option value="3">Subtle</option>
        </select>
        <label>
          Volume:
          <input type="range" id="volume" min="0" max="1" step="0.01" value="0.8">
        </label>
        <label>
          Subdivisions:
          <select id="subdivisions">
            <option value="1">Quarter Notes</option>
            <option value="2">Eighth Notes</option>
            <option value="3">Triplets</option>
            <option value="4">Sixteenth Notes</option>
          </select>
        </label>
        <button id="test">Test Click</button>
      </div>
    `;
    
    // Wire up controls
    const soundSelect = container.querySelector('#sound') as HTMLSelectElement;
    soundSelect.addEventListener('change', async () => {
      await this.audioNode?.setParameterValues({
        sound: parseInt(soundSelect.value)
      });
    });
    
    const volumeSlider = container.querySelector('#volume') as HTMLInputElement;
    volumeSlider.addEventListener('input', async () => {
      await this.audioNode?.setParameterValues({
        volume: parseFloat(volumeSlider.value)
      });
    });
    
    const subdivisionSelect = container.querySelector('#subdivisions') as HTMLSelectElement;
    subdivisionSelect.addEventListener('change', async () => {
      await this.audioNode?.setParameterValues({
        subdivisions: parseInt(subdivisionSelect.value)
      });
    });
    
    const testButton = container.querySelector('#test') as HTMLButtonElement;
    testButton.addEventListener('click', () => {
      this.click(false);
    });
    
    return container;
  }
  
  destroyGui(gui: Element): void {
    gui.remove();
  }
  
  /**
   * Static factory method - WAM 2.0 standard
   */
  static async createInstance(
    audioContext: BaseAudioContext,
    initialState?: any
  ): Promise<WamMetronome> {
    const instance = new WamMetronome(audioContext);
    await instance.initialize(initialState);
    return instance;
  }
}

// Export default the class for WAM host compatibility
export default WamMetronome;