/**
 * DrummerWidget Migration Example
 * Story 3.22: Professional DAW Sequencer
 * 
 * This example demonstrates how to migrate from the old pattern-based
 * approach to the new region-based system while maintaining backward compatibility.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { nanoid } from 'nanoid';
import type { DrumPattern, DrumPatternEvent } from '@/domains/playback/types/pattern';

/**
 * Example 1: OLD APPROACH - Direct Pattern Registration
 * This is how widgets used to work before Story 3.22
 */
export function DrummerWidgetOldApproach() {
  const [pattern, setPattern] = useState<DrumPattern>(() => ({
    id: nanoid(),
    events: [
      { position: '0:0:0', drum: 'kick', velocity: 0.8 },
      { position: '0:1:0', drum: 'snare', velocity: 0.6 },
      { position: '0:2:0', drum: 'kick', velocity: 0.8 },
      { position: '0:3:0', drum: 'snare', velocity: 0.6 },
    ],
    loopLength: 1
  }));

  // In the old system, widgets would register patterns directly
  // This approach had limitations:
  // - No timeline view
  // - No support for multiple patterns
  // - Limited to loop-based playback
  // - Tight coupling between UI and transport

  return (
    <div>
      <h3>Old Approach (Direct Pattern)</h3>
      <p>Pattern plays in an infinite loop</p>
      {/* Pattern editing UI */}
    </div>
  );
}

/**
 * Example 2: NEW APPROACH - Region-Based System
 * This is the professional DAW approach introduced in Story 3.22
 */
export function DrummerWidgetNewApproach() {
  const { 
    track, 
    regions, 
    createRegionFromPattern,
    addRegion,
    removeRegion,
    updateRegion,
    selectedRegions,
    selectRegion
  } = useTrack({
    trackId: 'drums-main',
    name: 'Main Drums',
    type: 'drums'
  });

  // Create an initial pattern
  const [currentPattern] = useState<DrumPattern>(() => ({
    id: nanoid(),
    events: [
      { position: '0:0:0', drum: 'kick', velocity: 0.8 },
      { position: '0:1:0', drum: 'snare', velocity: 0.6 },
      { position: '0:2:0', drum: 'kick', velocity: 0.8 },
      { position: '0:3:0', drum: 'snare', velocity: 0.6 },
    ],
    loopLength: 1
  }));

  // Create regions from patterns
  const handleCreateRegion = useCallback(() => {
    if (!track) return;

    const region = createRegionFromPattern(currentPattern, {
      name: 'Drum Loop',
      startPosition: '0:0:0',
      duration: '1:0:0',
      loopCount: 4 // Play 4 times instead of infinite
    });

    console.log('Created region:', region);
  }, [track, currentPattern, createRegionFromPattern]);

  // Create multiple regions on timeline
  const handleCreateArrangement = useCallback(() => {
    if (!track) return;

    // Intro - simple kick pattern
    const introPattern: DrumPattern = {
      id: nanoid(),
      events: [
        { position: '0:0:0', drum: 'kick', velocity: 0.8 },
        { position: '0:2:0', drum: 'kick', velocity: 0.8 },
      ],
      loopLength: 1
    };

    // Verse - full pattern
    const versePattern = currentPattern;

    // Chorus - more intense
    const chorusPattern: DrumPattern = {
      id: nanoid(),
      events: [
        { position: '0:0:0', drum: 'kick', velocity: 0.9 },
        { position: '0:0:2', drum: 'kick', velocity: 0.7 },
        { position: '0:1:0', drum: 'snare', velocity: 0.8 },
        { position: '0:2:0', drum: 'kick', velocity: 0.9 },
        { position: '0:2:2', drum: 'kick', velocity: 0.7 },
        { position: '0:3:0', drum: 'snare', velocity: 0.8 },
        { position: '0:3:2', drum: 'hihat', velocity: 0.5 },
      ],
      loopLength: 1
    };

    // Create regions for song structure
    createRegionFromPattern(introPattern, {
      name: 'Intro',
      startPosition: '0:0:0',
      duration: '4:0:0',
      loopCount: 1
    });

    createRegionFromPattern(versePattern, {
      name: 'Verse 1',
      startPosition: '4:0:0',
      duration: '8:0:0',
      loopCount: 1
    });

    createRegionFromPattern(chorusPattern, {
      name: 'Chorus',
      startPosition: '12:0:0',
      duration: '8:0:0',
      loopCount: 1
    });

    createRegionFromPattern(versePattern, {
      name: 'Verse 2',
      startPosition: '20:0:0',
      duration: '8:0:0',
      loopCount: 1
    });

  }, [track, currentPattern, createRegionFromPattern]);

  return (
    <div>
      <h3>New Approach (Region-Based)</h3>
      
      <div>
        <h4>Track: {track?.name}</h4>
        <button onClick={handleCreateRegion}>
          Create Region from Pattern
        </button>
        <button onClick={handleCreateArrangement}>
          Create Full Arrangement
        </button>
      </div>

      <div>
        <h4>Regions ({regions.length})</h4>
        {regions.map(region => (
          <div 
            key={region.id}
            style={{
              padding: '8px',
              margin: '4px',
              backgroundColor: selectedRegions.includes(region.id) ? '#e0e0e0' : '#f5f5f5',
              cursor: 'pointer'
            }}
            onClick={() => selectRegion(region.id)}
          >
            <strong>{region.name}</strong>
            <div>Start: {region.startPosition} | Duration: {region.duration}</div>
            <div>Loop: {region.loopCount === 0 ? 'Infinite' : `${region.loopCount}x`}</div>
            <button onClick={(e) => {
              e.stopPropagation();
              removeRegion(region.id);
            }}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Example 3: MIGRATION HELPER - Backward Compatibility
 * Shows how to support both old and new approaches during transition
 */
export function DrummerWidgetMigration() {
  const { track, migratePatternToRegion } = useTrack({
    trackId: 'drums-migration',
    name: 'Drums (Migration)',
    type: 'drums'
  });

  // Old pattern from legacy code
  const legacyPattern: DrumPattern = {
    id: 'legacy-pattern',
    events: [
      { position: '0:0:0', drum: 'kick', velocity: 0.8 },
      { position: '0:2:0', drum: 'snare', velocity: 0.6 },
    ],
    loopLength: 1
  };

  // Automatically migrate on mount
  useEffect(() => {
    if (track) {
      // This creates a region that behaves exactly like the old pattern system
      const region = migratePatternToRegion('drums-widget', legacyPattern);
      console.log('Migrated legacy pattern to region:', region);
    }
  }, [track, migratePatternToRegion]);

  return (
    <div>
      <h3>Migration Example</h3>
      <p>Legacy patterns are automatically converted to regions with infinite loop</p>
    </div>
  );
}

/**
 * Complete Example with All Approaches
 */
export function DrummerWidgetMigrationShowcase() {
  const [approach, setApproach] = useState<'old' | 'new' | 'migration'>('new');

  return (
    <div style={{ padding: '20px' }}>
      <h2>DrummerWidget Migration Example</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setApproach('old')}>Old Approach</button>
        <button onClick={() => setApproach('new')}>New Approach</button>
        <button onClick={() => setApproach('migration')}>Migration Helper</button>
      </div>

      {approach === 'old' && <DrummerWidgetOldApproach />}
      {approach === 'new' && <DrummerWidgetNewApproach />}
      {approach === 'migration' && <DrummerWidgetMigration />}

      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f0f0f0' }}>
        <h4>Benefits of the New Region System:</h4>
        <ul>
          <li>Timeline-based composition (like Logic/Ableton)</li>
          <li>Multiple patterns per track</li>
          <li>Precise start/stop positions</li>
          <li>Loop count control (not just infinite)</li>
          <li>Region muting and selection</li>
          <li>Future: MIDI event editing</li>
          <li>Future: Audio clip support</li>
        </ul>
      </div>
    </div>
  );
}