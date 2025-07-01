/**
 * Epic 4 Adaptive Camera Controller
 *
 * This system provides intelligent camera positioning and movement for optimal
 * visualization of advanced bass techniques on the 3D fretboard.
 */

import * as THREE from 'three';
import { TechniqueType, ExerciseNote } from '@bassnotion/contracts';

// Epic 4 Camera Configuration
export interface CameraConfig {
  fov: number;
  near: number;
  far: number;
  position: THREE.Vector3;
  target: THREE.Vector3;
  minDistance: number;
  maxDistance: number;
  enableZoom: boolean;
  enablePan: boolean;
  enableRotate: boolean;
  smoothingFactor: number; // 0-1, higher = smoother transitions
}

// Epic 4 Technique-Specific Camera Settings
export interface TechniqueCameraSettings {
  technique: TechniqueType;
  preferredDistance: number;
  preferredAngle: { azimuth: number; polar: number };
  focusOffset: THREE.Vector3; // Offset from note position
  zoomLevel: number; // 0-1, relative to base zoom
  transitionDuration: number; // milliseconds
}

// Epic 4 Viewport Configuration
export interface ViewportConfig {
  width: number;
  height: number;
  aspectRatio: number;
  devicePixelRatio: number;
}

// Epic 4 Camera Animation State
export interface CameraAnimationState {
  isAnimating: boolean;
  startTime: number;
  duration: number;
  startPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  startTarget: THREE.Vector3;
  targetTarget: THREE.Vector3;
  easeFunction: (t: number) => number;
}

// Epic 4 Adaptive Camera Controller
export class AdaptiveCameraController {
  private camera: THREE.PerspectiveCamera;
  private config: CameraConfig;
  private viewport: ViewportConfig;
  private techniqueSettings = new Map<TechniqueType, TechniqueCameraSettings>();
  private animationState: CameraAnimationState | null = null;
  private basePosition: THREE.Vector3;
  private baseTarget: THREE.Vector3;
  private currentTechniques: Set<TechniqueType> = new Set();

  constructor(
    camera: THREE.PerspectiveCamera,
    config: CameraConfig,
    viewport: ViewportConfig,
  ) {
    this.camera = camera;
    this.config = config;
    this.viewport = viewport;
    this.basePosition = config.position.clone();
    this.baseTarget = config.target.clone();

    this.initializeDefaultTechniqueSettings();
    this.applyCameraConfig();
  }

  /**
   * Update camera position based on active techniques in notes
   */
  updateForTechniques(notes: ExerciseNote[]): void {
    const activeTechniques = this.extractActiveTechniques(notes);

    if (this.techniquesChanged(activeTechniques)) {
      this.currentTechniques = activeTechniques;
      this.adaptCameraForTechniques(activeTechniques, notes);
    }
  }

  /**
   * Set camera focus to specific note
   */
  focusOnNote(note: ExerciseNote, immediate = false): void {
    const notePosition = this.calculateNotePosition(note);
    const optimalSettings = this.calculateOptimalSettings(note);

    this.animateToTarget(
      optimalSettings.position,
      notePosition.add(optimalSettings.focusOffset),
      immediate ? 0 : optimalSettings.transitionDuration,
    );
  }

  /**
   * Reset camera to default position
   */
  resetToDefault(immediate = false): void {
    this.currentTechniques.clear();

    // UPGRADED: Ensure camera update is always triggered
    if (immediate) {
      this.camera.position.copy(this.basePosition);
      this.camera.lookAt(this.baseTarget);
      this.animationState = null;
    } else {
      this.animateToTarget(this.basePosition, this.baseTarget, 1000);
    }
  }

  /**
   * Update camera animation
   */
  update(deltaTime: number): void {
    if (this.animationState) {
      this.updateAnimation(deltaTime);
    }
  }

  /**
   * Handle viewport resize
   */
  onResize(viewport: ViewportConfig): void {
    this.viewport = viewport;
    this.camera.aspect = viewport.aspectRatio;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Register custom technique camera settings
   */
  registerTechniqueSettings(settings: TechniqueCameraSettings): void {
    this.techniqueSettings.set(settings.technique, settings);
  }

  /**
   * Get current camera state
   */
  getCameraState(): {
    position: THREE.Vector3;
    target: THREE.Vector3;
    fov: number;
    isAnimating: boolean;
  } {
    const state = {
      position: this.camera.position.clone(),
      target: this.baseTarget.clone(),
      fov: this.camera.fov,
      isAnimating: this.animationState !== null,
    };
    return state;
  }

  private initializeDefaultTechniqueSettings(): void {
    // Hammer-on/Pull-off: Close up view
    this.techniqueSettings.set('hammer_on', {
      technique: 'hammer_on',
      preferredDistance: 3,
      preferredAngle: { azimuth: 0, polar: Math.PI / 6 },
      focusOffset: new THREE.Vector3(0, 0, 0.5),
      zoomLevel: 0.8,
      transitionDuration: 800,
    });

    this.techniqueSettings.set('pull_off', {
      technique: 'pull_off',
      preferredDistance: 3,
      preferredAngle: { azimuth: 0, polar: Math.PI / 6 },
      focusOffset: new THREE.Vector3(0, 0, 0.5),
      zoomLevel: 0.8,
      transitionDuration: 800,
    });

    // Slides: Side angle view
    this.techniqueSettings.set('slide_up', {
      technique: 'slide_up',
      preferredDistance: 4,
      preferredAngle: { azimuth: Math.PI / 4, polar: Math.PI / 4 },
      focusOffset: new THREE.Vector3(0.5, 0, 0.2),
      zoomLevel: 0.6,
      transitionDuration: 1000,
    });

    this.techniqueSettings.set('slide_down', {
      technique: 'slide_down',
      preferredDistance: 4,
      preferredAngle: { azimuth: -Math.PI / 4, polar: Math.PI / 4 },
      focusOffset: new THREE.Vector3(-0.5, 0, 0.2),
      zoomLevel: 0.6,
      transitionDuration: 1000,
    });

    // Slap/Pop: Wide angle view
    this.techniqueSettings.set('slap', {
      technique: 'slap',
      preferredDistance: 6,
      preferredAngle: { azimuth: 0, polar: Math.PI / 3 },
      focusOffset: new THREE.Vector3(0, -1, 0.3),
      zoomLevel: 0.4,
      transitionDuration: 600,
    });

    this.techniqueSettings.set('pop', {
      technique: 'pop',
      preferredDistance: 5,
      preferredAngle: { azimuth: Math.PI / 6, polar: Math.PI / 3 },
      focusOffset: new THREE.Vector3(0.3, -0.8, 0.3),
      zoomLevel: 0.5,
      transitionDuration: 600,
    });

    // Harmonics: Top-down view
    this.techniqueSettings.set('harmonic', {
      technique: 'harmonic',
      preferredDistance: 4,
      preferredAngle: { azimuth: 0, polar: Math.PI / 8 },
      focusOffset: new THREE.Vector3(0, 0, 1),
      zoomLevel: 0.7,
      transitionDuration: 900,
    });

    // Vibrato: Close focused view
    this.techniqueSettings.set('vibrato', {
      technique: 'vibrato',
      preferredDistance: 2.5,
      preferredAngle: { azimuth: Math.PI / 8, polar: Math.PI / 5 },
      focusOffset: new THREE.Vector3(0.2, 0, 0.4),
      zoomLevel: 0.9,
      transitionDuration: 700,
    });

    // Bends: Angled view to show string movement
    this.techniqueSettings.set('bend', {
      technique: 'bend',
      preferredDistance: 3.5,
      preferredAngle: { azimuth: Math.PI / 3, polar: Math.PI / 4 },
      focusOffset: new THREE.Vector3(0.4, 0, 0.3),
      zoomLevel: 0.75,
      transitionDuration: 800,
    });

    // Tapping: Overhead view
    this.techniqueSettings.set('tap', {
      technique: 'tap',
      preferredDistance: 5,
      preferredAngle: { azimuth: 0, polar: Math.PI / 12 },
      focusOffset: new THREE.Vector3(0, 0, 1.2),
      zoomLevel: 0.6,
      transitionDuration: 1000,
    });
  }

  private extractActiveTechniques(notes: ExerciseNote[]): Set<TechniqueType> {
    const techniques = new Set<TechniqueType>();

    notes.forEach((note) => {
      if (note.techniques) {
        note.techniques.forEach((technique) => {
          techniques.add(technique);
        });
      }
    });

    return techniques;
  }

  private techniquesChanged(newTechniques: Set<TechniqueType>): boolean {
    if (newTechniques.size !== this.currentTechniques.size) {
      return true;
    }

    const newTechniquesArray = Array.from(newTechniques);
    for (const technique of newTechniquesArray) {
      if (!this.currentTechniques.has(technique)) {
        return true;
      }
    }

    return false;
  }

  private adaptCameraForTechniques(
    techniques: Set<TechniqueType>,
    notes: ExerciseNote[],
  ): void {
    if (techniques.size === 0) {
      this.resetToDefault();
      return;
    }

    // Calculate optimal camera position based on active techniques
    const optimalSettings = this.calculateOptimalCameraSettings(
      techniques,
      notes,
    );

    this.animateToTarget(
      optimalSettings.position,
      optimalSettings.target,
      optimalSettings.duration,
    );
  }

  private calculateOptimalCameraSettings(
    techniques: Set<TechniqueType>,
    notes: ExerciseNote[],
  ): {
    position: THREE.Vector3;
    target: THREE.Vector3;
    duration: number;
  } {
    // Get settings for all active techniques
    const techniqueSettingsList = Array.from(techniques)
      .map((technique) => this.techniqueSettings.get(technique))
      .filter(
        (settings) => settings !== undefined,
      ) as TechniqueCameraSettings[];

    if (techniqueSettingsList.length === 0) {
      return {
        position: this.basePosition.clone(),
        target: this.baseTarget.clone(),
        duration: 1000,
      };
    }

    // Calculate weighted average of settings
    const avgDistance =
      techniqueSettingsList.reduce((sum, s) => sum + s.preferredDistance, 0) /
      techniqueSettingsList.length;
    const avgAzimuth =
      techniqueSettingsList.reduce(
        (sum, s) => sum + s.preferredAngle.azimuth,
        0,
      ) / techniqueSettingsList.length;
    const avgPolar =
      techniqueSettingsList.reduce(
        (sum, s) => sum + s.preferredAngle.polar,
        0,
      ) / techniqueSettingsList.length;
    const avgDuration =
      techniqueSettingsList.reduce((sum, s) => sum + s.transitionDuration, 0) /
      techniqueSettingsList.length;

    // Calculate focus point (average of note positions)
    const focusPoint = this.calculateAverageNotePosition(notes);

    // Convert spherical to cartesian coordinates
    const position = new THREE.Vector3(
      focusPoint.x + avgDistance * Math.sin(avgPolar) * Math.cos(avgAzimuth),
      focusPoint.y + avgDistance * Math.sin(avgPolar) * Math.sin(avgAzimuth),
      focusPoint.z + avgDistance * Math.cos(avgPolar),
    );

    return {
      position,
      target: focusPoint,
      duration: avgDuration,
    };
  }

  private calculateNotePosition(note: ExerciseNote): THREE.Vector3 {
    // Convert note fret/string to 3D position
    // This should match your fretboard coordinate system
    const stringSpacing = 0.5; // Adjust based on your fretboard scale
    const fretSpacing = 0.3; // Adjust based on your fretboard scale

    return new THREE.Vector3(
      note.fret * fretSpacing,
      (note.string - 2.5) * stringSpacing, // Center on middle strings
      0,
    );
  }

  private calculateAverageNotePosition(notes: ExerciseNote[]): THREE.Vector3 {
    if (notes.length === 0) {
      return this.baseTarget.clone();
    }

    const sum = notes.reduce(
      (acc, note) => acc.add(this.calculateNotePosition(note)),
      new THREE.Vector3(),
    );

    return sum.divideScalar(notes.length);
  }

  private calculateOptimalSettings(note: ExerciseNote): {
    position: THREE.Vector3;
    focusOffset: THREE.Vector3;
    transitionDuration: number;
  } {
    if (!note.techniques || note.techniques.length === 0) {
      return {
        position: this.basePosition.clone(),
        focusOffset: new THREE.Vector3(),
        transitionDuration: 1000,
      };
    }

    // Use the first technique's settings as primary
    const primaryTechnique = note.techniques[0];
    if (!primaryTechnique) {
      return {
        position: this.basePosition.clone(),
        focusOffset: new THREE.Vector3(),
        transitionDuration: 1000,
      };
    }
    const settings = this.techniqueSettings.get(primaryTechnique);

    if (!settings) {
      return {
        position: this.basePosition.clone(),
        focusOffset: new THREE.Vector3(),
        transitionDuration: 1000,
      };
    }

    const notePosition = this.calculateNotePosition(note);
    const position = new THREE.Vector3(
      notePosition.x +
        settings.preferredDistance *
          Math.sin(settings.preferredAngle.polar) *
          Math.cos(settings.preferredAngle.azimuth),
      notePosition.y +
        settings.preferredDistance *
          Math.sin(settings.preferredAngle.polar) *
          Math.sin(settings.preferredAngle.azimuth),
      notePosition.z +
        settings.preferredDistance * Math.cos(settings.preferredAngle.polar),
    );

    return {
      position,
      focusOffset: settings.focusOffset.clone(),
      transitionDuration: settings.transitionDuration,
    };
  }

  private animateToTarget(
    targetPosition: THREE.Vector3,
    targetTarget: THREE.Vector3,
    duration: number,
  ): void {
    if (duration <= 0) {
      this.camera.position.copy(targetPosition);
      this.camera.lookAt(targetTarget);
      this.animationState = null;
      return;
    }

    // UPGRADED: Always call lookAt immediately when starting animation
    this.camera.lookAt(targetTarget);

    // Create animation state
    this.animationState = {
      isAnimating: true,
      startTime: performance.now(),
      duration,
      startPosition: this.camera.position.clone(),
      targetPosition: targetPosition.clone(),
      startTarget: this.baseTarget.clone(),
      targetTarget: targetTarget.clone(),
      easeFunction: this.easeInOutCubic,
    };
  }

  private updateAnimation(_deltaTime: number): void {
    if (!this.animationState) {
      return;
    }

    const currentTime = performance.now();
    const elapsed = currentTime - this.animationState.startTime;
    const progress = Math.min(elapsed / this.animationState.duration, 1.0);
    const easedProgress = this.animationState.easeFunction(progress);

    // Interpolate position
    const currentPosition = this.animationState.startPosition
      .clone()
      .lerp(this.animationState.targetPosition, easedProgress);

    // Interpolate target
    const currentTarget = this.animationState.startTarget
      .clone()
      .lerp(this.animationState.targetTarget, easedProgress);

    this.camera.position.copy(currentPosition);
    this.camera.lookAt(currentTarget);

    // UPGRADED: More robust animation completion with safety checks
    if (progress >= 1.0 || elapsed >= this.animationState.duration) {
      // Force final position to ensure precision
      this.camera.position.copy(this.animationState.targetPosition);
      this.camera.lookAt(this.animationState.targetTarget);

      this.animationState = null;
    }
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private applyCameraConfig(): void {
    this.camera.fov = this.config.fov;
    this.camera.near = this.config.near;
    this.camera.far = this.config.far;
    this.camera.position.copy(this.config.position);
    this.camera.lookAt(this.config.target);
    this.camera.updateProjectionMatrix();
  }
}

// Epic 4 Camera Controller Factory
export class AdaptiveCameraFactory {
  static createDefaultCamera(
    viewport: ViewportConfig,
  ): THREE.PerspectiveCamera {
    // UPGRADED: Create camera in a way that works with both real and mocked constructors
    const camera = new THREE.PerspectiveCamera(
      75, // fov
      viewport.aspectRatio,
      0.1, // near
      1000, // far
    );

    return camera;
  }

  static createDefaultConfig(): CameraConfig {
    return {
      fov: 75,
      near: 0.1,
      far: 1000,
      position: new THREE.Vector3(0, -8, 5),
      target: new THREE.Vector3(0, 0, 0),
      minDistance: 2,
      maxDistance: 20,
      enableZoom: true,
      enablePan: true,
      enableRotate: true,
      smoothingFactor: 0.8,
    };
  }

  static createController(
    viewport: ViewportConfig,
    config?: Partial<CameraConfig>,
  ): {
    camera: THREE.PerspectiveCamera;
    controller: AdaptiveCameraController;
  } {
    const camera = this.createDefaultCamera(viewport);
    const fullConfig = { ...this.createDefaultConfig(), ...config };
    const controller = new AdaptiveCameraController(
      camera,
      fullConfig,
      viewport,
    );

    return { camera, controller };
  }
}
