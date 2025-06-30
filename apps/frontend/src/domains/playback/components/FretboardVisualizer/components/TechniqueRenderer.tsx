'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { ExerciseNote, TechniqueTypes } from '../types/fretboard';
import { calculateNotePosition } from '../utils/fretboardGeometry';

interface TechniqueRendererProps {
  notes: ExerciseNote[];
  currentTime: number;
  visible?: boolean;
}

interface RenderedTechnique {
  note: ExerciseNote;
  position: THREE.Vector3;
  technique: TechniqueTypes;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

// Individual technique renderers
class HammerOnRenderer {
  canRender(technique: TechniqueTypes): boolean {
    return technique === 'hammer_on';
  }

  createGeometry(
    startNote: ExerciseNote,
    endNote?: ExerciseNote,
  ): THREE.BufferGeometry {
    const startPos = calculateNotePosition(startNote.string, startNote.fret);
    const endPos = endNote
      ? calculateNotePosition(endNote.string, endNote.fret)
      : new THREE.Vector3(startPos.x, startPos.y, startPos.z - 20);

    const curve = new THREE.QuadraticBezierCurve3(
      startPos,
      new THREE.Vector3(
        (startPos.x + endPos.x) / 2,
        startPos.y + 10,
        (startPos.z + endPos.z) / 2,
      ),
      endPos,
    );

    const points = curve.getPoints(20);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }

  createMaterial(): THREE.Material {
    return new THREE.LineBasicMaterial({
      color: '#FF6B6B',
      linewidth: 3,
      transparent: true,
      opacity: 0.8,
    });
  }
}

class PullOffRenderer {
  canRender(technique: TechniqueTypes): boolean {
    return technique === 'pull_off';
  }

  createGeometry(
    startNote: ExerciseNote,
    endNote?: ExerciseNote,
  ): THREE.BufferGeometry {
    const startPos = calculateNotePosition(startNote.string, startNote.fret);
    const endPos = endNote
      ? calculateNotePosition(endNote.string, endNote.fret)
      : new THREE.Vector3(startPos.x, startPos.y, startPos.z + 20);

    const curve = new THREE.QuadraticBezierCurve3(
      startPos,
      new THREE.Vector3(
        (startPos.x + endPos.x) / 2,
        startPos.y + 8,
        (startPos.z + endPos.z) / 2,
      ),
      endPos,
    );

    const points = curve.getPoints(20);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }

  createMaterial(): THREE.Material {
    return new THREE.LineBasicMaterial({
      color: '#4ECDC4',
      linewidth: 3,
      transparent: true,
      opacity: 0.8,
    });
  }
}

class SlideRenderer {
  canRender(technique: TechniqueTypes): boolean {
    return technique === 'slide';
  }

  createGeometry(
    startNote: ExerciseNote,
    endNote?: ExerciseNote,
  ): THREE.BufferGeometry {
    const startPos = calculateNotePosition(startNote.string, startNote.fret);
    const endPos = endNote
      ? calculateNotePosition(endNote.string, endNote.fret)
      : new THREE.Vector3(startPos.x, startPos.y, startPos.z - 30);

    const points = [startPos, endPos];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }

  createMaterial(): THREE.Material {
    return new THREE.LineBasicMaterial({
      color: '#45B7D1',
      linewidth: 4,
      transparent: true,
      opacity: 0.9,
    });
  }
}

class BendRenderer {
  canRender(technique: TechniqueTypes): boolean {
    return technique === 'bend';
  }

  createGeometry(startNote: ExerciseNote): THREE.BufferGeometry {
    const startPos = calculateNotePosition(startNote.string, startNote.fret);

    // Create a curved bend indicator
    const curve = new THREE.QuadraticBezierCurve3(
      startPos,
      new THREE.Vector3(startPos.x + 5, startPos.y + 8, startPos.z),
      new THREE.Vector3(startPos.x + 10, startPos.y, startPos.z),
    );

    const points = curve.getPoints(15);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }

  createMaterial(): THREE.Material {
    return new THREE.LineBasicMaterial({
      color: '#96CEB4',
      linewidth: 3,
      transparent: true,
      opacity: 0.8,
    });
  }
}

class HarmonicRenderer {
  canRender(technique: TechniqueTypes): boolean {
    return technique === 'harmonic';
  }

  createGeometry(startNote: ExerciseNote): THREE.BufferGeometry {
    const position = calculateNotePosition(startNote.string, startNote.fret);

    // Create diamond shape for harmonic
    const shape = new THREE.Shape();
    const size = 4;
    shape.moveTo(0, size);
    shape.lineTo(size, 0);
    shape.lineTo(0, -size);
    shape.lineTo(-size, 0);
    shape.lineTo(0, size);

    const geometry = new THREE.ShapeGeometry(shape);
    geometry.translate(position.x, position.y, position.z);
    return geometry;
  }

  createMaterial(): THREE.Material {
    return new THREE.MeshBasicMaterial({
      color: '#FFD700',
      transparent: true,
      opacity: 0.8,
    });
  }
}

export function TechniqueRenderer({
  notes,
  currentTime,
  visible = true,
}: TechniqueRendererProps) {
  // Initialize technique renderers
  const renderers = useMemo(
    () => ({
      hammer_on: new HammerOnRenderer(),
      pull_off: new PullOffRenderer(),
      slide: new SlideRenderer(),
      bend: new BendRenderer(),
      harmonic: new HarmonicRenderer(),
    }),
    [],
  );

  // Process notes with techniques
  const renderedTechniques = useMemo(() => {
    const techniques: RenderedTechnique[] = [];

    notes.forEach((note, index) => {
      if (!note.technique || note.technique === 'basic') return;

      const renderer = renderers[note.technique];
      if (!renderer || !renderer.canRender(note.technique)) return;

      // Check if note should be visible based on timing
      const timeDifference = note.timestamp - currentTime;
      if (timeDifference > 4000 || timeDifference < -1000) return;

      const position = calculateNotePosition(note.string, note.fret);
      const nextNote = notes[index + 1];

      let geometry: THREE.BufferGeometry;
      let material: THREE.Material;

      switch (note.technique) {
        case 'hammer_on':
        case 'pull_off':
        case 'slide':
          geometry = renderer.createGeometry(note, nextNote);
          material = renderer.createMaterial();
          break;
        case 'bend':
        case 'harmonic':
          geometry = renderer.createGeometry(note);
          material = renderer.createMaterial();
          break;
        default:
          return;
      }

      techniques.push({
        note,
        position,
        technique: note.technique,
        geometry,
        material,
      });
    });

    return techniques;
  }, [notes, currentTime, renderers]);

  if (!visible || renderedTechniques.length === 0) return null;

  return (
    <group name="technique-renderer">
      {renderedTechniques.map(({ note, geometry, material, technique }) => {
        const key = `${note.id}-${technique}`;

        if (technique === 'harmonic') {
          return <mesh key={key} geometry={geometry} material={material} />;
        } else {
          return (
            <primitive key={key} object={new THREE.Line(geometry, material)} />
          );
        }
      })}
    </group>
  );
}

// Export individual renderers for testing and extensibility
export {
  HammerOnRenderer,
  PullOffRenderer,
  SlideRenderer,
  BendRenderer,
  HarmonicRenderer,
};
