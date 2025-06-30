import * as THREE from 'three';
import { FretboardDimensions, FretboardGeometry } from '../types/fretboard';

// Fretboard dimensions as specified in story
export const BASS_FRETBOARD_DIMENSIONS: FretboardDimensions = {
  scaleLength: 864, // 34" in mm
  fretCount: 24,
  stringSpacing: 19, // mm between strings
  stringCount: 4,
};

// Fret position calculation using equal temperament
function calculateFretPosition(
  fretNumber: number,
  scaleLength: number,
): number {
  if (fretNumber === 0) return 0;
  return scaleLength - scaleLength / Math.pow(2, fretNumber / 12);
}

// Create fretboard neck geometry
export function createFretboardGeometry(): THREE.BufferGeometry {
  const { scaleLength, stringSpacing, stringCount } = BASS_FRETBOARD_DIMENSIONS;

  // Fretboard dimensions
  const width = (stringCount - 1) * stringSpacing + 20; // Extra width for edges
  const length = scaleLength * 0.8; // Show 80% of scale length for better view
  const thickness = 8; // mm

  const geometry = new THREE.BoxGeometry(width, thickness, length);

  // Position fretboard
  geometry.translate(0, -thickness / 2, -length / 2);

  return geometry;
}

// Create fret wire geometries
export function createFretGeometries(): THREE.BufferGeometry[] {
  const { scaleLength, stringSpacing, stringCount, fretCount } =
    BASS_FRETBOARD_DIMENSIONS;
  const frets: THREE.BufferGeometry[] = [];

  const fretWidth = (stringCount - 1) * stringSpacing + 10; // Slightly wider than strings
  const fretHeight = 2; // mm
  const fretThickness = 1; // mm

  for (let i = 1; i <= fretCount; i++) {
    const fretPosition = calculateFretPosition(i, scaleLength * 0.8);

    const fretGeometry = new THREE.BoxGeometry(
      fretWidth,
      fretHeight,
      fretThickness,
    );
    fretGeometry.translate(0, fretHeight / 2, -fretPosition);

    frets.push(fretGeometry);
  }

  return frets;
}

// Create string geometries
export function createStringGeometries(): THREE.BufferGeometry[] {
  const { scaleLength, stringSpacing, stringCount } = BASS_FRETBOARD_DIMENSIONS;
  const strings: THREE.BufferGeometry[] = [];

  const stringLength = scaleLength * 0.8;
  const stringRadius = 0.5; // mm

  for (let i = 0; i < stringCount; i++) {
    const stringX = (i - (stringCount - 1) / 2) * stringSpacing;

    const stringGeometry = new THREE.CylinderGeometry(
      stringRadius,
      stringRadius,
      stringLength,
      8,
    );

    // Rotate to align with fretboard
    stringGeometry.rotateX(Math.PI / 2);
    stringGeometry.translate(stringX, 1, -stringLength / 2);

    strings.push(stringGeometry);
  }

  return strings;
}

// Create fretboard inlay geometries (position markers)
export function createInlayGeometries(): THREE.BufferGeometry[] {
  const { scaleLength, stringSpacing } = BASS_FRETBOARD_DIMENSIONS;
  const inlays: THREE.BufferGeometry[] = [];

  // Inlay positions: 3, 5, 7, 9, 12, 15, 17, 19, 21
  const inlayFrets = [3, 5, 7, 9, 12, 15, 17, 19, 21];
  const inlayRadius = 3; // mm
  const inlayThickness = 0.5; // mm

  inlayFrets.forEach((fretNumber) => {
    const fretPosition = calculateFretPosition(fretNumber, scaleLength * 0.8);
    const inlayPosition =
      calculateFretPosition(fretNumber - 1, scaleLength * 0.8) +
      (fretPosition -
        calculateFretPosition(fretNumber - 1, scaleLength * 0.8)) /
        2;

    if (fretNumber === 12) {
      // Double dot for 12th fret
      for (let i = 0; i < 2; i++) {
        const inlayGeometry = new THREE.CylinderGeometry(
          inlayRadius,
          inlayRadius,
          inlayThickness,
          16,
        );
        const offsetX = (i - 0.5) * stringSpacing;
        inlayGeometry.translate(offsetX, 0.5, -inlayPosition);
        inlays.push(inlayGeometry);
      }
    } else {
      // Single dot for other frets
      const inlayGeometry = new THREE.CylinderGeometry(
        inlayRadius,
        inlayRadius,
        inlayThickness,
        16,
      );
      inlayGeometry.translate(0, 0.5, -inlayPosition);
      inlays.push(inlayGeometry);
    }
  });

  return inlays;
}

// Main function to create complete fretboard geometry
export function createCompleteFretboardGeometry(): FretboardGeometry {
  return {
    fretboard: createFretboardGeometry(),
    frets: createFretGeometries(),
    strings: createStringGeometries(),
    inlays: createInlayGeometries(),
  };
}

// Calculate note position on fretboard
export function calculateNotePosition(
  string: number,
  fret: number,
): THREE.Vector3 {
  const { scaleLength, stringSpacing, stringCount } = BASS_FRETBOARD_DIMENSIONS;

  // String position (X axis)
  const stringX = (string - 1 - (stringCount - 1) / 2) * stringSpacing;

  // Fret position (Z axis)
  let fretZ: number;
  if (fret === 0) {
    fretZ = 0; // Open string at nut
  } else {
    const fretPosition = calculateFretPosition(fret, scaleLength * 0.8);
    const prevFretPosition = calculateFretPosition(fret - 1, scaleLength * 0.8);
    fretZ = -(prevFretPosition + (fretPosition - prevFretPosition) / 2);
  }

  // Height above fretboard
  const noteY = 3; // mm above fretboard

  return new THREE.Vector3(stringX, noteY, fretZ);
}
