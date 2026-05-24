'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Decoupled, marketing-only render of the production fretboard from
 * domains/playback/components/FretboardVisualizer/components/Fretboard3D.tsx
 *
 * Replicates the production visual spec (same dot grid, same flat circles on
 * the fretboard plane, same perspective scaling per string row, same flat
 * ambient lighting, same dark slate background) but with zero coupling to
 * exercise types, audio context, or react-three-fiber/drei.
 *
 * Plain Three.js. Loaded via next/dynamic on marketing surfaces so the
 * landing-page HTML stays light. When the user lands in /app later, the
 * Three.js chunk is already warm-cached.
 *
 * Animation:
 *  - Slow camera orbit around the fretboard center (~12s loop).
 *  - Walking-bass pattern of teal note dots every ~500ms.
 */

type Props = {
  ariaLabel?: string;
};

// Match production constants exactly.
const STRINGS = 4;
const FRETS = 13;
const STRING_SPACING = 1.0;
const FRET_SPACING = 1.5;
const DOT_COLOR = 0xcccccc;
const NOTE_COLOR = 0x4ecdc4;
const BACKGROUND = 0x0f172a; // tailwind slate-900

const ORBIT_PERIOD_MS = 12_000;
const WALK_INTERVAL_MS = 520;

export default function MarketingFretboard3D({
  ariaLabel = '3D fretboard preview',
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(BACKGROUND, 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BACKGROUND);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    const cameraDist = Math.sqrt(5 * 5 + 8 * 8); // match production [0, 5, 8]
    const cameraHeight = 5;
    camera.position.set(0, cameraHeight, 8);
    camera.lookAt(0, 0, 0);

    // Fretboard group — same -0.2 X-axis tilt as production.
    const group = new THREE.Group();
    group.rotation.set(-0.2, 0, 0);
    scene.add(group);

    // Build the dot grid (matches production exactly).
    const dotMaterial = new THREE.MeshBasicMaterial({ color: DOT_COLOR });
    const dots: THREE.Mesh[] = [];
    for (let s = 0; s < STRINGS; s++) {
      for (let f = 0; f < FRETS; f++) {
        const x = f * FRET_SPACING - ((FRETS - 1) * FRET_SPACING) / 2;
        const z = (s - (STRINGS - 1) / 2) * STRING_SPACING;
        const scale = 1 - s * 0.1; // perspective per string row
        const dotSize = 0.25 * scale;
        const isZeroFret = f === 0;
        const geom = isZeroFret
          ? new THREE.PlaneGeometry(dotSize * 1.5, dotSize * 1.5)
          : new THREE.CircleGeometry(dotSize, 16);
        const mesh = new THREE.Mesh(geom, dotMaterial);
        mesh.position.set(x, 0, z);
        mesh.rotation.x = -Math.PI / 2; // lie flat
        group.add(mesh);
        dots.push(mesh);
      }
    }

    // Note dots — same geometry as production, just enable/disable visibility
    // as we walk through a bass-line pattern.
    const noteMaterial = new THREE.MeshBasicMaterial({
      color: NOTE_COLOR,
      transparent: true,
      opacity: 0.8,
    });
    const notes: THREE.Mesh[] = [];
    // Pre-create note meshes at every grid cell — much cheaper than
    // creating/disposing meshes on each step.
    for (let s = 0; s < STRINGS; s++) {
      for (let f = 1; f < FRETS; f++) {
        const x = f * FRET_SPACING - ((FRETS - 1) * FRET_SPACING) / 2;
        const z = (s - (STRINGS - 1) / 2) * STRING_SPACING;
        const geom = new THREE.CircleGeometry(0.4, 16);
        const mesh = new THREE.Mesh(geom, noteMaterial);
        mesh.position.set(x, 0.2, z); // slightly above the dots
        mesh.rotation.x = -Math.PI / 2;
        mesh.visible = false;
        group.add(mesh);
        notes.push(mesh);
      }
    }

    // Walking-bass step: light up 1–2 notes per tick.
    let walkIndex = 0;
    const walkTick = () => {
      notes.forEach((n) => {
        n.visible = false;
      });
      const a = notes[walkIndex % notes.length];
      if (a) a.visible = true;
      if (Math.random() > 0.55) {
        const b = notes[(walkIndex + 5) % notes.length];
        if (b) b.visible = true;
      }
      walkIndex += 1;
    };
    walkTick();
    const walkTimer = window.setInterval(walkTick, WALK_INTERVAL_MS);

    // Bright ambient light — match production "intensity 1.2".
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    // Render loop with slow camera orbit.
    const startedAt = performance.now();
    let frameId: number;
    let disposed = false;
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    const render = () => {
      if (disposed) return;
      const t = (performance.now() - startedAt) / ORBIT_PERIOD_MS;
      if (!reducedMotion) {
        const angle = t * Math.PI * 2;
        camera.position.x = Math.sin(angle) * cameraDist * 0.4;
        camera.position.z = Math.cos(angle) * cameraDist;
        camera.position.y = cameraHeight;
        camera.lookAt(0, 0, 0);
      }
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);

    // Resize handling.
    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearInterval(walkTimer);
      ro.disconnect();
      // Dispose geometries + materials to release GPU memory.
      dots.forEach((m) => m.geometry.dispose());
      notes.forEach((m) => m.geometry.dispose());
      dotMaterial.dispose();
      noteMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="w-full h-full"
      role="img"
      aria-label={ariaLabel}
    />
  );
}
