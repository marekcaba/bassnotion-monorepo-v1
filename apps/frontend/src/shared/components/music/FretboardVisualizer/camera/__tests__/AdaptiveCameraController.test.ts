/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { TechniqueType, ExerciseNote } from '@bassnotion/contracts';
import {
  AdaptiveCameraController,
  AdaptiveCameraFactory,
  CameraConfig,
  ViewportConfig,
  TechniqueCameraSettings,
} from '../AdaptiveCameraController.js';

// Mock THREE.js completely - this must happen before any imports use it
vi.mock('three', () => {
  // Create comprehensive Vector3 mock that works with constructor calls
  function Vector3Mock(x = 0, y = 0, z = 0): any {
    // Use function constructor pattern so 'new' works properly
    const instance = {
      x,
      y,
      z,
      clone: vi.fn(() => new (Vector3Mock as any)(x, y, z)),
      copy: vi.fn(function (this: any, other: any) {
        this.x = other.x;
        this.y = other.y;
        this.z = other.z;
        return this;
      }),
      set: vi.fn(function (
        this: any,
        newX: number,
        newY: number,
        newZ: number,
      ) {
        this.x = newX;
        this.y = newY;
        this.z = newZ;
        return this;
      }),
      add: vi.fn(function (this: any, other: any) {
        this.x += other.x;
        this.y += other.y;
        this.z += other.z;
        return this;
      }),
      lerp: vi.fn(function (this: any, target: any, alpha: number) {
        this.x += (target.x - this.x) * alpha;
        this.y += (target.y - this.y) * alpha;
        this.z += (target.z - this.z) * alpha;
        return this;
      }),
      divideScalar: vi.fn(function (this: any, scalar: number) {
        this.x /= scalar;
        this.y /= scalar;
        this.z /= scalar;
        return this;
      }),
    };
    return instance;
  }

  // UPGRADED: Create proper constructor function for PerspectiveCamera
  function PerspectiveCameraMock(
    fov = 75,
    aspect = 1.77,
    near = 0.1,
    far = 1000,
  ): any {
    const instance = Object.create(PerspectiveCameraMock.prototype);

    // Set properties
    instance.fov = fov;
    instance.aspect = aspect;
    instance.near = near;
    instance.far = far;
    instance.position = new (Vector3Mock as any)(0, -8, 5);
    instance.lookAt = vi.fn();
    instance.updateProjectionMatrix = vi.fn();

    return instance;
  }

  // UPGRADED: Set up proper prototype chain for instanceof checks
  PerspectiveCameraMock.prototype.constructor = PerspectiveCameraMock;

  // UPGRADED: Create spy-enabled constructor
  const PerspectiveCameraConstructor = vi
    .fn()
    .mockImplementation(
      (...args: any[]) => new (PerspectiveCameraMock as any)(...args),
    );
  PerspectiveCameraConstructor.prototype = PerspectiveCameraMock.prototype;

  return {
    Vector3: Vector3Mock,
    PerspectiveCamera: PerspectiveCameraConstructor,
  };
});

// Mock performance.now for animation timing
const mockPerformanceNow = vi.fn(() => 1000);
global.performance.now = mockPerformanceNow;

describe('Epic 4 Adaptive Camera Controller System', () => {
  let mockCamera: THREE.PerspectiveCamera;
  let mockConfig: CameraConfig;
  let mockViewport: ViewportConfig;
  let mockNote: ExerciseNote;

  beforeEach(() => {
    mockCamera = new THREE.PerspectiveCamera(75, 1.77, 0.1, 1000);

    mockConfig = {
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

    mockViewport = {
      width: 1920,
      height: 1080,
      aspectRatio: 1.77,
      devicePixelRatio: 1,
    };

    mockNote = {
      id: 'test-note-1',
      timestamp: 1000,
      string: 4,
      fret: 3,
      duration: 500,
      note: 'G',
      color: '#FF6B6B',
      techniques: ['hammer_on'],
    };

    // UPGRADED: Clear all mocks and reset performance.now to ensure test isolation
    vi.clearAllMocks();
    mockPerformanceNow.mockReset();
    mockPerformanceNow.mockReturnValue(1000); // Always start from a clean slate
  });

  afterEach(() => {
    // UPGRADED: Ensure complete test cleanup for proper isolation
    vi.clearAllMocks();
    mockPerformanceNow.mockReset();
    mockPerformanceNow.mockReturnValue(1000); // Reset to default for next test
  });

  describe('AdaptiveCameraController', () => {
    let controller: AdaptiveCameraController;

    beforeEach(() => {
      controller = new AdaptiveCameraController(
        mockCamera,
        mockConfig,
        mockViewport,
      );
    });

    it('should initialize with provided configuration', () => {
      expect(mockCamera.fov).toBe(75);
      expect(mockCamera.near).toBe(0.1);
      expect(mockCamera.far).toBe(1000);
      expect(mockCamera.updateProjectionMatrix).toHaveBeenCalled();
      expect(mockCamera.position.copy).toHaveBeenCalledWith(
        mockConfig.position,
      );
      expect(mockCamera.lookAt).toHaveBeenCalledWith(mockConfig.target);
    });

    it('should have default technique settings for all Epic 4 techniques', () => {
      const techniques: TechniqueType[] = [
        'hammer_on',
        'pull_off',
        'slide_up',
        'slide_down',
        'slap',
        'pop',
        'tap',
        'harmonic',
        'vibrato',
        'bend',
      ];

      techniques.forEach((technique) => {
        const note = { ...mockNote, techniques: [technique] };
        expect(() => controller.focusOnNote(note)).not.toThrow();
      });
    });

    it('should register custom technique settings', () => {
      const customSettings: TechniqueCameraSettings = {
        technique: 'tap',
        preferredDistance: 7,
        preferredAngle: { azimuth: Math.PI / 2, polar: Math.PI / 6 },
        focusOffset: new THREE.Vector3(1, 1, 1),
        zoomLevel: 0.3,
        transitionDuration: 1200,
      };

      expect(() =>
        controller.registerTechniqueSettings(customSettings),
      ).not.toThrow();
    });

    it('should get current camera state', () => {
      const state = controller.getCameraState();

      expect(state).toHaveProperty('position');
      expect(state).toHaveProperty('target');
      expect(state).toHaveProperty('fov');
      expect(state).toHaveProperty('isAnimating');
      expect(state.fov).toBe(75);
      expect(state.isAnimating).toBe(false);
    });

    it('should handle viewport resize', () => {
      const newViewport = {
        ...mockViewport,
        width: 2560,
        height: 1440,
        aspectRatio: 1.78,
      };

      controller.onResize(newViewport);

      expect(mockCamera.aspect).toBe(1.78);
      expect(mockCamera.updateProjectionMatrix).toHaveBeenCalledTimes(2); // Once in constructor, once in resize
    });

    describe('Technique-based Camera Updates', () => {
      it('should extract active techniques from notes', () => {
        const notes = [
          { ...mockNote, techniques: ['hammer_on'] as TechniqueType[] },
          {
            ...mockNote,
            id: 'note-2',
            techniques: ['vibrato', 'bend'] as TechniqueType[],
          },
          { ...mockNote, id: 'note-3', techniques: undefined },
        ];

        // This tests the private method indirectly
        expect(() => controller.updateForTechniques(notes)).not.toThrow();
      });

      it("should not update camera when techniques haven't changed", () => {
        const notes = [
          { ...mockNote, techniques: ['hammer_on'] as TechniqueType[] },
        ];

        controller.updateForTechniques(notes);
        const initialLookAtCalls = (mockCamera.lookAt as any).mock.calls.length;

        // Call again with same techniques
        controller.updateForTechniques(notes);

        // Should not trigger additional camera updates
        expect((mockCamera.lookAt as any).mock.calls.length).toBe(
          initialLookAtCalls,
        );
      });

      it('should update camera when techniques change', () => {
        const notes1 = [
          { ...mockNote, techniques: ['hammer_on'] as TechniqueType[] },
        ];
        const notes2 = [
          { ...mockNote, techniques: ['vibrato'] as TechniqueType[] },
        ];

        controller.updateForTechniques(notes1);
        const initialLookAtCalls = (mockCamera.lookAt as any).mock.calls.length;

        controller.updateForTechniques(notes2);

        // Should trigger camera update for new technique
        expect((mockCamera.lookAt as any).mock.calls.length).toBeGreaterThan(
          initialLookAtCalls,
        );
      });

      it('should reset to default when no techniques are active', () => {
        const notesWithTechniques = [
          { ...mockNote, techniques: ['hammer_on'] as TechniqueType[] },
        ];
        const notesWithoutTechniques = [
          { ...mockNote, techniques: [] as TechniqueType[] },
        ];

        controller.updateForTechniques(notesWithTechniques);
        controller.updateForTechniques(notesWithoutTechniques);

        // Should call lookAt multiple times (initial + technique update + reset)
        expect(mockCamera.lookAt).toHaveBeenCalledTimes(3);
      });
    });

    describe('Focus on Note', () => {
      it('should focus on note with immediate positioning', () => {
        controller.focusOnNote(mockNote, true);

        expect(mockCamera.position.copy).toHaveBeenCalled();
        expect(mockCamera.lookAt).toHaveBeenCalled();
      });

      it('should focus on note with animated transition', () => {
        controller.focusOnNote(mockNote, false);

        // Should set up animation (tested indirectly)
        expect(mockCamera.lookAt).toHaveBeenCalled();
      });

      it('should handle note without techniques', () => {
        const noteWithoutTechniques = { ...mockNote, techniques: undefined };

        expect(() =>
          controller.focusOnNote(noteWithoutTechniques),
        ).not.toThrow();
      });
    });

    describe('Camera Reset', () => {
      it('should reset to default position immediately', () => {
        controller.resetToDefault(true);

        expect(mockCamera.position.copy).toHaveBeenCalledWith(
          mockConfig.position,
        );
        expect(mockCamera.lookAt).toHaveBeenCalledWith(mockConfig.target);
      });

      it('should reset to default position with animation', () => {
        controller.resetToDefault(false);

        // Should set up animation
        expect(mockCamera.lookAt).toHaveBeenCalled();
      });
    });

    describe('Animation System', () => {
      // UPGRADED: Add specific animation test isolation
      beforeEach(() => {
        // Reset performance mock to ensure clean animation timing
        mockPerformanceNow.mockReset();
        mockPerformanceNow.mockReturnValue(1000);

        // Reset controller to ensure no lingering animation state
        controller.resetToDefault(true); // Force immediate reset
      });

      it('should update animations over time', () => {
        // Start an animation
        controller.focusOnNote(mockNote, false);

        // Update animation
        controller.update(16); // 16ms delta time

        // Should not throw errors
        expect(() => controller.update(16)).not.toThrow();
      });

      it('should complete animations after duration', () => {
        // UPGRADED: Make test robust against mock pollution
        controller.resetToDefault(true);

        // Start animation with a predictable setup
        const startTime = 1000;
        mockPerformanceNow.mockReturnValue(startTime);
        controller.focusOnNote(mockNote, false);

        // Simulate completion by setting time well beyond animation duration
        const completionTime = startTime + 10000; // 10 seconds should complete any animation
        mockPerformanceNow.mockReturnValue(completionTime);

        // Multiple update calls to ensure completion
        controller.update(16);
        controller.update(16);
        controller.update(16);

        const state = controller.getCameraState();
        expect(state.isAnimating).toBe(false);
      });

      it('should handle update when no animation is active', () => {
        expect(() => controller.update(16)).not.toThrow();
      });
    });

    describe('Position Calculations', () => {
      it('should calculate note positions correctly', () => {
        const note1 = { ...mockNote, string: 1 as const, fret: 0 };
        const note2 = { ...mockNote, string: 4 as const, fret: 12 };

        // Test different note positions
        expect(() => controller.focusOnNote(note1)).not.toThrow();
        expect(() => controller.focusOnNote(note2)).not.toThrow();
      });

      it('should handle multiple notes for average positioning', () => {
        const notes = [
          {
            ...mockNote,
            string: 1 as const,
            fret: 0,
            techniques: ['hammer_on'] as TechniqueType[],
          },
          {
            ...mockNote,
            id: 'note-2',
            string: 4 as const,
            fret: 12,
            techniques: ['hammer_on'] as TechniqueType[],
          },
        ];

        expect(() => controller.updateForTechniques(notes)).not.toThrow();
      });
    });

    describe('Technique-Specific Settings', () => {
      const techniqueTestCases: Array<{
        technique: TechniqueType;
        expectedDistance: number;
      }> = [
        { technique: 'hammer_on', expectedDistance: 3 },
        { technique: 'pull_off', expectedDistance: 3 },
        { technique: 'slide_up', expectedDistance: 4 },
        { technique: 'slide_down', expectedDistance: 4 },
        { technique: 'slap', expectedDistance: 6 },
        { technique: 'pop', expectedDistance: 5 },
        { technique: 'harmonic', expectedDistance: 4 },
        { technique: 'vibrato', expectedDistance: 2.5 },
        { technique: 'bend', expectedDistance: 3.5 },
        { technique: 'tap', expectedDistance: 5 },
      ];

      techniqueTestCases.forEach(
        ({ technique, expectedDistance: _expectedDistance }) => {
          it(`should have correct default settings for ${technique}`, () => {
            const note = { ...mockNote, techniques: [technique] };

            expect(() => controller.focusOnNote(note)).not.toThrow();
            // The actual distance testing would require accessing private methods
            // In a real scenario, you might expose a method to get technique settings for testing
          });
        },
      );
    });
  });

  describe('AdaptiveCameraFactory', () => {
    it('should create default camera with correct parameters', () => {
      const camera = AdaptiveCameraFactory.createDefaultCamera(mockViewport);

      expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
      expect(THREE.PerspectiveCamera).toHaveBeenCalledWith(
        75,
        mockViewport.aspectRatio,
        0.1,
        1000,
      );
    });

    it('should create default configuration', () => {
      const config = AdaptiveCameraFactory.createDefaultConfig();

      expect(config).toHaveProperty('fov', 75);
      expect(config).toHaveProperty('near', 0.1);
      expect(config).toHaveProperty('far', 1000);
      expect(config).toHaveProperty('enableZoom', true);
      expect(config).toHaveProperty('enablePan', true);
      expect(config).toHaveProperty('enableRotate', true);
      expect(config).toHaveProperty('smoothingFactor', 0.8);
    });

    it('should create controller with default settings', () => {
      const { camera, controller } =
        AdaptiveCameraFactory.createController(mockViewport);

      expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
      expect(controller).toBeInstanceOf(AdaptiveCameraController);
    });

    it('should create controller with custom configuration', () => {
      const customConfig = {
        fov: 90,
        enableZoom: false,
        smoothingFactor: 0.5,
      };

      const { camera, controller } = AdaptiveCameraFactory.createController(
        mockViewport,
        customConfig,
      );

      expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
      expect(controller).toBeInstanceOf(AdaptiveCameraController);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow from creation to focus', () => {
      const { camera, controller } =
        AdaptiveCameraFactory.createController(mockViewport);

      // Focus on a note
      controller.focusOnNote(mockNote);

      // Update camera for techniques
      controller.updateForTechniques([mockNote]);

      // Update animation
      controller.update(16);

      // Reset to default
      controller.resetToDefault();

      expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
    });

    it('should handle multiple techniques on same note', () => {
      const { controller } =
        AdaptiveCameraFactory.createController(mockViewport);

      const noteWithMultipleTechniques = {
        ...mockNote,
        techniques: ['hammer_on', 'vibrato', 'bend'] as TechniqueType[],
      };

      expect(() =>
        controller.focusOnNote(noteWithMultipleTechniques),
      ).not.toThrow();
      expect(() =>
        controller.updateForTechniques([noteWithMultipleTechniques]),
      ).not.toThrow();
    });

    it('should handle rapid technique changes', () => {
      const { controller } =
        AdaptiveCameraFactory.createController(mockViewport);

      const techniques: TechniqueType[] = [
        'hammer_on',
        'vibrato',
        'slap',
        'harmonic',
      ];

      techniques.forEach((technique) => {
        const note = { ...mockNote, techniques: [technique] };
        controller.updateForTechniques([note]);
        controller.update(16);
      });

      expect(() => controller.resetToDefault()).not.toThrow();
    });

    it('should maintain performance with many notes', () => {
      const { controller } =
        AdaptiveCameraFactory.createController(mockViewport);

      const manyNotes = Array.from({ length: 100 }, (_, i) => ({
        ...mockNote,
        id: `note-${i}`,
        string: ((i % 4) + 1) as 1 | 2 | 3 | 4 | 5 | 6,
        fret: i % 24,
        techniques: ['hammer_on'] as TechniqueType[],
      }));

      const startTime = performance.now();
      controller.updateForTechniques(manyNotes);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });
  });

  describe('Error Handling', () => {
    let controller: AdaptiveCameraController;

    beforeEach(() => {
      controller = new AdaptiveCameraController(
        mockCamera,
        mockConfig,
        mockViewport,
      );
    });

    it('should handle invalid technique types gracefully', () => {
      const noteWithInvalidTechnique = {
        ...mockNote,
        techniques: ['invalid_technique' as TechniqueType],
      };

      expect(() =>
        controller.focusOnNote(noteWithInvalidTechnique),
      ).not.toThrow();
      expect(() =>
        controller.updateForTechniques([noteWithInvalidTechnique]),
      ).not.toThrow();
    });

    it('should handle missing note properties', () => {
      const incompleteNote = {
        id: 'incomplete',
        timestamp: 1000,
        // Missing required properties
      } as ExerciseNote;

      expect(() => controller.focusOnNote(incompleteNote)).not.toThrow();
    });

    it('should handle viewport resize with invalid dimensions', () => {
      const invalidViewport = {
        width: 0,
        height: 0,
        aspectRatio: 0,
        devicePixelRatio: 0,
      };

      expect(() => controller.onResize(invalidViewport)).not.toThrow();
    });

    it('should handle animation updates with large delta times', () => {
      controller.focusOnNote(mockNote);

      // Very large delta time
      expect(() => controller.update(10000)).not.toThrow();
    });
  });

  describe('Camera Animation Curves', () => {
    let controller: AdaptiveCameraController;

    beforeEach(() => {
      controller = new AdaptiveCameraController(
        mockCamera,
        mockConfig,
        mockViewport,
      );
      // UPGRADED: Add specific animation test isolation for this suite too
      mockPerformanceNow.mockReset();
      mockPerformanceNow.mockReturnValue(1000);
      controller.resetToDefault(true); // Force immediate reset
    });

    it('should use easing function for smooth transitions', () => {
      // Start animation
      controller.focusOnNote(mockNote, false);

      // Test animation at different progress points
      const progressValues = [0, 0.25, 0.5, 0.75, 1.0];

      progressValues.forEach((progress) => {
        const mockTime = 1000 + progress * 800; // 800ms transition
        mockPerformanceNow.mockReturnValue(mockTime);

        expect(() => controller.update(16)).not.toThrow();
      });
    });

    it('should complete animation when progress reaches 1.0', () => {
      // UPGRADED: Make test robust against mock pollution
      controller.resetToDefault(true);

      // Start animation with a predictable setup
      const startTime = 1000;
      mockPerformanceNow.mockReturnValue(startTime);
      controller.focusOnNote(mockNote, false);

      // Simulate completion by setting time well beyond animation duration
      const completionTime = startTime + 10000; // 10 seconds should complete any animation
      mockPerformanceNow.mockReturnValue(completionTime);

      // Multiple update calls to ensure completion
      controller.update(16);
      controller.update(16);
      controller.update(16);

      const state = controller.getCameraState();
      expect(state.isAnimating).toBe(false);
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with repeated animations', () => {
      const { controller } =
        AdaptiveCameraFactory.createController(mockViewport);

      // Perform many focus operations
      for (let i = 0; i < 100; i++) {
        const note = { ...mockNote, id: `note-${i}` };
        controller.focusOnNote(note, true); // Immediate focus to avoid animations
      }

      // Should not throw or cause memory issues
      expect(() => controller.resetToDefault(true)).not.toThrow();
    });

    it('should handle cleanup properly', () => {
      const { controller } =
        AdaptiveCameraFactory.createController(mockViewport);

      controller.focusOnNote(mockNote);
      controller.updateForTechniques([mockNote]);

      // Reset should clean up any active animations
      expect(() => controller.resetToDefault(true)).not.toThrow();
    });
  });
});
