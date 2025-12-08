'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import type { ExerciseNote, TimeSignature } from '@bassnotion/contracts';
import { exerciseToMusicXML } from '../../utils/exerciseToMusicXML.js';

interface SheetMusicDisplayProps {
  notes: ExerciseNote[];
  bpm: number;
  timeSignature: TimeSignature;
  title?: string;
  currentNoteIndex?: number; // For playback highlighting
  onReady?: () => void;
  width?: number; // Parent container width - will be used to calculate optimal size
  height?: number; // Base height per system
  maxMeasuresPerSystem?: number; // Maximum measures per line (default: 2)
  totalBars?: number; // Total number of bars from exercise metadata
}

/**
 * SheetMusicDisplay Component
 *
 * Renders professional music notation using OpenSheetMusicDisplay (OSMD)
 *
 * Features:
 * - Automatic professional notation rendering (beaming, stem directions, etc.)
 * - Bass clef with proper octave transposition
 * - Playback cursor support
 * - Responsive sizing
 */
export function SheetMusicDisplay({
  notes,
  bpm,
  timeSignature,
  title,
  currentNoteIndex,
  onReady,
  width,
  height = 150,
  maxMeasuresPerSystem = undefined, // No limit - all measures in one system
  totalBars, // Total bars from exercise metadata
}: SheetMusicDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualWidth, setActualWidth] = useState(width || 700);

  // Calculate number of measures - use totalBars from exercise metadata if available
  const calculateMeasures = () => {
    // If totalBars is provided from exercise metadata, use it as source of truth
    if (totalBars !== undefined && totalBars > 0) {
      return totalBars;
    }

    // Fallback: calculate from notes (handles 0-based indexing)
    if (notes.length === 0) return 1;
    const maxMeasure = Math.max(...notes.map(n => n.position?.measure || 1));
    // If max measure is 0-based (e.g., 0,1,2,3...), add 1 to get total count
    // If max measure is small relative to notes, assume 0-based
    const measuresFromNotes = maxMeasure < notes.length ? maxMeasure + 1 : maxMeasure;
    return measuresFromNotes;
  };

  const totalMeasures = calculateMeasures();
  console.log('[SheetMusicDisplay] totalBars prop:', totalBars, 'calculated totalMeasures:', totalMeasures);
  // Single system - all measures on one horizontal line
  const calculatedHeight = height;

  // Measure parent container width if width is not provided
  useEffect(() => {
    if (!width && parentRef.current) {
      const parentWidth = parentRef.current.offsetWidth;
      setActualWidth(parentWidth);
    }
  }, [width]);

  // Initialize OSMD and render sheet music
  // Use stringified notes to prevent re-renders from array reference changes
  const notesKey = useMemo(() => JSON.stringify(notes), [notes]);
  const timeSignatureKey = useMemo(() => JSON.stringify(timeSignature), [timeSignature]);

  useEffect(() => {
    if (!containerRef.current || notes.length === 0) return;

    // Track if this effect is still active (for cleanup)
    let isActive = true;

    const initializeOSMD = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // CRITICAL: Clear previous content BEFORE creating new OSMD instance
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        // If effect was canceled during async operation, abort
        if (!isActive) {
          return;
        }

        // Convert exercise notes to MusicXML
        const musicXML = exerciseToMusicXML({
          notes,
          bpm,
          timeSignature,
          title,
          maxMeasuresPerSystem,
          totalBars, // Pass exercise's total bar count
        });

        // MusicXML generated

        // Create new OSMD instance
        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          // Backend: Use SVG for better quality and interactivity
          backend: 'svg',

          // Render options
          drawTitle: false, // We'll handle title in React if needed
          drawComposer: false,
          drawCredits: false,

          // Layout options
          autoResize: false, // We'll handle sizing manually for consistency

          // Performance options
          drawPartNames: false,
          drawMeasureNumbers: false,

          // Quality options
          renderSingleHorizontalStaffline: true, // Force single horizontal line - no system breaks
        });

        // Disable OSMD auto-beaming - we use manual beam tags in MusicXML for precise control
        osmd.EngravingRules.AutoBeamNotes = false;

        // FONT CONFIGURATION NOTE:
        // OSMD 1.9.x uses VexFlow 1.2.93 internally, which only supports Bravura font.
        // Petaluma (jazz/handwritten style) requires VexFlow 4.x which is coming in
        // a future OSMD release (currently on feat/vexflow4 branch).
        // Once OSMD updates to VexFlow 4.x, uncomment the line below:
        // osmd.EngravingRules.DefaultVexFlowNoteFont = 'petaluma';

        // Minimize page margins to reduce internal padding
        osmd.EngravingRules.PageLeftMargin = 0.1; // Near-zero left margin
        osmd.EngravingRules.PageRightMargin = 0.1;
        osmd.EngravingRules.PageTopMargin = 0.5;
        osmd.EngravingRules.PageBottomMargin = 0.5;

        // Force single horizontal line - no line breaks
        // Set very large page width to prevent OSMD from auto-breaking into multiple systems
        osmd.EngravingRules.PageWidth = 10000; // Large enough to fit all measures on one line

        // Force OSMD to fit all measures on one line by making measures very compact
        osmd.EngravingRules.MinMeasureWidth = 10; // Very small minimum width
        osmd.EngravingRules.MinimumDistanceBetweenSystems = 1;
        osmd.EngravingRules.SystemLabelsRightMargin = 0;
        osmd.EngravingRules.SystemComposerDistance = 0;

        // Explicitly set MaxMeasureToDrawIndex to ensure all measures render
        // OSMD uses 0-based indexing, so for 8 measures we need index 7
        osmd.EngravingRules.MaxMeasureToDrawIndex = totalMeasures - 1;
        console.log('[SheetMusic] Setting MaxMeasureToDrawIndex to:', totalMeasures - 1, 'for', totalMeasures, 'measures');

        osmd.EngravingRules.NewSystemAtXMLNewSystemAttribute = false; // Ignore system breaks
        osmd.EngravingRules.NewPageAtXMLNewPageAttribute = false;
        osmd.EngravingRules.MaxSystemToDrawNumber = 1; // Only render one system (horizontal line)

        osmdRef.current = osmd;

        // Load the MusicXML string
        await osmd.load(musicXML);

        // Set zoom level to make notation more compact
        // Adjust this value to fit the container width (536px)
        osmd.zoom = 0.9;

        // Render the score
        osmd.render();

        // Diagnostic: Check what OSMD actually rendered
        console.log('[SheetMusic DIAGNOSTIC] OSMD Rendering Info:');
        console.log('  - MaxSystemToDrawNumber:', osmd.EngravingRules.MaxSystemToDrawNumber);
        console.log('  - MaxMeasureToDrawIndex:', osmd.EngravingRules.MaxMeasureToDrawIndex);
        console.log('  - PageWidth:', osmd.EngravingRules.PageWidth);

        // Explore osmd.graphic structure (lowercase properties!)
        if (osmd.graphic) {
          const graphic = osmd.graphic as any;

          // Check musicPages (lowercase!)
          if (graphic.musicPages) {
            console.log('  - musicPages count:', graphic.musicPages.length);
            graphic.musicPages.forEach((page: any, i: number) => {
              if (page.musicSystems) {
                console.log(`    - Page ${i} has ${page.musicSystems.length} systems`);
                page.musicSystems.forEach((system: any, j: number) => {
                  const measures = system.staffLines?.[0]?.measures || [];
                  console.log(`      - System ${j}: ${measures.length} measures`);
                });
              }
            });
          }

          // Check measureList
          if (graphic.measureList) {
            console.log('  - measureList length:', graphic.measureList.length);
            console.log('  - measureList:', graphic.measureList);
          }
        }

        // Check osmd.sheet (lowercase properties!)
        if (osmd.sheet) {
          const sheet = osmd.sheet as any;
          if (sheet.sourceMeasures) {
            console.log('  - sourceMeasures count:', sheet.sourceMeasures.length);
          }
        }

        // Check if effect is still active after async render
        if (!isActive) {
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
          }
          return;
        }

        setIsLoading(false);
        onReady?.();
      } catch (err) {
        console.error('[SheetMusic] Error rendering:', err);
        setError(err instanceof Error ? err.message : 'Failed to render sheet music');
        setIsLoading(false);
      }
    };

    initializeOSMD();

    // Cleanup function
    return () => {
      isActive = false;

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      if (osmdRef.current) {
        osmdRef.current = null;
      }
    };
    // Use stringified keys to detect actual content changes, not reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesKey, bpm, timeSignatureKey, title, maxMeasuresPerSystem, totalBars]);

  // Handle playback highlighting
  useEffect(() => {
    if (!osmdRef.current || currentNoteIndex === undefined) return;

    try {
      // OSMD cursor API for highlighting current notes
      // This will be implemented in Phase 5
      console.log('[SheetMusic] Current note index:', currentNoteIndex);
    } catch (err) {
      console.error('[SheetMusic] Error highlighting note:', err);
    }
  }, [currentNoteIndex]);

  return (
    <div
      ref={parentRef}
      className="sheet-music-container scrollbar-hide"
      style={{
        width: width ? `${width}px` : '100%',
        height: `${calculatedHeight}px`,
        position: 'relative',
        overflow: 'auto', // Allow horizontal scrolling but hide scrollbar
      }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <div className="text-sm text-gray-600">Loading sheet music...</div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50">
          <div className="text-sm text-red-600">
            Error: {error}
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="osmd-container"
        style={{
          width: 'fit-content', // Let OSMD determine its natural width
          minWidth: '100%', // But at least full parent width
          height: '100%',
          display: 'flex',
          justifyContent: 'flex-start', // Left-align to show bass clef first
          alignItems: 'center',
          paddingLeft: '30px',
          paddingRight: '30px',
        }}
      />
    </div>
  );
}
