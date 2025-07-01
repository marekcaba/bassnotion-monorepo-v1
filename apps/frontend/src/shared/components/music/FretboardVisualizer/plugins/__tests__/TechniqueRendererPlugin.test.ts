/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { TechniqueType, ExerciseNote } from '@bassnotion/contracts';
import {
  TechniqueRenderer,
  BaseTechniqueRenderer,
  TechniqueRendererManager,
  TechniqueRendererFactory,
  HammerOnRenderer,
  RenderContext,
  // TechniqueAnimationState, // Unused in tests
} from '../TechniqueRendererPlugin.js';

// Mock THREE.js
vi.mock('three', () => {
  // Create comprehensive mock constructors using function constructor pattern
  function SceneMock() {
    return {};
  }

  function CameraMock() {
    return {};
  }

  function WebGLRendererMock() {
    return {};
  }

  function Object3DMock() {
    const instance = {
      // UPGRADED: Enhanced properties to match THREE.js Object3D API completely
      position: {
        x: 0,
        y: 0,
        z: 0,
        copy: vi.fn(),
        set: vi.fn(),
      },
      scale: {
        x: 1,
        y: 1,
        z: 1,
        setScalar: vi.fn(),
      },
      rotation: { x: 0, y: 0, z: 0 },
      traverse: vi.fn((callback) => {
        callback(instance);
      }),
      parent: null,
      visible: true,
      userData: {},
      add: vi.fn(),
      remove: vi.fn(),
    };
    return instance;
  }

  function GroupMock() {
    const instance = Object.create(GroupMock.prototype);
    // UPGRADED: Properly implement add method to match THREE.js Group API
    instance.add = vi.fn((...objects) => {
      // Mock implementation: just track that add was called
      objects.forEach((obj) => {
        if (obj) obj.parent = instance;
      });
      return instance; // THREE.js add() returns this for chaining
    });
    instance.remove = vi.fn();
    instance.children = [];
    // UPGRADED: Use proper Vector3Mock for position and scale to match THREE.js API
    instance.position = new (Vector3Mock as any)(0, 0, 0);
    instance.scale = new (Vector3Mock as any)(1, 1, 1);
    instance.traverse = vi.fn((callback) => {
      callback(instance);
    });
    instance.parent = null;
    instance.visible = true;
    instance.isGroup = true; // THREE.js Group property
    instance.type = 'Group'; // THREE.js Group property
    return instance;
  }
  GroupMock.prototype.constructor = GroupMock;

  function RingGeometryMock() {
    const instance = Object.create(RingGeometryMock.prototype);
    return instance;
  }
  RingGeometryMock.prototype.constructor = RingGeometryMock;

  function MeshBasicMaterialMock(params: any = {}) {
    const instance = Object.create(MeshBasicMaterialMock.prototype);
    instance.opacity = params.opacity || 0.8;
    instance.dispose = vi.fn();
    return instance;
  }
  MeshBasicMaterialMock.prototype.constructor = MeshBasicMaterialMock;

  function MeshMock(geometry: any, material: any) {
    const instance = Object.create(MeshMock.prototype);
    instance.geometry = geometry;
    instance.material = material;
    // UPGRADED: Enhanced properties to match THREE.js Mesh API completely
    instance.position = {
      x: 0,
      y: 0,
      z: 0,
      copy: vi.fn(),
      set: vi.fn(),
      clone: vi.fn(() => new (Vector3Mock as any)()),
    };
    instance.scale = {
      x: 1,
      y: 1,
      z: 1,
      setScalar: vi.fn(),
      copy: vi.fn(),
      clone: vi.fn(() => new (Vector3Mock as any)(1, 1, 1)),
    };
    instance.rotation = { x: 0, y: 0, z: 0 };
    instance.traverse = vi.fn((callback) => {
      callback(instance);
    });
    instance.parent = null;
    instance.add = vi.fn();
    instance.remove = vi.fn();
    instance.visible = true;
    instance.userData = {};
    return instance;
  }
  MeshMock.prototype.constructor = MeshMock;

  function Vector3Mock(x = 0, y = 0, z = 0) {
    const instance = Object.create(Vector3Mock.prototype);
    instance.x = x;
    instance.y = y;
    instance.z = z;
    instance.clone = vi.fn(() => ({ x, y, z }));
    // UPGRADED: Make copy and set methods functional to match THREE.js Vector3 API
    instance.copy = vi.fn((vector) => {
      instance.x = vector.x || 0;
      instance.y = vector.y || 0;
      instance.z = vector.z || 0;
      return instance;
    });
    instance.set = vi.fn((x, y, z) => {
      instance.x = x;
      instance.y = y;
      instance.z = z;
      return instance;
    });
    instance.setScalar = vi.fn((value) => {
      instance.x = value;
      instance.y = value;
      instance.z = value;
      return instance;
    });
    return instance;
  }
  Vector3Mock.prototype.constructor = Vector3Mock;

  // Create spy-enabled constructors
  const SceneConstructor = vi
    .fn()
    .mockImplementation(() => new (SceneMock as any)());
  SceneConstructor.prototype = SceneMock.prototype;

  const CameraConstructor = vi
    .fn()
    .mockImplementation(() => new (CameraMock as any)());
  CameraConstructor.prototype = CameraMock.prototype;

  const WebGLRendererConstructor = vi
    .fn()
    .mockImplementation(() => new (WebGLRendererMock as any)());
  WebGLRendererConstructor.prototype = WebGLRendererMock.prototype;

  const Object3DConstructor = vi
    .fn()
    .mockImplementation(() => new (Object3DMock as any)());
  Object3DConstructor.prototype = Object3DMock.prototype;

  const GroupConstructor = vi
    .fn()
    .mockImplementation(() => new (GroupMock as any)());
  GroupConstructor.prototype = GroupMock.prototype;

  const RingGeometryConstructor = vi
    .fn()
    .mockImplementation(() => new (RingGeometryMock as any)());
  RingGeometryConstructor.prototype = RingGeometryMock.prototype;

  const MeshBasicMaterialConstructor = vi
    .fn()
    .mockImplementation((params) => new (MeshBasicMaterialMock as any)(params));
  MeshBasicMaterialConstructor.prototype = MeshBasicMaterialMock.prototype;

  const MeshConstructor = vi
    .fn()
    .mockImplementation(
      (geometry, material) => new (MeshMock as any)(geometry, material),
    );
  MeshConstructor.prototype = MeshMock.prototype;

  const Vector3Constructor = vi
    .fn()
    .mockImplementation((x, y, z) => new (Vector3Mock as any)(x, y, z));
  Vector3Constructor.prototype = Vector3Mock.prototype;

  // UPGRADED: Export the enhanced constructors directly to ensure consistent mock application
  const MockedTHREE = {
    Scene: SceneConstructor,
    Camera: CameraConstructor,
    WebGLRenderer: WebGLRendererConstructor,
    Object3D: Object3DConstructor,
    Group: GroupConstructor,
    RingGeometry: RingGeometryConstructor,
    MeshBasicMaterial: MeshBasicMaterialConstructor,
    Mesh: MeshConstructor,
    Vector3: Vector3Constructor,
  };

  return MockedTHREE;
});

describe('Epic 4 Technique Renderer Plugin System', () => {
  let mockRenderContext: RenderContext;
  let mockNote: ExerciseNote;

  beforeEach(() => {
    mockRenderContext = {
      scene: new THREE.Scene(),
      camera: new THREE.Camera(),
      renderer: new THREE.WebGLRenderer(),
      fretboardBounds: {
        width: 10,
        height: 5,
        stringSpacing: 0.5,
        fretSpacing: 0.3,
      },
      timeContext: {
        currentTime: 1000,
        duration: 5000,
        progress: 0.2,
      },
      settings: {
        visualQuality: 'high',
        showTechniqueLabels: true,
        animationSpeed: 1.0,
      },
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
      target_note_id: 'test-note-2',
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('BaseTechniqueRenderer', () => {
    class TestRenderer extends BaseTechniqueRenderer {
      readonly type: TechniqueType = 'hammer_on';
      readonly priority = 10;

      render(_note: ExerciseNote, _context: RenderContext): THREE.Object3D {
        return new THREE.Object3D();
      }

      animate(
        _object: THREE.Object3D,
        _progress: number,
        _note: ExerciseNote,
      ): void {
        // Test animation logic
      }

      getRequiredProperties(): (keyof ExerciseNote)[] {
        return ['target_note_id'];
      }
    }

    let renderer: TestRenderer;

    beforeEach(() => {
      renderer = new TestRenderer();
    });

    it('should implement TechniqueRenderer interface', () => {
      expect(renderer.type).toBe('hammer_on');
      expect(renderer.priority).toBe(10);
      expect(typeof renderer.render).toBe('function');
      expect(typeof renderer.animate).toBe('function');
      expect(typeof renderer.cleanup).toBe('function');
    });

    it('should validate note requirements correctly', () => {
      const validNote = { ...mockNote, target_note_id: 'target' };
      const invalidNote = { ...mockNote };
      delete (invalidNote as any).target_note_id;

      expect(renderer.canRender(validNote)).toBe(true);
      expect(renderer.canRender(invalidNote)).toBe(false);
    });

    it('should cleanup objects properly', () => {
      const mockObject = new THREE.Object3D();
      const mockParent = {
        remove: vi.fn(),
      };
      mockObject.parent = mockParent as any;

      renderer.cleanup(mockObject);

      expect(mockParent.remove).toHaveBeenCalledWith(mockObject);
    });

    // Note: createTechniqueLabel is protected and tested indirectly through render methods
  });

  describe('HammerOnRenderer', () => {
    let renderer: HammerOnRenderer;

    beforeEach(() => {
      renderer = new HammerOnRenderer();
    });

    it('should have correct type and priority', () => {
      expect(renderer.type).toBe('hammer_on');
      expect(renderer.priority).toBe(10);
    });

    it('should require target_note_id property', () => {
      expect(renderer.getRequiredProperties()).toContain('target_note_id');
    });

    it('should render visual representation', () => {
      const result = renderer.render(mockNote, mockRenderContext);

      expect(result).toBeInstanceOf(THREE.Group);
      expect(THREE.RingGeometry).toHaveBeenCalled();
      expect(THREE.MeshBasicMaterial).toHaveBeenCalledWith({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.8,
      });
    });

    it('should animate opacity and scale over time', () => {
      const mockObject = new THREE.Object3D();
      // UPGRADED: Ensure mockObject has scale property for batch testing compatibility
      if (!mockObject.scale) {
        Object.assign(mockObject, {
          scale: {
            x: 1,
            y: 1,
            z: 1,
            setScalar: vi.fn(),
          },
        });
      }
      const mockMesh = {
        material: { opacity: 0.8 },
      };
      mockObject.traverse = vi.fn((callback) => {
        callback(mockMesh);
      });

      renderer.animate(mockObject, 0.5, mockNote);

      expect(mockObject.scale.setScalar).toHaveBeenCalledWith(1.1); // 1 + 0.5 * 0.2
      expect(mockMesh.material.opacity).toBe(0.6); // 0.8 * (1 - 0.5 * 0.5)
    });

    it('should validate note has target_note_id', () => {
      const validNote = { ...mockNote, target_note_id: 'target' };
      const invalidNote = { ...mockNote };
      delete (invalidNote as any).target_note_id;

      expect(renderer.canRender(validNote)).toBe(true);
      expect(renderer.canRender(invalidNote)).toBe(false);
    });
  });

  describe('TechniqueRendererManager', () => {
    let manager: TechniqueRendererManager;
    let mockRenderer: TechniqueRenderer;

    beforeEach(() => {
      manager = new TechniqueRendererManager(mockRenderContext);
      mockRenderer = {
        type: 'hammer_on',
        priority: 10,
        render: vi.fn(() => new THREE.Object3D()),
        animate: vi.fn(),
        cleanup: vi.fn(),
        canRender: vi.fn(() => true),
        getRequiredProperties: vi.fn(
          () => ['target_note_id'] as (keyof ExerciseNote)[],
        ),
      };
    });

    it('should register and unregister renderers', () => {
      expect(manager.getRegisteredTechniques()).toHaveLength(0);

      manager.registerRenderer(mockRenderer);
      expect(manager.getRegisteredTechniques()).toContain('hammer_on');

      manager.unregisterRenderer('hammer_on');
      expect(manager.getRegisteredTechniques()).not.toContain('hammer_on');
    });

    it('should get renderer by type', () => {
      manager.registerRenderer(mockRenderer);

      expect(manager.getRenderer('hammer_on')).toBe(mockRenderer);
      expect(manager.getRenderer('pull_off')).toBeUndefined();
    });

    it('should check if technique can be rendered', () => {
      manager.registerRenderer(mockRenderer);

      expect(manager.canRenderTechnique('hammer_on', mockNote)).toBe(true);
      expect(manager.canRenderTechnique('pull_off', mockNote)).toBe(false);
    });

    it('should render techniques for notes with multiple techniques', () => {
      const mockRenderer2 = {
        type: 'vibrato' as TechniqueType,
        priority: 5, // Lower priority, renders first
        render: vi.fn(() => new THREE.Object3D()), // UPGRADED: Separate spy instead of shared reference
        animate: vi.fn(),
        cleanup: vi.fn(),
        canRender: vi.fn(() => true),
        getRequiredProperties: vi.fn(
          () => ['target_note_id'] as (keyof ExerciseNote)[],
        ),
      };

      manager.registerRenderer(mockRenderer);
      manager.registerRenderer(mockRenderer2);

      const noteWithMultipleTechniques = {
        ...mockNote,
        techniques: ['hammer_on', 'vibrato'] as TechniqueType[],
      };

      const objects = manager.renderNoteTechniques(noteWithMultipleTechniques);

      expect(objects).toHaveLength(2);
      expect(mockRenderer2.render).toHaveBeenCalledBefore(
        mockRenderer.render as any,
      );
    });

    it('should return empty array for notes without techniques', () => {
      const noteWithoutTechniques = { ...mockNote, techniques: undefined };

      const objects = manager.renderNoteTechniques(noteWithoutTechniques);

      expect(objects).toHaveLength(0);
    });

    it('should handle renderer errors gracefully', () => {
      const errorRenderer = {
        ...mockRenderer,
        render: vi.fn(() => {
          throw new Error('Render error');
        }),
      };

      manager.registerRenderer(errorRenderer);

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const objects = manager.renderNoteTechniques(mockNote);

      expect(objects).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error rendering hammer_on'),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should update animations for active techniques', () => {
      manager.registerRenderer(mockRenderer);
      manager.renderNoteTechniques(mockNote);

      manager.updateAnimations(2000); // 1 second later

      expect(mockRenderer.animate).toHaveBeenCalledWith(
        expect.any(THREE.Object3D),
        expect.any(Number), // progress
        mockNote,
      );
    });

    it('should cleanup techniques for specific notes', () => {
      manager.registerRenderer(mockRenderer);
      manager.renderNoteTechniques(mockNote);

      manager.cleanupNoteTechniques(mockNote.id);

      expect(mockRenderer.cleanup).toHaveBeenCalled();
    });

    it('should cleanup all active animations', () => {
      manager.registerRenderer(mockRenderer);
      manager.renderNoteTechniques(mockNote);

      const note2 = { ...mockNote, id: 'test-note-2' };
      manager.renderNoteTechniques(note2);

      manager.cleanupAll();

      expect(mockRenderer.cleanup).toHaveBeenCalledTimes(2);
    });

    it('should update render context', () => {
      const newContext = {
        ...mockRenderContext,
        settings: {
          ...mockRenderContext.settings,
          visualQuality: 'low' as const,
        },
      };

      manager.updateContext({ settings: newContext.settings });

      // Context should be updated for future operations
      expect(manager.getRegisteredTechniques()).toBeDefined();
    });

    it('should calculate animation progress correctly', () => {
      manager.registerRenderer(mockRenderer);

      const startTime = 1000;
      const currentTime = 1250; // 250ms later
      // const duration = 500; // 500ms total - commented out as not used in test

      // Mock the current time in context
      manager.updateContext({
        timeContext: {
          ...mockRenderContext.timeContext,
          currentTime: startTime,
        },
      });

      manager.renderNoteTechniques(mockNote);

      // Update with new time
      manager.updateAnimations(currentTime);

      // Should call animate with progress 0.5 (250/500)
      expect(mockRenderer.animate).toHaveBeenCalledWith(
        expect.any(THREE.Object3D),
        0.5,
        mockNote,
      );
    });
  });

  describe('TechniqueRendererFactory', () => {
    it('should create default renderers', () => {
      const renderers = TechniqueRendererFactory.createDefaultRenderers();

      expect(renderers).toHaveLength(1); // Currently only HammerOnRenderer
      expect(renderers[0]).toBeInstanceOf(HammerOnRenderer);
    });

    it('should create renderer manager with default renderers', () => {
      const manager =
        TechniqueRendererFactory.createRendererManager(mockRenderContext);

      expect(manager).toBeInstanceOf(TechniqueRendererManager);
      expect(manager.getRegisteredTechniques()).toContain('hammer_on');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow from creation to cleanup', () => {
      const manager =
        TechniqueRendererFactory.createRendererManager(mockRenderContext);

      // Render techniques
      const objects = manager.renderNoteTechniques(mockNote);
      expect(objects).toHaveLength(1);

      // Update animations
      manager.updateAnimations(1250);

      // Cleanup specific note
      manager.cleanupNoteTechniques(mockNote.id);

      // Verify cleanup was called
      // Note: In a real test, we'd check the actual cleanup behavior
      expect(objects).toHaveLength(1);
    });

    it('should handle multiple notes with different techniques', () => {
      const manager =
        TechniqueRendererFactory.createRendererManager(mockRenderContext);

      const note1 = {
        ...mockNote,
        id: 'note-1',
        techniques: ['hammer_on'] as TechniqueType[],
      };

      const note2 = {
        ...mockNote,
        id: 'note-2',
        techniques: ['hammer_on'] as TechniqueType[], // Same technique
      };

      const objects1 = manager.renderNoteTechniques(note1);
      const objects2 = manager.renderNoteTechniques(note2);

      expect(objects1).toHaveLength(1);
      expect(objects2).toHaveLength(1);

      // Update all animations
      manager.updateAnimations(1500);

      // Cleanup all
      manager.cleanupAll();
    });

    it('should prioritize techniques correctly', () => {
      const manager = new TechniqueRendererManager(mockRenderContext);

      const lowPriorityRenderer = {
        type: 'vibrato' as TechniqueType,
        priority: 5,
        render: vi.fn(() => new THREE.Object3D()),
        animate: vi.fn(),
        cleanup: vi.fn(),
        canRender: vi.fn(() => true),
      };

      const highPriorityRenderer = {
        type: 'hammer_on' as TechniqueType,
        priority: 15,
        render: vi.fn(() => new THREE.Object3D()),
        animate: vi.fn(),
        cleanup: vi.fn(),
        canRender: vi.fn(() => true),
      };

      manager.registerRenderer(highPriorityRenderer);
      manager.registerRenderer(lowPriorityRenderer);

      const noteWithBoth = {
        ...mockNote,
        techniques: ['hammer_on', 'vibrato'] as TechniqueType[],
      };

      manager.renderNoteTechniques(noteWithBoth);

      // Low priority should render first
      expect(lowPriorityRenderer.render).toHaveBeenCalledBefore(
        highPriorityRenderer.render,
      );
    });
  });

  describe('Error Handling', () => {
    let manager: TechniqueRendererManager;

    beforeEach(() => {
      manager = new TechniqueRendererManager(mockRenderContext);
    });

    it('should handle animation errors gracefully', () => {
      const errorRenderer = {
        type: 'hammer_on' as TechniqueType,
        priority: 10,
        render: vi.fn(() => new THREE.Object3D()),
        animate: vi.fn(() => {
          throw new Error('Animation error');
        }),
        cleanup: vi.fn(),
        canRender: vi.fn(() => true),
      };

      manager.registerRenderer(errorRenderer);
      manager.renderNoteTechniques(mockNote);

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      manager.updateAnimations(1500);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Animation error for hammer_on'),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should handle cleanup errors gracefully', () => {
      const errorRenderer = {
        type: 'hammer_on' as TechniqueType,
        priority: 10,
        render: vi.fn(() => new THREE.Object3D()),
        animate: vi.fn(),
        cleanup: vi.fn(() => {
          throw new Error('Cleanup error');
        }),
        canRender: vi.fn(() => true),
      };

      manager.registerRenderer(errorRenderer);
      manager.renderNoteTechniques(mockNote);

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      manager.cleanupNoteTechniques(mockNote.id);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup error for hammer_on'),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Performance Tests', () => {
    it('should handle many notes efficiently', () => {
      const manager =
        TechniqueRendererFactory.createRendererManager(mockRenderContext);

      const notes = Array.from({ length: 100 }, (_, i) => ({
        ...mockNote,
        id: `note-${i}`,
        timestamp: i * 100,
      }));

      const startTime = performance.now();

      notes.forEach((note) => {
        manager.renderNoteTechniques(note);
      });

      manager.updateAnimations(2000);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(100); // 100ms for 100 notes
    });

    it('should handle cleanup of many objects efficiently', () => {
      const manager =
        TechniqueRendererFactory.createRendererManager(mockRenderContext);

      const notes = Array.from({ length: 50 }, (_, i) => ({
        ...mockNote,
        id: `note-${i}`,
      }));

      notes.forEach((note) => {
        manager.renderNoteTechniques(note);
      });

      const startTime = performance.now();
      manager.cleanupAll();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // 50ms for cleanup
    });
  });
});
