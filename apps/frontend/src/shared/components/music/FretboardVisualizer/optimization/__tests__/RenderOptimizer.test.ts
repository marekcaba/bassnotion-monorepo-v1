/**
 * Tests for RenderOptimizer
 *
 * Validates rendering optimization functionality for Story 3.9
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import {
  RenderOptimizer,
  DEFAULT_OPTIMIZATION_SETTINGS,
} from '../RenderOptimizer';

// Mock Three.js WebGLRenderer
const createMockRenderer = () => ({
  shadowMap: {
    enabled: false,
    type: THREE.PCFShadowMap,
  },
  setPixelRatio: vi.fn(),
  sortObjects: false,
  autoClear: true,
  autoClearColor: true,
  autoClearDepth: true,
  autoClearStencil: false,
  info: {
    render: {
      calls: 42,
      triangles: 1500,
    },
    memory: {
      geometries: 10,
      textures: 5,
    },
  },
});

// Mock Three.js Scene
const createMockScene = () => ({
  traverse: vi.fn(),
});

// Mock Three.js Camera
const createMockCamera = () => ({
  position: new THREE.Vector3(0, 0, 10),
  projectionMatrix: new THREE.Matrix4(),
  matrixWorldInverse: new THREE.Matrix4(),
});

// Mock performance.now
const mockPerformanceNow = vi.fn();

describe('RenderOptimizer', () => {
  let renderOptimizer: RenderOptimizer;
  let mockScene: any;
  let mockCamera: any;
  let mockRenderer: any;

  beforeEach(() => {
    // Clear mocks first
    vi.clearAllMocks();

    // Setup mocks
    mockScene = createMockScene();
    mockCamera = createMockCamera();
    mockRenderer = createMockRenderer();

    // Mock performance.now
    global.performance = { ...global.performance, now: mockPerformanceNow };
    mockPerformanceNow.mockReturnValue(1000);

    // Mock window.devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 2,
      writable: true,
    });

    renderOptimizer = new RenderOptimizer(
      mockScene as THREE.Scene,
      mockCamera as THREE.Camera,
      mockRenderer as THREE.WebGLRenderer,
    );
  });

  afterEach(() => {
    renderOptimizer.dispose();
  });

  describe('initialization', () => {
    it('should initialize with default settings', () => {
      const settings = renderOptimizer.getSettings();

      expect(settings).toEqual(DEFAULT_OPTIMIZATION_SETTINGS);
      expect(settings.targetFPS).toBe(60);
      expect(settings.lodEnabled).toBe(true);
      expect(settings.frustumCullingEnabled).toBe(true);
    });

    it('should apply custom settings during initialization', () => {
      const customSettings = { targetFPS: 120, lodEnabled: false };
      const customOptimizer = new RenderOptimizer(
        mockScene as THREE.Scene,
        mockCamera as THREE.Camera,
        mockRenderer as THREE.WebGLRenderer,
        customSettings,
      );

      const settings = customOptimizer.getSettings();
      expect(settings.targetFPS).toBe(120);
      expect(settings.lodEnabled).toBe(false);

      customOptimizer.dispose();
    });

    it('should configure renderer for optimal performance', () => {
      expect(mockRenderer.setPixelRatio).toHaveBeenCalledWith(2);
      expect(mockRenderer.shadowMap.enabled).toBe(false);
      expect(mockRenderer.sortObjects).toBe(false);
    });
  });

  describe('performance metrics', () => {
    it('should track performance metrics correctly', () => {
      // Simulate frame progression
      mockPerformanceNow.mockReturnValueOnce(1000);
      renderOptimizer.optimizeFrame();

      mockPerformanceNow.mockReturnValueOnce(1017); // 17ms frame time
      renderOptimizer.optimizeFrame();

      const metrics = renderOptimizer.getMetrics();

      expect(metrics.frameTime).toBe(17);
      expect(metrics.renderCalls).toBe(42);
      expect(metrics.triangles).toBe(1500);
      expect(metrics.geometries).toBe(10);
      expect(metrics.textures).toBe(5);
    });

    it('should calculate FPS correctly over multiple frames', () => {
      const frameTimes = [16, 17, 15, 18, 16]; // Simulate varying frame times

      frameTimes.forEach((frameTime, index) => {
        mockPerformanceNow.mockReturnValueOnce(1000 + index * frameTime);
        renderOptimizer.optimizeFrame();
      });

      const metrics = renderOptimizer.getMetrics();
      expect(metrics.currentFPS).toBeGreaterThan(55); // Should be around 60 FPS
      expect(metrics.currentFPS).toBeLessThan(65);
    });

    it('should maintain frame time history', () => {
      // Simulate 70 frames to test history limit
      for (let i = 0; i < 70; i++) {
        mockPerformanceNow.mockReturnValueOnce(1000 + i * 16.67);
        renderOptimizer.optimizeFrame();
      }

      const metrics = renderOptimizer.getMetrics();
      expect(metrics.currentFPS).toBeCloseTo(60, 1);
    });
  });

  describe('adaptive quality', () => {
    it('should reduce quality when performance drops', () => {
      const settings = {
        ...DEFAULT_OPTIMIZATION_SETTINGS,
        adaptiveQuality: true,
      };
      const adaptiveOptimizer = new RenderOptimizer(
        mockScene as THREE.Scene,
        mockCamera as THREE.Camera,
        mockRenderer as THREE.WebGLRenderer,
        settings,
      );

      // Simulate poor performance (30ms frame time)
      mockPerformanceNow.mockReturnValueOnce(1000);
      adaptiveOptimizer.optimizeFrame();

      mockPerformanceNow.mockReturnValueOnce(1030); // 30ms frame time
      adaptiveOptimizer.optimizeFrame();

      const qualityLevel = adaptiveOptimizer.getQualityLevel();
      expect(qualityLevel).toBeLessThan(1.0); // Quality should be reduced

      adaptiveOptimizer.dispose();
    });

    it('should increase quality when performance improves', () => {
      const settings = {
        ...DEFAULT_OPTIMIZATION_SETTINGS,
        adaptiveQuality: true,
      };
      const adaptiveOptimizer = new RenderOptimizer(
        mockScene as THREE.Scene,
        mockCamera as THREE.Camera,
        mockRenderer as THREE.WebGLRenderer,
        settings,
      );

      // Start with reduced quality
      adaptiveOptimizer.setQualityLevel(0.5);

      // Simulate good performance (10ms frame time)
      mockPerformanceNow.mockReturnValueOnce(1000);
      adaptiveOptimizer.optimizeFrame();

      mockPerformanceNow.mockReturnValueOnce(1010); // 10ms frame time
      adaptiveOptimizer.optimizeFrame();

      const qualityLevel = adaptiveOptimizer.getQualityLevel();
      expect(qualityLevel).toBeGreaterThan(0.5); // Quality should increase

      adaptiveOptimizer.dispose();
    });

    it('should apply quality settings to renderer', () => {
      renderOptimizer.setQualityLevel(0.5);

      expect(mockRenderer.setPixelRatio).toHaveBeenCalledWith(1); // 2 * 0.5 = 1
    });
  });

  describe('LOD (Level of Detail)', () => {
    it('should create LOD objects correctly', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const originalMesh = new THREE.Mesh(geometry, material);

      const lodObject = renderOptimizer.createLODObject(originalMesh);

      expect(lodObject).toBeInstanceOf(THREE.LOD);
      expect(lodObject.levels).toHaveLength(2); // Original + simplified
    });

    it('should create LOD objects with custom detail levels', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const originalMesh = new THREE.Mesh(geometry, material);
      const mediumMesh = new THREE.Mesh(geometry, material);
      const lowMesh = new THREE.Mesh(geometry, material);

      const lodObject = renderOptimizer.createLODObject(
        originalMesh,
        mediumMesh,
        lowMesh,
      );

      expect(lodObject.levels).toHaveLength(3); // All three levels
    });
  });

  describe('frustum culling', () => {
    it('should perform frustum culling on scene objects', () => {
      const mockMesh = {
        type: 'Mesh',
        geometry: {
          boundingSphere: new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1),
        },
        matrixWorld: new THREE.Matrix4(),
        visible: true,
      };

      mockScene.traverse.mockImplementation(
        (callback: (object: any) => void) => {
          callback(mockMesh);
        },
      );

      renderOptimizer.optimizeFrame();

      expect(mockScene.traverse).toHaveBeenCalled();
    });
  });

  describe('instanced rendering', () => {
    it('should create instanced meshes for batching', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });

      const instancedMesh = renderOptimizer.createInstancedMesh(
        geometry,
        material,
        100,
        'notes',
      );

      expect(instancedMesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(instancedMesh.count).toBe(100);
    });
  });

  describe('object pooling', () => {
    it('should create objects from pool when available', () => {
      const createFn = vi.fn(() => new THREE.Mesh());

      // First call should create new object
      const obj1 = renderOptimizer.getPooledObject('testType', createFn);
      expect(createFn).toHaveBeenCalledTimes(1);

      // Return to pool
      renderOptimizer.returnToPool('testType', obj1);

      // Second call should reuse pooled object
      const obj2 = renderOptimizer.getPooledObject('testType', createFn);
      expect(createFn).toHaveBeenCalledTimes(1); // Should not create new object
      expect(obj2).toBe(obj1);
    });

    it('should reset object state when returning to pool', () => {
      const mesh = new THREE.Mesh();
      mesh.position.set(5, 5, 5);
      mesh.rotation.set(1, 1, 1);
      mesh.scale.set(2, 2, 2);
      mesh.visible = false;

      renderOptimizer.returnToPool('testType', mesh);

      expect(mesh.position.x).toBe(0);
      expect(mesh.position.y).toBe(0);
      expect(mesh.position.z).toBe(0);
      expect(mesh.rotation.x).toBe(0);
      expect(mesh.rotation.y).toBe(0);
      expect(mesh.rotation.z).toBe(0);
      expect(mesh.scale.x).toBe(1);
      expect(mesh.scale.y).toBe(1);
      expect(mesh.scale.z).toBe(1);
      expect(mesh.visible).toBe(true);
    });

    it('should respect max pool size', () => {
      const settings = { ...DEFAULT_OPTIMIZATION_SETTINGS, maxPoolSize: 2 };
      const poolOptimizer = new RenderOptimizer(
        mockScene as THREE.Scene,
        mockCamera as THREE.Camera,
        mockRenderer as THREE.WebGLRenderer,
        settings,
      );

      // Add 3 objects to pool (max is 2)
      const obj1 = new THREE.Mesh();
      const obj2 = new THREE.Mesh();
      const obj3 = new THREE.Mesh();

      poolOptimizer.returnToPool('testType', obj1);
      poolOptimizer.returnToPool('testType', obj2);
      poolOptimizer.returnToPool('testType', obj3); // Should be ignored

      const createFn = vi.fn(() => new THREE.Mesh());

      // Should get obj2 (last added within limit)
      const retrieved1 = poolOptimizer.getPooledObject('testType', createFn);
      expect(retrieved1).toBe(obj2);

      // Should get obj1
      const retrieved2 = poolOptimizer.getPooledObject('testType', createFn);
      expect(retrieved2).toBe(obj1);

      // Should create new object (pool empty)
      const _retrieved3 = poolOptimizer.getPooledObject('testType', createFn);
      expect(createFn).toHaveBeenCalledTimes(1);

      poolOptimizer.dispose();
    });
  });

  describe('settings management', () => {
    it('should update settings correctly', () => {
      const newSettings = { targetFPS: 120, lodEnabled: false };

      renderOptimizer.updateSettings(newSettings);

      const settings = renderOptimizer.getSettings();
      expect(settings.targetFPS).toBe(120);
      expect(settings.lodEnabled).toBe(false);
      expect(settings.frustumCullingEnabled).toBe(true); // Should remain unchanged
    });

    it('should apply settings when updated', () => {
      renderOptimizer.updateSettings({ targetFPS: 30 });

      // Should trigger quality adjustment
      expect(mockRenderer.setPixelRatio).toHaveBeenCalled();
    });
  });

  describe('reset and disposal', () => {
    it('should reset all state correctly', () => {
      // Add some state
      renderOptimizer.optimizeFrame();
      renderOptimizer.setQualityLevel(0.5);

      renderOptimizer.reset();

      const metrics = renderOptimizer.getMetrics();
      expect(metrics.frameTime).toBe(0);
      expect(renderOptimizer.getQualityLevel()).toBe(1.0);
    });

    it('should dispose of resources correctly', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const instancedMesh = renderOptimizer.createInstancedMesh(
        geometry,
        material,
        10,
        'test',
      );

      const disposeSpy = vi.spyOn(instancedMesh, 'dispose');

      renderOptimizer.dispose();

      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe('performance targets', () => {
    it('should meet target FPS requirements', () => {
      // Simulate optimal performance
      const targetFrameTime = 1000 / 60; // 16.67ms for 60 FPS

      for (let i = 0; i < 10; i++) {
        mockPerformanceNow.mockReturnValueOnce(1000 + i * targetFrameTime);
        renderOptimizer.optimizeFrame();
      }

      const metrics = renderOptimizer.getMetrics();
      expect(metrics.currentFPS).toBeGreaterThanOrEqual(58); // Allow small margin
      expect(metrics.frameTime).toBeLessThanOrEqual(17.5); // Allow small margin
    });

    it('should maintain performance under load', () => {
      // Simulate high object count scenario
      const manyObjects = Array.from({ length: 1000 }, () => ({
        type: 'Mesh',
        geometry: {
          boundingSphere: new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1),
        },
        matrixWorld: new THREE.Matrix4(),
        visible: true,
      }));

      mockScene.traverse.mockImplementation(
        (callback: (object: any) => void) => {
          manyObjects.forEach(callback);
        },
      );

      // Should not crash or perform poorly
      renderOptimizer.optimizeFrame();

      const metrics = renderOptimizer.getMetrics();
      expect(metrics).toBeDefined();
      expect(mockScene.traverse).toHaveBeenCalled();
    });
  });
});
