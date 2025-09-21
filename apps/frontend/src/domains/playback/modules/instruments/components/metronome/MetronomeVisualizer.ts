/**
 * Metronome Visualizer
 *
 * Handles visual feedback and UI updates for metronome
 */

import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('MetronomeVisualizer');

export interface VisualState {
  currentBeat: number;
  currentSubdivision: number;
  isPlaying: boolean;
  tempo: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
  accentPattern: number[];
}

export interface VisualElement {
  id: string;
  type: 'beat' | 'subdivision' | 'pendulum' | 'flash';
  element?: HTMLElement;
  update: (state: VisualState) => void;
}

export interface VisualizerOptions {
  enablePendulum?: boolean;
  enableFlash?: boolean;
  enableBeatIndicators?: boolean;
  beatIndicatorCount?: number;
  flashDuration?: number; // in ms
  pendulumSwingDuration?: number; // in ms
  colors?: {
    accent?: string;
    regular?: string;
    subdivision?: string;
    inactive?: string;
  };
}

/**
 * Visual feedback system for metronome
 */
export class MetronomeVisualizer {
  private state: VisualState = {
    currentBeat: 0,
    currentSubdivision: 0,
    isPlaying: false,
    tempo: 120,
    timeSignature: { numerator: 4, denominator: 4 },
    accentPattern: [1],
  };

  private options: VisualizerOptions;
  private elements: Map<string, VisualElement> = new Map();
  private animationFrameId: number | null = null;
  private lastUpdateTime = 0;
  private updateCallbacks: Set<(state: VisualState) => void> = new Set();

  constructor(options: VisualizerOptions = {}) {
    this.options = {
      enablePendulum: true,
      enableFlash: true,
      enableBeatIndicators: true,
      beatIndicatorCount: 4,
      flashDuration: 100,
      pendulumSwingDuration: 500,
      colors: {
        accent: '#ff6b6b',
        regular: '#4ecdc4',
        subdivision: '#95e1d3',
        inactive: '#636e72',
        ...options.colors,
      },
      ...options,
    };
  }

  /**
   * Initialize visualizer
   */
  initialize(container?: HTMLElement): void {
    if (!container && typeof document === 'undefined') {
      logger.warn('No container provided and document not available');
      return;
    }

    // Create visual elements
    if (this.options.enableBeatIndicators) {
      this.createBeatIndicators(container);
    }

    if (this.options.enablePendulum) {
      this.createPendulum(container);
    }

    if (this.options.enableFlash) {
      this.createFlashElement(container);
    }

    logger.info('MetronomeVisualizer initialized', {
      elementCount: this.elements.size,
    });
  }

  /**
   * Update visual state
   */
  updateBeat(beat: number, subdivision = 0): void {
    this.state.currentBeat = beat;
    this.state.currentSubdivision = subdivision;
    this.lastUpdateTime = performance.now();

    // Update all visual elements
    for (const element of this.elements.values()) {
      try {
        element.update(this.state);
      } catch (error) {
        logger.error('Failed to update visual element', error, {
          elementId: element.id,
        });
      }
    }

    // Trigger callbacks
    for (const callback of this.updateCallbacks) {
      try {
        callback(this.state);
      } catch (error) {
        logger.error('Update callback error', error);
      }
    }

    // Flash effect
    if (this.options.enableFlash && subdivision === 0) {
      this.triggerFlash(this.state.accentPattern.includes(beat));
    }
  }

  /**
   * Set playing state
   */
  setPlaying(playing: boolean): void {
    this.state.isPlaying = playing;

    if (playing) {
      this.startAnimation();
    } else {
      this.stopAnimation();
      this.resetVisuals();
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: {
    tempo?: number;
    timeSignature?: { numerator: number; denominator: number };
    accentPattern?: number[];
  }): void {
    if (config.tempo !== undefined) {
      this.state.tempo = config.tempo;
    }

    if (config.timeSignature) {
      this.state.timeSignature = config.timeSignature;
      // Recreate beat indicators if needed
      if (this.options.enableBeatIndicators) {
        this.updateBeatIndicators();
      }
    }

    if (config.accentPattern) {
      this.state.accentPattern = config.accentPattern;
    }
  }

  /**
   * Create beat indicators
   */
  private createBeatIndicators(container?: HTMLElement): void {
    const count = this.state.timeSignature.numerator;

    for (let i = 0; i < count; i++) {
      const beat = i + 1;
      const indicator: VisualElement = {
        id: `beat-indicator-${beat}`,
        type: 'beat',
        update: (state) => {
          if (!indicator.element) return;

          const isActive =
            state.currentBeat === beat && state.currentSubdivision === 0;
          const isAccent = state.accentPattern.includes(beat);

          indicator.element.style.backgroundColor = isActive
            ? isAccent
              ? this.options.colors!.accent
              : this.options.colors!.regular
            : this.options.colors!.inactive!;

          indicator.element.style.transform = isActive
            ? 'scale(1.2)'
            : 'scale(1)';
        },
      };

      // Create DOM element if container provided
      if (container && typeof document !== 'undefined') {
        const element = document.createElement('div');
        element.className = 'metronome-beat-indicator';
        element.style.cssText = `
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background-color: ${this.options.colors!.inactive};
          transition: all 0.1s ease;
          margin: 0 5px;
          display: inline-block;
        `;
        container.appendChild(element);
        indicator.element = element;
      }

      this.elements.set(indicator.id, indicator);
    }
  }

  /**
   * Create pendulum element
   */
  private createPendulum(container?: HTMLElement): void {
    const pendulum: VisualElement = {
      id: 'pendulum',
      type: 'pendulum',
      update: (state) => {
        if (!pendulum.element) return;

        // Calculate pendulum angle based on beat
        const beatProgress =
          (state.currentBeat - 1 + state.currentSubdivision) /
          state.timeSignature.numerator;
        const angle = Math.sin(beatProgress * Math.PI * 2) * 30; // ±30 degrees

        pendulum.element.style.transform = `rotate(${angle}deg)`;
      },
    };

    // Create DOM element if container provided
    if (container && typeof document !== 'undefined') {
      const element = document.createElement('div');
      element.className = 'metronome-pendulum';
      element.style.cssText = `
        width: 2px;
        height: 100px;
        background-color: #2d3436;
        transform-origin: top center;
        transition: transform ${this.options.pendulumSwingDuration}ms ease-in-out;
        margin: 20px auto;
      `;

      // Add pendulum weight
      const weight = document.createElement('div');
      weight.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: #2d3436;
        position: absolute;
        bottom: -10px;
        left: -9px;
      `;
      element.appendChild(weight);

      container.appendChild(element);
      pendulum.element = element;
    }

    this.elements.set(pendulum.id, pendulum);
  }

  /**
   * Create flash element
   */
  private createFlashElement(container?: HTMLElement): void {
    const flash: VisualElement = {
      id: 'flash',
      type: 'flash',
      update: () => {
        // Flash is triggered separately
      },
    };

    // Create DOM element if container provided
    if (container && typeof document !== 'undefined') {
      const element = document.createElement('div');
      element.className = 'metronome-flash';
      element.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: white;
        opacity: 0;
        pointer-events: none;
        transition: opacity ${this.options.flashDuration}ms ease;
      `;
      container.style.position = 'relative';
      container.appendChild(element);
      flash.element = element;
    }

    this.elements.set(flash.id, flash);
  }

  /**
   * Trigger flash effect
   */
  private triggerFlash(isAccent: boolean): void {
    const flash = this.elements.get('flash');
    if (!flash || !flash.element) return;

    const color = isAccent
      ? this.options.colors!.accent
      : this.options.colors!.regular;
    flash.element.style.backgroundColor = color;
    flash.element.style.opacity = '0.3';

    setTimeout(() => {
      if (flash.element) {
        flash.element.style.opacity = '0';
      }
    }, this.options.flashDuration);
  }

  /**
   * Update beat indicators for new time signature
   */
  private updateBeatIndicators(): void {
    // Remove existing indicators
    for (const [id, element] of this.elements) {
      if (element.type === 'beat') {
        if (element.element && element.element.parentNode) {
          element.element.parentNode.removeChild(element.element);
        }
        this.elements.delete(id);
      }
    }

    // Create new indicators
    const container = this.elements.values().next().value?.element?.parentNode;
    if (container instanceof HTMLElement) {
      this.createBeatIndicators(container);
    }
  }

  /**
   * Start animation loop
   */
  private startAnimation(): void {
    if (this.animationFrameId !== null) return;

    const animate = () => {
      // Update pendulum smooth animation
      const pendulum = this.elements.get('pendulum');
      if (pendulum && pendulum.element) {
        const timeSinceUpdate = performance.now() - this.lastUpdateTime;
        const beatDuration = 60000 / this.state.tempo;
        const progress = (timeSinceUpdate % beatDuration) / beatDuration;

        const angle = Math.sin(progress * Math.PI * 2) * 30;
        pendulum.element.style.transform = `rotate(${angle}deg)`;
      }

      this.animationFrameId = requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Stop animation loop
   */
  private stopAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Reset all visuals
   */
  private resetVisuals(): void {
    this.state.currentBeat = 0;
    this.state.currentSubdivision = 0;

    for (const element of this.elements.values()) {
      element.update(this.state);
    }
  }

  /**
   * Add update callback
   */
  onUpdate(callback: (state: VisualState) => void): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  /**
   * Dispose visualizer
   */
  dispose(): void {
    this.stopAnimation();

    // Remove DOM elements
    for (const element of this.elements.values()) {
      if (element.element && element.element.parentNode) {
        element.element.parentNode.removeChild(element.element);
      }
    }

    this.elements.clear();
    this.updateCallbacks.clear();

    logger.info('MetronomeVisualizer disposed');
  }

  /**
   * Get current state
   */
  getState(): VisualState {
    return { ...this.state };
  }
}
