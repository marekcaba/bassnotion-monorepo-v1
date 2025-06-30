// TypeScript declarations for react-three-fiber JSX elements
import * as THREE from 'three';

declare module '@react-three/fiber' {
  interface ThreeElements {
    // Objects
    group: object;
    mesh: object;
    
    // Geometries
    sphereGeometry: object;
    planeGeometry: object;
    boxGeometry: object;
    
    // Materials
    meshBasicMaterial: object;
    meshStandardMaterial: object;
    
    // Lights
    ambientLight: object;
    directionalLight: object;
    pointLight: object;
  }
} 