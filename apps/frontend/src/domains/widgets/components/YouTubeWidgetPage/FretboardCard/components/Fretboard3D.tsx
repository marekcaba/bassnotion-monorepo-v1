'use client';

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { convertFrom3DFormat } from '../utils/formatConversion';

// Create a rounded rectangle shape
function createRoundedRectShape(
  width: number,
  height: number,
  radius: number,
): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;

  shape.moveTo(x, y + radius);
  shape.lineTo(x, y + height - radius);
  shape.quadraticCurveTo(x, y + height, x + radius, y + height);
  shape.lineTo(x + width - radius, y + height);
  shape.quadraticCurveTo(x + width, y + height, x + width, y + height - radius);
  shape.lineTo(x + width, y + radius);
  shape.quadraticCurveTo(x + width, y, x + width - radius, y);
  shape.lineTo(x + radius, y);
  shape.quadraticCurveTo(x, y, x, y + radius);

  return shape;
}

// Create a canvas texture with text (number or string name)
function createTextTexture(
  text: string,
  isRounded = false,
  hasBackground = true,
  isStringName = false,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const size = 128; // Larger canvas size for better quality
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not get 2D context');
  }

  // Clear canvas with transparent background
  context.clearRect(0, 0, size, size);

  if (hasBackground) {
    if (isRounded) {
      // Create rounded rectangle with black background
      const radius = 12;
      const x = 2;
      const y = 2;
      const width = size - 2;
      const height = size - 2;

      context.beginPath();
      context.moveTo(x + radius, y);
      context.lineTo(x + width - radius, y);
      context.quadraticCurveTo(x + width, y, x + width, y + radius);
      context.lineTo(x + width, y + height - radius);
      context.quadraticCurveTo(
        x + width,
        y + height,
        x + width - radius,
        y + height,
      );
      context.lineTo(x + radius, y + height);
      context.quadraticCurveTo(x, y + height, x, y + height - radius);
      context.lineTo(x, y + radius);
      context.quadraticCurveTo(x, y, x + radius, y);
      context.closePath();

      context.fillStyle = '#000000';
      context.fill();
    } else {
      // Fill entire canvas with black background (or white for string names)
      context.fillStyle = isStringName ? '#ffffff' : '#000000';
      context.fillRect(0, 0, size, size);
    }
  }

  // Draw text (white on black background, white on transparent)
  context.font = 'bold 64px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  if (!hasBackground) {
    // For transparent background, use white text with black outline
    context.strokeStyle = '#000000';
    context.lineWidth = 6;
    context.strokeText(text, size / 2, size / 2);
    context.fillStyle = '#ffffff';
    context.fillText(text, size / 2, size / 2);
  } else {
    // For backgrounds, use appropriate text color
    context.fillStyle = isStringName ? '#000000' : '#ffffff';
    context.fillText(text, size / 2, size / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.flipY = true; // Flip Y to fix upside down

  return texture;
}

// Get string name for bass guitar using absolute string indices
function getStringName(
  absoluteStringIndex: number,
  stringCount: number,
): string {
  // Map absolute indices to string names
  // Full layout: B(0), E(1), A(2), D(3), G(4), C(5)
  const stringNames: { [key: number]: string } = {
    0: 'B', // B string (lowest)
    1: 'E', // E string
    2: 'A', // A string
    3: 'D', // D string
    4: 'G', // G string (highest for 4/5 string)
    5: 'C', // C string (6-string only)
  };

  return stringNames[absoluteStringIndex] || '';
}

interface DotPosition {
  stringIndex: number;
  fret: number | 'open';
}

interface Fretboard3DProps {
  stringCount: 4 | 5 | 6;
  maxFrets?: number;
  selectedDots: Map<string, number>;
  onDotClick: (stringIndex: number, fret: number | 'open') => void;
  onDotDragStart?: (stringIndex: number, fret: number | 'open') => void;
  onDotDragEnd?: (stringIndex: number, fret: number | 'open') => void;
  onDropdownAction?: (
    action: string,
    stringIndex: number,
    fret: number | 'open',
  ) => void;
  className?: string;
  cameraDistance?: number;
  cameraMode?: 'overview' | 'action';
  onCameraModeChange?: (mode: 'overview' | 'action') => void;
}

// 3D Dot Component
function Dot3D({
  position,
  isSelected,
  isOpen,
  onClick,
  onPointerOver,
  onPointerOut,
  selectionOrder,
  fret,
  stringIndex,
  stringCount,
  hasSelectedDots,
}: {
  position: [number, number, number];
  isSelected: boolean;
  isOpen: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
  selectionOrder?: number;
  fret: number | 'open';
  stringIndex: number;
  stringCount: number;
  hasSelectedDots: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  // Check if this fret should be highlighted (3rd, 5th, 7th, 9th, 12th frets)
  const isHighlightedFret = useMemo(() => {
    if (isOpen) return false;
    const fretNum = typeof fret === 'number' ? fret : 0;
    return [3, 5, 7, 9, 12].includes(fretNum);
  }, [fret, isOpen]);

  // No scaling animation - keep dots at constant size

  const handlePointerOver = useCallback(() => {
    setHovered(true);
    onPointerOver();
  }, [onPointerOver]);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    onPointerOut();
  }, [onPointerOut]);

  return (
    <group>
      <mesh
        position={position}
        onClick={onClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        rotation={isOpen ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
      >
        {/* Use cylinder for frets, rounded box for open strings */}
        {isOpen ? (
          <extrudeGeometry
            args={[
              createRoundedRectShape(0.7, 0.7, 0.1),
              { depth: 0.2, bevelEnabled: false },
            ]}
          />
        ) : (
          <cylinderGeometry args={[0.4, 0.4, 0.2, 16]} />
        )}
        <meshStandardMaterial
          color={
            isSelected
              ? '#10b981'
              : hovered
                ? '#6b7280'
                : isHighlightedFret
                  ? '#d1d5db' // Keep normal color for highlighted frets
                  : '#9ca3af' // Keep normal color for regular dots
          }
          metalness={0.1}
          roughness={0.6}
          emissive={isSelected ? '#065f46' : '#000000'}
          emissiveIntensity={isSelected ? 0.1 : 0}
          opacity={1.0}
          transparent={false}
        />
      </mesh>

      {/* Selection order number - flat on top of cylinder (only show number 1) */}
      {isSelected && selectionOrder === 1 && !isOpen && (
        <mesh
          position={[position[0], position[1] + 0.11, position[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.4, 32]} />
          <meshBasicMaterial
            map={createTextTexture('1')}
            transparent={false}
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>
      )}

      {/* Selection order number for open strings (on top of box) (only show number 1) */}
      {isSelected && selectionOrder === 1 && isOpen && (
        <mesh
          position={[position[0], position[1] + 0.002, position[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.7, 0.7]} />
          <meshBasicMaterial
            map={createTextTexture('1', true)}
            transparent={true}
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>
      )}

      {/* String name text overlay for open strings (show unless it's the first note) */}
      {isOpen && !(isSelected && selectionOrder === 1) && (
        <mesh
          position={[position[0], position[1] + 0.002, position[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.7, 0.7]} />
          <meshBasicMaterial
            map={createTextTexture(
              getStringName(stringIndex, stringCount),
              false,
              false, // No background - use white text with black outline like 2D mode
              true, // Mark as string name for styling
            )}
            transparent={true}
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>
      )}
    </group>
  );
}

// 3D Connection Line Component
function ConnectionLine3D({
  start,
  end,
  isHighlighted: _isHighlighted,
  color = '#10b981',
  offset = 0,
  offsetDirection = 1,
}: {
  start: [number, number, number];
  end: [number, number, number];
  isHighlighted: boolean;
  color?: string;
  offset?: number;
  offsetDirection?: number;
}) {
  const { position, rotation, length } = useMemo(() => {
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);
    const direction = endVec.clone().sub(startVec);
    const length = direction.length();
    const position = startVec.clone().add(endVec).multiplyScalar(0.5);

    // Apply offset perpendicular to the line direction
    if (offset > 0) {
      // Calculate a perpendicular vector to the line direction
      const up = new THREE.Vector3(0, 1, 0);
      let perpendicular;

      // If the line is mostly vertical, use a different reference vector
      if (Math.abs(direction.y) > 0.9) {
        perpendicular = new THREE.Vector3(1, 0, 0).cross(direction).normalize();
      } else {
        perpendicular = up.cross(direction).normalize();
      }

      // Move the position perpendicular to the line with direction
      position.add(
        perpendicular.multiplyScalar(offset * offsetDirection * 0.15),
      );
    }

    // If length is 0 or very small, return default values to avoid NaN
    if (length < 0.001) {
      return {
        position: [position.x, position.y, position.z] as [
          number,
          number,
          number,
        ],
        rotation: [0, 0, 0] as [number, number, number],
        length: 0.001, // Minimum length to avoid NaN
      };
    }

    // Calculate rotation to align cylinder with the line
    const axis = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      axis,
      direction.normalize(),
    );
    const euler = new THREE.Euler().setFromQuaternion(quaternion);

    return {
      position: [position.x, position.y, position.z] as [
        number,
        number,
        number,
      ],
      rotation: [euler.x, euler.y, euler.z] as [number, number, number],
      length,
    };
  }, [start, end, offset, offsetDirection]);

  // Don't render if length is too small
  if (length < 0.01) {
    return null;
  }

  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[0.05, 0.05, length, 8]} />
      <meshStandardMaterial
        color={color}
        metalness={0.1}
        roughness={0.6}
        emissive={
          color === '#3b82f6'
            ? '#1e40af' // Blue emissive for blue lines
            : color === '#ef4444'
              ? '#b91c1c' // Red emissive for red lines
              : '#065f46' // Green emissive for green lines
        }
        emissiveIntensity={0.1}
      />
    </mesh>
  );
}

// Main 3D Scene Component
function Fretboard3DScene({
  stringCount,
  maxFrets,
  selectedDots,
  onDotClick,
  cameraDistance,
  onCameraUpdate,
  cameraMode,
}: {
  stringCount: 4 | 5 | 6;
  maxFrets: number;
  selectedDots: Map<string, number>;
  onDotClick: (stringIndex: number, fret: number | 'open') => void;
  cameraDistance: number;
  onCameraUpdate: (info: string) => void;
  cameraMode: 'overview' | 'action';
}) {
  // Check if any dots are selected to apply dimming effect
  const hasSelectedDots = selectedDots.size > 0;
  const [_hoveredDot, setHoveredDot] = useState<DotPosition | null>(null);
  const [_cameraInfo, _setCameraInfo] = useState<string>('');
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionRef = useRef<{
    startTime: number;
    duration: number;
    startPosition: THREE.Vector3;
    startQuaternion: THREE.Quaternion;
    startTarget: THREE.Vector3;
    endPosition: THREE.Vector3;
    endQuaternion: THREE.Quaternion;
    endTarget: THREE.Vector3;
  } | null>(null);

  // Easing function for smooth transitions (ease-in-out)
  const easeInOut = (t: number): number => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  };

  // Start camera transition
  const startCameraTransition = (targetMode: 'overview' | 'action') => {
    if (!camera || !controlsRef.current) return;

    // Current state
    const startPosition = camera.position.clone();
    const startQuaternion = camera.quaternion.clone();
    const startTarget = controlsRef.current.target.clone();

    // Target state
    let endPosition: THREE.Vector3;
    let endQuaternion: THREE.Quaternion;
    let endTarget: THREE.Vector3;

    if (targetMode === 'action') {
      // Find the first three selected notes (orders 1, 2, 3) if they exist
      const notePositions: {
        order: number;
        position: [number, number, number];
      }[] = [];

      for (const [key, order] of selectedDots.entries()) {
        if (order >= 1 && order <= 3) {
          // Parse the key to get string and fret
          const parts = key.split('-');
          const stringPart = parts[0];
          const fretPart = parts[1];

          if (stringPart !== undefined && fretPart !== undefined) {
            const stringIndex = parseInt(stringPart);
            const fret = fretPart === 'open' ? 'open' : parseInt(fretPart);
            const position = get3DPosition(stringIndex, fret);
            notePositions.push({ order, position });
          }
        }
      }

      if (notePositions.length > 0) {
        // Sort by order to ensure correct sequence
        notePositions.sort((a, b) => a.order - b.order);

        // Calculate the optimal camera position to show the first 1-3 notes
        const firstNote = notePositions[0];
        if (!firstNote) {
          // Fallback to default action mode position
          endPosition = new THREE.Vector3(-7.1908, 4.7506, 5.7491);
          endTarget = new THREE.Vector3(-7.2, 0.127, -0.2028);
        } else {
          const firstNoteX = firstNote.position[0];

          let targetX: number;
          if (notePositions.length === 1) {
            // Only first note - center on it
            targetX = firstNoteX;
          } else if (notePositions.length === 2) {
            // First and second notes - position camera to favor first note but show both
            const secondNote = notePositions[1];
            const secondNoteX = secondNote
              ? secondNote.position[0]
              : firstNoteX;
            targetX = firstNoteX + (secondNoteX - firstNoteX) * 0.3; // 30% towards second note
          } else {
            // First, second, and third notes - find optimal center
            const secondNote = notePositions[1];
            const thirdNote = notePositions[2];
            const secondNoteX = secondNote
              ? secondNote.position[0]
              : firstNoteX;
            const thirdNoteX = thirdNote ? thirdNote.position[0] : secondNoteX;
            const span =
              Math.max(firstNoteX, secondNoteX, thirdNoteX) -
              Math.min(firstNoteX, secondNoteX, thirdNoteX);

            if (span <= 3.0) {
              // Notes are close together - center on the middle of all three
              targetX = (firstNoteX + secondNoteX + thirdNoteX) / 3;
            } else {
              // Notes are spread out - prioritize first two notes
              targetX = firstNoteX + (secondNoteX - firstNoteX) * 0.4; // 40% towards second note
            }
          }

          // Action mode with note focus - move horizontally to optimal viewing position
          const horizontalOffset = targetX - -7.2; // Calculate offset from default target X
          endPosition = new THREE.Vector3(
            -7.1908 + horizontalOffset,
            4.7506,
            5.7491,
          ); // Move camera horizontally by same offset
          endTarget = new THREE.Vector3(
            -7.2 + horizontalOffset,
            0.127,
            -0.2028,
          ); // Move target horizontally by same offset
        }
      } else {
        // Default action mode position when no notes selected
        endPosition = new THREE.Vector3(-7.1908, 4.7506, 5.7491);
        endTarget = new THREE.Vector3(-7.2, 0.127, -0.2028);
      }

      endQuaternion = new THREE.Quaternion(-0.3243, 0.0007, 0.0003, 0.946);
    } else {
      endPosition = new THREE.Vector3(-0.1559, 12.5282, 7.5632);
      endQuaternion = new THREE.Quaternion(-0.483, -0.0005, -0.0003, 0.8756);
      endTarget = new THREE.Vector3(-0.1463, 0.1525, -0.2396);
    }

    // Set up transition
    transitionRef.current = {
      startTime: performance.now(),
      duration: 1000, // 1 second transition
      startPosition,
      startQuaternion,
      startTarget,
      endPosition,
      endQuaternion,
      endTarget,
    };

    setIsTransitioning(true);
  };

  // Update camera position when cameraDistance, cameraMode, or selectedDots change
  useEffect(() => {
    if (camera && controlsRef.current) {
      // Skip animation on initial mount if already in overview mode with correct position
      const isInitialOverviewPosition =
        cameraMode === 'overview' &&
        camera.position.distanceTo(
          new THREE.Vector3(-0.1559, 12.5282, 7.5632),
        ) < 0.01;

      if (!isInitialOverviewPosition) {
        startCameraTransition(cameraMode);
      }
    }
  }, [cameraDistance, camera, cameraMode, selectedDots]);

  // Handle camera transitions and update camera info display
  useFrame(() => {
    if (camera && controlsRef.current) {
      // Handle smooth camera transitions
      if (isTransitioning && transitionRef.current) {
        const currentTime = performance.now();
        const elapsed = currentTime - transitionRef.current.startTime;
        const progress = Math.min(elapsed / transitionRef.current.duration, 1);
        const easedProgress = easeInOut(progress);

        // Interpolate position
        camera.position.lerpVectors(
          transitionRef.current.startPosition,
          transitionRef.current.endPosition,
          easedProgress,
        );

        // Interpolate quaternion
        camera.quaternion.slerpQuaternions(
          transitionRef.current.startQuaternion,
          transitionRef.current.endQuaternion,
          easedProgress,
        );

        // Interpolate target
        controlsRef.current.target.lerpVectors(
          transitionRef.current.startTarget,
          transitionRef.current.endTarget,
          easedProgress,
        );

        // Update controls
        controlsRef.current.update();

        // Check if transition is complete
        if (progress >= 1) {
          setIsTransitioning(false);
          transitionRef.current = null;
        }
      }

      // Update camera info display
      const pos = camera.position;
      const rot = camera.rotation;
      const quat = camera.quaternion;
      const target = controlsRef.current.target;

      const info = `Position: [${pos.x.toFixed(4)}, ${pos.y.toFixed(4)}, ${pos.z.toFixed(4)}]
Rotation: [${rot.x.toFixed(4)}, ${rot.y.toFixed(4)}, ${rot.z.toFixed(4)}]
Quaternion: [${quat.x.toFixed(4)}, ${quat.y.toFixed(4)}, ${quat.z.toFixed(4)}, ${quat.w.toFixed(4)}]
Target: [${target.x.toFixed(4)}, ${target.y.toFixed(4)}, ${target.z.toFixed(4)}]`;
      onCameraUpdate(info);
    }
  });

  // Calculate 3D positions
  const get3DPosition = useCallback(
    (
      absoluteStringIndex: number,
      fret: number | 'open',
    ): [number, number, number] => {
      const fretPosition = fret === 'open' ? 0 : fret;
      const x = fretPosition * 1.5 - 9; // Center the fretboard
      const y = fret === 'open' ? 0.05 : 0; // Raise open strings slightly to align with dots

      // Convert absolute string index to relative position for 3D positioning
      // We need to map the absolute indices to consecutive positions for the 3D layout
      let relativePosition = 0;

      if (stringCount === 4) {
        // 4-string: E(1)→0, A(2)→1, D(3)→2, G(4)→3
        relativePosition = absoluteStringIndex - 1;
      } else if (stringCount === 5) {
        // 5-string: B(0)→0, E(1)→1, A(2)→2, D(3)→3, G(4)→4
        relativePosition = absoluteStringIndex;
      } else if (stringCount === 6) {
        // 6-string: B(0)→0, E(1)→1, A(2)→2, D(3)→3, G(4)→4, C(5)→5
        relativePosition = absoluteStringIndex;
      }

      // Reverse the Z-axis so low E string is at the bottom (like 2D mode)
      // Instead of: z = (relativePosition - (stringCount - 1) / 2) * 1.0
      // Use: z = -((relativePosition - (stringCount - 1) / 2) * 1.0)
      const z = -((relativePosition - (stringCount - 1) / 2) * 1.0); // Center strings, reversed
      return [x, y, z];
    },
    [stringCount],
  );

  // Calculate connection positions (center of meshes)
  const getConnectionPosition = useCallback(
    (
      absoluteStringIndex: number,
      fret: number | 'open',
    ): [number, number, number] => {
      const fretPosition = fret === 'open' ? 0 : fret;
      const x = fretPosition * 1.5 - 9; // Center the fretboard
      const y = 0; // Center height for all connections

      // Convert absolute string index to relative position for 3D positioning
      let relativePosition = 0;

      if (stringCount === 4) {
        // 4-string: E(1)→0, A(2)→1, D(3)→2, G(4)→3
        relativePosition = absoluteStringIndex - 1;
      } else if (stringCount === 5) {
        // 5-string: B(0)→0, E(1)→1, A(2)→2, D(3)→3, G(4)→4
        relativePosition = absoluteStringIndex;
      } else if (stringCount === 6) {
        // 6-string: B(0)→0, E(1)→1, A(2)→2, D(3)→3, G(4)→4, C(5)→5
        relativePosition = absoluteStringIndex;
      }

      // Reverse the Z-axis so low E string is at the bottom (like 2D mode)
      const z = -((relativePosition - (stringCount - 1) / 2) * 1.0); // Center strings, reversed
      return [x, y, z];
    },
    [stringCount],
  );

  // Generate all dots using absolute string indices
  const dots = useMemo(() => {
    const result = [];

    // Get the absolute string indices for the current string count
    const getAbsoluteStringIndices = (stringCount: number) => {
      if (stringCount === 4) {
        return [1, 2, 3, 4]; // E, A, D, G
      } else if (stringCount === 5) {
        return [0, 1, 2, 3, 4]; // B, E, A, D, G
      } else if (stringCount === 6) {
        return [0, 1, 2, 3, 4, 5]; // B, E, A, D, G, C
      }
      return [1, 2, 3, 4]; // Default to 4-string
    };

    const absoluteStringIndices = getAbsoluteStringIndices(stringCount);

    for (const absoluteStringIndex of absoluteStringIndices) {
      // Open string
      const openKey = `${absoluteStringIndex}-open`;
      const isOpenSelected = selectedDots.has(openKey);
      const openSelectionOrder = selectedDots.get(openKey);
      result.push(
        <Dot3D
          key={openKey}
          position={get3DPosition(absoluteStringIndex, 'open')}
          isSelected={isOpenSelected}
          isOpen={true}
          onClick={() => onDotClick(absoluteStringIndex, 'open')}
          onPointerOver={() =>
            setHoveredDot({ stringIndex: absoluteStringIndex, fret: 'open' })
          }
          onPointerOut={() => setHoveredDot(null)}
          selectionOrder={openSelectionOrder}
          fret="open"
          stringIndex={absoluteStringIndex}
          stringCount={stringCount}
          hasSelectedDots={hasSelectedDots}
        />,
      );

      // Fretted positions
      for (let fret = 1; fret <= maxFrets; fret++) {
        const fretKey = `${absoluteStringIndex}-${fret}`;
        const isFretSelected = selectedDots.has(fretKey);
        const fretSelectionOrder = selectedDots.get(fretKey);
        result.push(
          <Dot3D
            key={fretKey}
            position={get3DPosition(absoluteStringIndex, fret)}
            isSelected={isFretSelected}
            isOpen={false}
            onClick={() => onDotClick(absoluteStringIndex, fret)}
            onPointerOver={() =>
              setHoveredDot({ stringIndex: absoluteStringIndex, fret })
            }
            onPointerOut={() => setHoveredDot(null)}
            selectionOrder={fretSelectionOrder}
            fret={fret}
            stringIndex={absoluteStringIndex}
            stringCount={stringCount}
            hasSelectedDots={hasSelectedDots}
          />,
        );
      }
    }
    return result;
  }, [stringCount, selectedDots, onDotClick, get3DPosition]);

  // Generate connection lines
  const connections = useMemo(() => {
    const result = [];

    // Convert 3D format to 2D format for crossing detection
    const selectedDots2D = convertFrom3DFormat(selectedDots);
    const sortedPositions = getSelectedPositionsByOrder(selectedDots2D);

    const selectedPositions = Array.from(selectedDots.entries())
      .sort((a, b) => a[1] - b[1]) // Sort by selection order
      .map(([key]) => {
        const parts = key.split('-');
        const stringIndex = parts[0];
        const fret = parts[1];

        if (!stringIndex || !fret) {
          throw new Error(`Invalid key format: ${key}`);
        }

        return {
          stringIndex: parseInt(stringIndex),
          fret: fret === 'open' ? ('open' as const) : parseInt(fret),
          key,
        };
      });

    // Draw lines between consecutive selected dots
    for (let i = 0; i < selectedPositions.length - 1; i++) {
      const start = selectedPositions[i];
      const end = selectedPositions[i + 1];

      if (start && end) {
        const startPos = getConnectionPosition(start.stringIndex, start.fret);
        const endPos = getConnectionPosition(end.stringIndex, end.fret);

        // All lines are green, connecting notes in sequence
        const lineColor = '#10b981'; // Green

        result.push(
          <ConnectionLine3D
            key={`connection-${start.key}-${end.key}`}
            start={startPos}
            end={endPos}
            isHighlighted={true}
            color={lineColor}
            offset={0}
            offsetDirection={1}
          />,
        );
      }
    }

    return result;
  }, [selectedDots, getConnectionPosition]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <pointLight position={[0, 5, 0]} intensity={0.4} />

      {/* Fretboard base removed to match 2D mode */}

      {/* Fret lines - white with low opacity to match 2D mode */}
      {Array.from({ length: maxFrets + 1 }, (_, i) => (
        <mesh key={`fret-${i}`} position={[i * 1.5 - 9, -0.1, 0]}>
          <boxGeometry args={[0.05, 0.1, (stringCount - 1) * 1.0]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.1} />
        </mesh>
      ))}

      {/* String lines - white with low opacity to match 2D mode */}
      {(() => {
        // Get the absolute string indices for the current string count
        const getAbsoluteStringIndices = (stringCount: number) => {
          if (stringCount === 4) {
            return [1, 2, 3, 4]; // E, A, D, G
          } else if (stringCount === 5) {
            return [0, 1, 2, 3, 4]; // B, E, A, D, G
          } else if (stringCount === 6) {
            return [0, 1, 2, 3, 4, 5]; // B, E, A, D, G, C
          }
          return [1, 2, 3, 4]; // Default to 4-string
        };

        const absoluteStringIndices = getAbsoluteStringIndices(stringCount);

        return absoluteStringIndices.map((absoluteStringIndex, i) => (
          <mesh
            key={`string-${absoluteStringIndex}`}
            position={[0, -0.1, -((i - (stringCount - 1) / 2) * 1.0)]}
          >
            <boxGeometry args={[18.0, 0.05, 0.05]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.1} />
          </mesh>
        ));
      })()}

      {/* Dots */}
      {dots}

      {/* Connections */}
      {connections}

      {/* Camera Controls */}
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        maxPolarAngle={Math.PI / 2}
        minDistance={5}
        maxDistance={30}
        target={[-0.1463, 0.1525, -0.2396]}
      />
    </>
  );
}

export default function Fretboard3D({
  stringCount = 4,
  maxFrets = 24,
  selectedDots,
  onDotClick,
  onDotDragStart: _onDotDragStart,
  onDotDragEnd: _onDotDragEnd,
  onDropdownAction,
  className = '',
  cameraDistance = 7,
  cameraMode = 'overview',
  onCameraModeChange: _onCameraModeChange,
}: Fretboard3DProps) {
  const [_cameraInfo, setCameraInfo] = useState<string>('');

  // Force canvas to resize when component mounts or container changes
  useEffect(() => {
    const handleResize = () => {
      // Trigger a window resize event to make Three.js canvas recalculate its size
      window.dispatchEvent(new Event('resize'));
    };

    // Delay slightly to ensure the container has rendered
    const timeout = setTimeout(handleResize, 100);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className={`w-full h-full relative ${className}`}>
      <Canvas
        camera={{
          position: [-0.1559, 12.5282, 7.5632],
          fov: 35,
          // Set initial quaternion to match overview mode to prevent animation on mount
          quaternion: [-0.483, -0.0005, -0.0003, 0.8756],
        }}
        style={{ width: '100%', height: '100%', display: 'block' }}
        resize={{ scroll: false, debounce: { scroll: 50, resize: 50 } }}
        dpr={[1, 2]}
      >
        <Fretboard3DScene
          stringCount={stringCount}
          maxFrets={maxFrets}
          selectedDots={selectedDots}
          onDotClick={onDotClick}
          cameraDistance={cameraDistance}
          onCameraUpdate={setCameraInfo}
          cameraMode={cameraMode}
        />
      </Canvas>

      {/* Debug camera coordinates overlay - commented out for production use */}
      {/* <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white p-2 rounded text-xs font-mono whitespace-pre-line">
        {_cameraInfo}
      </div> */}
    </div>
  );
}
