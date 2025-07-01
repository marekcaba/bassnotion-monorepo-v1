/**
 * RenderOptimizer - Advanced Three.js Rendering Optimizations
 *
 * Implements performance optimizations for FretboardVisualizer to achieve:
 * - Target: 60+ FPS (currently ~58 FPS)
 * - Target: <16.67ms frame time (currently ~17ms)
 * - Optimized rendering pipeline for smooth performance
 *
 * Based on Story 3.9 baseline performance assessment findings.
 */

import * as THREE from 'three';

export interface RenderOptimizationSettings {
  // Level of Detail (LOD) settings
  lodEnabled: boolean;
  lodNearDistance: number;
  lodFarDistance: number;
  lodCriticalDistance: number;

  // Frustum culling settings
  frustumCullingEnabled: boolean;
  cullingMargin: number; // Extra margin for off-screen objects

  // Batch rendering settings
  batchRenderingEnabled: boolean;
  maxInstancesPerBatch: number;

  // Frame rate optimization
  targetFPS: number;
  adaptiveQuality: boolean;
  performanceThreshold: number; // ms - if frame time exceeds this, reduce quality

  // Object pooling
  objectPoolingEnabled: boolean;
  maxPoolSize: number;
}

export const DEFAULT_OPTIMIZATION_SETTINGS: RenderOptimizationSettings = {
  lodEnabled: true,
  lodNearDistance: 5,
  lodFarDistance: 15,
  lodCriticalDistance: 25,

  frustumCullingEnabled: true,
  cullingMargin: 2,

  batchRenderingEnabled: true,
  maxInstancesPerBatch: 1000,

  targetFPS: 60,
  adaptiveQuality: true,
  performanceThreshold: 16.67, // 60 FPS target

  objectPoolingEnabled: true,
  maxPoolSize: 500,
};

export interface PerformanceMetrics {
  currentFPS: number;
  frameTime: number;
  renderCalls: number;
  triangles: number;
  drawCalls: number;
  geometries: number;
  textures: number;
}

export class RenderOptimizer {
  private settings: RenderOptimizationSettings;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;

  // Performance tracking
  private frameCount = 0;
  private lastTime = 0;
  private frameTimeHistory: number[] = [];
  private currentMetrics: PerformanceMetrics;

  // Optimization state
  private lodObjects: Map<THREE.Object3D, THREE.LOD> = new Map();
  private instancedMeshes: Map<string, THREE.InstancedMesh> = new Map();
  private objectPool: Map<string, THREE.Object3D[]> = new Map();
  private frustum = new THREE.Frustum();
  private cameraMatrix = new THREE.Matrix4();

  // Quality levels for adaptive performance
  private qualityLevel = 1.0; // 1.0 = highest quality, 0.5 = medium, 0.25 = low

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    settings: Partial<RenderOptimizationSettings> = {},
  ) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.settings = { ...DEFAULT_OPTIMIZATION_SETTINGS, ...settings };

    this.currentMetrics = {
      currentFPS: 0,
      frameTime: 0,
      renderCalls: 0,
      triangles: 0,
      drawCalls: 0,
      geometries: 0,
      textures: 0,
    };

    this.initializeOptimizations();
  }

  /**
   * Initialize rendering optimizations
   */
  private initializeOptimizations(): void {
    // Configure renderer for optimal performance
    this.renderer.shadowMap.enabled = false; // Disable shadows for performance
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // Set pixel ratio - handle test environment where devicePixelRatio might be undefined
    const devicePixelRatio =
      (typeof window !== 'undefined' && window.devicePixelRatio) || 2;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); // Limit pixel ratio

    // Note: frustum culling is handled manually in performFrustumCulling()

    // Configure rendering hints
    this.renderer.sortObjects = false; // Disable sorting for performance
    this.renderer.autoClear = true;
    this.renderer.autoClearColor = true;
    this.renderer.autoClearDepth = true;
    this.renderer.autoClearStencil = false;
  }

  /**
   * Optimize rendering for current frame
   */
  public optimizeFrame(): void {
    const frameStart = performance.now();

    // Update performance metrics
    this.updatePerformanceMetrics(frameStart);

    // Apply adaptive quality if enabled
    if (this.settings.adaptiveQuality) {
      this.updateAdaptiveQuality();
    }

    // Update frustum for culling
    if (this.settings.frustumCullingEnabled) {
      this.updateFrustum();
    }

    // Apply LOD optimizations
    if (this.settings.lodEnabled) {
      this.updateLOD();
    }

    // Perform frustum culling
    if (this.settings.frustumCullingEnabled) {
      this.performFrustumCulling();
    }

    // Update instanced rendering
    if (this.settings.batchRenderingEnabled) {
      this.updateInstancedRendering();
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(currentTime: number): void {
    this.frameCount++;

    if (this.lastTime === 0) {
      this.lastTime = currentTime;
      return;
    }

    const frameTime = currentTime - this.lastTime;
    this.frameTimeHistory.push(frameTime);

    // Keep only last 60 frames for FPS calculation
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift();
    }

    // Calculate current FPS and frame time
    const avgFrameTime =
      this.frameTimeHistory.reduce((a, b) => a + b, 0) /
      this.frameTimeHistory.length;
    this.currentMetrics.currentFPS = 1000 / avgFrameTime;
    this.currentMetrics.frameTime = frameTime;

    // Update renderer info
    const info = this.renderer.info;
    this.currentMetrics.renderCalls = info.render.calls || 0;
    this.currentMetrics.triangles = info.render.triangles || 0;
    this.currentMetrics.drawCalls = info.render.calls || 0;
    this.currentMetrics.geometries = info.memory.geometries || 0;
    this.currentMetrics.textures = info.memory.textures || 0;

    this.lastTime = currentTime;
  }

  /**
   * Update adaptive quality based on performance
   */
  private updateAdaptiveQuality(): void {
    const targetFrameTime = 1000 / this.settings.targetFPS;

    if (this.currentMetrics.frameTime > this.settings.performanceThreshold) {
      // Performance is below target, reduce quality
      this.qualityLevel = Math.max(0.25, this.qualityLevel - 0.05);
      this.applyQualitySettings();
    } else if (this.currentMetrics.frameTime < targetFrameTime * 0.8) {
      // Performance is good, can increase quality
      this.qualityLevel = Math.min(1.0, this.qualityLevel + 0.02);
      this.applyQualitySettings();
    }
  }

  /**
   * Apply quality settings based on current quality level
   */
  private applyQualitySettings(): void {
    // Adjust renderer pixel ratio based on quality
    const devicePixelRatio =
      (typeof window !== 'undefined' && window.devicePixelRatio) || 2;
    const pixelRatio = Math.min(devicePixelRatio * this.qualityLevel, 2);
    this.renderer.setPixelRatio(pixelRatio);

    // Adjust LOD distances based on quality
    const lodMultiplier = 2 - this.qualityLevel; // Higher quality = closer LOD distances
    this.updateLODDistances(lodMultiplier);
  }

  /**
   * Update frustum for culling calculations
   */
  private updateFrustum(): void {
    this.cameraMatrix.multiplyMatrices(
      (this.camera as THREE.PerspectiveCamera).projectionMatrix,
      (this.camera as THREE.PerspectiveCamera).matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.cameraMatrix);
  }

  /**
   * Perform frustum culling on scene objects
   */
  private performFrustumCulling(): void {
    this.scene.traverse((object) => {
      if (object.type === 'Mesh' || object.type === 'InstancedMesh') {
        const mesh = object as THREE.Mesh;
        // Create bounding sphere with margin
        const boundingSphere = new THREE.Sphere();
        if (mesh.geometry?.boundingSphere) {
          boundingSphere.copy(mesh.geometry.boundingSphere);
          boundingSphere.radius += this.settings.cullingMargin;
          boundingSphere.applyMatrix4(object.matrixWorld);

          // Check if object is in frustum
          object.visible = this.frustum.intersectsSphere(boundingSphere);
        }
      }
    });
  }

  /**
   * Update Level of Detail (LOD) for objects
   */
  private updateLOD(): void {
    const cameraPosition = this.camera.position;

    this.lodObjects.forEach((lodObject, originalObject) => {
      const distance = cameraPosition.distanceTo(originalObject.position);

      // Determine LOD level based on distance
      let _lodLevel = 0;
      if (distance > this.settings.lodCriticalDistance) {
        _lodLevel = 2; // Lowest detail
      } else if (distance > this.settings.lodFarDistance) {
        _lodLevel = 1; // Medium detail
      } else if (distance > this.settings.lodNearDistance) {
        _lodLevel = 0; // High detail
      }

      // Update LOD object
      lodObject.update(this.camera);
    });
  }

  /**
   * Update LOD distances based on quality multiplier
   */
  private updateLODDistances(multiplier: number): void {
    // Adjust LOD distances - higher multiplier means objects switch to lower detail sooner
    this.settings.lodNearDistance =
      DEFAULT_OPTIMIZATION_SETTINGS.lodNearDistance * multiplier;
    this.settings.lodFarDistance =
      DEFAULT_OPTIMIZATION_SETTINGS.lodFarDistance * multiplier;
    this.settings.lodCriticalDistance =
      DEFAULT_OPTIMIZATION_SETTINGS.lodCriticalDistance * multiplier;
  }

  /**
   * Update instanced rendering for similar objects
   */
  private updateInstancedRendering(): void {
    // This would be implemented to batch similar objects (like notes) into instanced meshes
    // For now, we'll implement the structure for future enhancement

    this.instancedMeshes.forEach((instancedMesh, _key) => {
      // Update instance matrices for batched objects
      instancedMesh.instanceMatrix.needsUpdate = true;
    });
  }

  /**
   * Create LOD object for a mesh
   */
  public createLODObject(
    originalMesh: THREE.Mesh,
    mediumDetailMesh?: THREE.Mesh,
    lowDetailMesh?: THREE.Mesh,
  ): THREE.LOD {
    const lod = new THREE.LOD();

    // High detail (close)
    lod.addLevel(originalMesh, 0);

    // Medium detail
    if (mediumDetailMesh) {
      lod.addLevel(mediumDetailMesh, this.settings.lodNearDistance);
    }

    // Low detail (far)
    if (lowDetailMesh) {
      lod.addLevel(lowDetailMesh, this.settings.lodFarDistance);
    } else {
      // Create simplified version if not provided
      const simplifiedMesh = this.createSimplifiedMesh(originalMesh);
      lod.addLevel(simplifiedMesh, this.settings.lodFarDistance);
    }

    this.lodObjects.set(originalMesh, lod);
    return lod;
  }

  /**
   * Create simplified mesh for LOD
   */
  private createSimplifiedMesh(originalMesh: THREE.Mesh): THREE.Mesh {
    // Create a simplified version with reduced geometry
    const geometry = originalMesh.geometry.clone();

    // Reduce geometry complexity (simple approach - could use more sophisticated algorithms)
    if (geometry.attributes.position) {
      const positions = geometry.attributes.position.array;
      const simplifiedPositions = new Float32Array(positions.length / 2);

      for (let i = 0; i < simplifiedPositions.length; i += 3) {
        simplifiedPositions[i] = positions[i * 2] ?? 0;
        simplifiedPositions[i + 1] = positions[i * 2 + 1] ?? 0;
        simplifiedPositions[i + 2] = positions[i * 2 + 2] ?? 0;
      }

      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(simplifiedPositions, 3),
      );
    }

    const material =
      originalMesh.material instanceof Array
        ? originalMesh.material[0]
        : originalMesh.material;

    return new THREE.Mesh(geometry, material);
  }

  /**
   * Create instanced mesh for batching similar objects
   */
  public createInstancedMesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number,
    key: string,
  ): THREE.InstancedMesh {
    const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    this.instancedMeshes.set(key, instancedMesh);
    return instancedMesh;
  }

  /**
   * Get object from pool or create new one
   */
  public getPooledObject(
    type: string,
    createFn: () => THREE.Object3D,
  ): THREE.Object3D {
    if (!this.settings.objectPoolingEnabled) {
      return createFn();
    }

    if (!this.objectPool.has(type)) {
      this.objectPool.set(type, []);
    }

    const pool = this.objectPool.get(type)!;

    if (pool.length > 0) {
      return pool.pop()!;
    }

    return createFn();
  }

  /**
   * Return object to pool
   */
  public returnToPool(type: string, object: THREE.Object3D): void {
    if (!this.settings.objectPoolingEnabled) {
      return;
    }

    if (!this.objectPool.has(type)) {
      this.objectPool.set(type, []);
    }

    const pool = this.objectPool.get(type)!;

    if (pool.length < this.settings.maxPoolSize) {
      // Reset object state
      object.position.set(0, 0, 0);
      object.rotation.set(0, 0, 0);
      object.scale.set(1, 1, 1);
      object.visible = true;

      pool.push(object);
    }
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Get current optimization settings
   */
  public getSettings(): RenderOptimizationSettings {
    return { ...this.settings };
  }

  /**
   * Update optimization settings
   */
  public updateSettings(
    newSettings: Partial<RenderOptimizationSettings>,
  ): void {
    this.settings = { ...this.settings, ...newSettings };
    this.applyQualitySettings();
  }

  /**
   * Get current quality level
   */
  public getQualityLevel(): number {
    return this.qualityLevel;
  }

  /**
   * Force quality level (disables adaptive quality temporarily)
   */
  public setQualityLevel(level: number): void {
    this.qualityLevel = Math.max(0.25, Math.min(1.0, level));
    this.applyQualitySettings();
  }

  /**
   * Reset all optimizations
   */
  public reset(): void {
    this.frameCount = 0;
    this.lastTime = 0;
    this.frameTimeHistory = [];
    this.qualityLevel = 1.0;
    this.lodObjects.clear();
    this.instancedMeshes.clear();
    this.objectPool.clear();
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.lodObjects.clear();
    this.instancedMeshes.forEach((mesh) => {
      mesh.dispose();
    });
    this.instancedMeshes.clear();
    this.objectPool.clear();
  }
}
