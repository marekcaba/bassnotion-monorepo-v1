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
  maxMeasuresPerSystem = 2,
}: SheetMusicDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualWidth, setActualWidth] = useState(width || 700);

  // Calculate number of measures from notes
  const calculateMeasures = () => {
    if (notes.length === 0) return 1;
    const maxMeasure = Math.max(...notes.map(n => n.position?.measure || 1));
    return maxMeasure;
  };

  const totalMeasures = calculateMeasures();
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
          // renderSingleHorizontalStaffline: true, // DISABLED - testing if this causes duplication
        });

        // Disable OSMD auto-beaming - we use manual beam tags in MusicXML for precise control
        osmd.EngravingRules.AutoBeamNotes = false;

        // Minimize page margins to reduce internal padding
        osmd.EngravingRules.PageLeftMargin = 0.1; // Near-zero left margin
        osmd.EngravingRules.PageRightMargin = 0.1;
        osmd.EngravingRules.PageTopMargin = 0.5;
        osmd.EngravingRules.PageBottomMargin = 0.5;

        // Force single horizontal line - no line breaks
        // Note: MaxMeasureToDrawIndex uses 0-based indexing, but if totalMeasures=1, it would render 2 measures (0 and 1)
        // So we subtract 1. But actually, let's not limit it at all - the MusicXML already has the correct number of measures
        // osmd.EngravingRules.MaxMeasureToDrawIndex = totalMeasures - 1;
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
  }, [notesKey, bpm, timeSignatureKey, title, maxMeasuresPerSystem]);

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
