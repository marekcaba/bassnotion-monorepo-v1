'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import type { ExerciseNote, TimeSignature } from '@bassnotion/contracts';
import { exerciseToMusicXML } from '../../utils/exerciseToMusicXML.js';
import { useNotePositionMap } from './hooks/useNotePositionMap.js';
import type { TransportPosition } from './utils/positionMapBuilder.js';

interface SheetMusicDisplayProps {
  notes: ExerciseNote[];
  bpm: number;
  timeSignature: TimeSignature;
  title?: string;
  currentNoteIndex?: number; // For playback highlighting (legacy)
  isPlaying?: boolean; // Whether playback is active - controls cursor visibility
  currentBar?: number; // Current bar/measure number (0-indexed) for cursor position (legacy)
  currentPosition?: TransportPosition; // Full transport position with beat-level precision
  onReady?: () => void;
  width?: number; // Parent container width - will be used to calculate optimal size
  height?: number; // Base height per system
  maxMeasuresPerSystem?: number; // Maximum measures per line (default: 2)
  totalBars?: number; // Total number of measures/bars in the exercise
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
  isPlaying = false,
  currentBar,
  currentPosition,
  onReady,
  width,
  height = 150,
  maxMeasuresPerSystem = 2,
  totalBars,
}: SheetMusicDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualWidth, setActualWidth] = useState(width || 700);

  // Memoize notes key for position map rebuild detection
  const notesKey = useMemo(() => JSON.stringify(notes), [notes]);

  // State for continuous scroll (teleprompter style)
  const [isAutoScrollDisabled, setIsAutoScrollDisabled] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const lastManualScrollTime = useRef<number>(0);

  // Enable auto-scroll (called when user clicks resume button or playback restarts)
  const enableAutoScroll = useCallback(() => {
    setIsAutoScrollDisabled(false);
  }, []);

  // Position map hook for accurate note-level scrolling
  const { getX, isMapReady, positionMap } = useNotePositionMap({
    osmdRef,
    isReady: !isLoading,
    notesKey,
    beatsPerMeasure: timeSignature.numerator,
  });

  // Calculate number of measures from notes
  const calculateMeasures = () => {
    if (notes.length === 0) return 1;
    const maxMeasure = Math.max(...notes.map((n) => n.position?.measure || 1));
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
  // Use stringified keys to prevent re-renders from reference changes
  const timeSignatureKey = useMemo(
    () => JSON.stringify(timeSignature),
    [timeSignature],
  );

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
          totalBars,
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

          // Cursor disabled - we use calculated bar-based scrolling (teleprompter style)
          // instead of tracking OSMD cursor DOM positions
          disableCursor: true,

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
        // This ensures all measures render on ONE system with horizontal scrolling
        osmd.EngravingRules.NewSystemAtXMLNewSystemAttribute = false; // Ignore system breaks in MusicXML
        osmd.EngravingRules.NewPageAtXMLNewPageAttribute = false; // Ignore page breaks in MusicXML

        // Use DYNAMIC spacing - let OSMD calculate optimal spacing per note duration
        // This gives natural, professional-looking notation
        osmd.EngravingRules.FixedMeasureWidth = false;

        // Voice spacing control (0.85 = 15% tighter than default for compact look)
        osmd.EngravingRules.VoiceSpacingMultiplierVexflow = 0.85;
        osmd.EngravingRules.VoiceSpacingAddendVexflow = 0;

        // Minimum distance between notes (in units)
        osmd.EngravingRules.MinNoteDistance = 3;

        // Keep single horizontal line (no system breaks)
        osmd.EngravingRules.RenderSingleHorizontalStaffline = true;

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
        setError(
          err instanceof Error ? err.message : 'Failed to render sheet music',
        );
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

  // PAGE-FLIP STYLE SCROLL with EASE-IN-OUT ANIMATION
  // Instead of continuous scrolling, the sheet stays still until the playhead reaches 75%
  // of the viewport, then quickly scrolls to move that position to the left edge.
  // Animation uses cubic ease-in-out for smooth acceleration and deceleration.
  const currentScrollRef = useRef<number>(0);
  const targetScrollRef = useRef<number>(0);
  const scrollParamsRef = useRef<{
    containerCenter: number;
    maxScroll: number;
    paddingLeft: number;
    totalScrollableWidth: number;
    totalDurationMs: number;
    beatsPerMeasure: number;
    msPerBeat: number;
  } | null>(null);

  // Page-flip animation state
  const isPageFlippingRef = useRef<boolean>(false);
  const pageFlipStartTimeRef = useRef<number>(0);
  const pageFlipStartScrollRef = useRef<number>(0);
  const pageFlipTargetScrollRef = useRef<number>(0);
  const lastScrollTriggerXRef = useRef<number>(0); // Track last position that triggered a flip

  // Reset-to-start animation state (separate from page-flip, runs on playback start)
  const isResettingRef = useRef<boolean>(false);
  const resetAnimationFrameRef = useRef<number | null>(null);

  // Update scroll parameters when layout changes (but NOT on every position update)
  useEffect(() => {
    const scrollContainer = parentRef.current;
    if (!scrollContainer || !isMapReady || !positionMap) {
      scrollParamsRef.current = null;
      return;
    }

    const containerWidth = scrollContainer.clientWidth;
    const contentWidth = scrollContainer.scrollWidth;
    const paddingLeft = 30;
    const paddingRight = 30;
    const totalPadding = paddingLeft + paddingRight;
    const osmdRenderWidth = contentWidth - totalPadding;

    const measureCount = totalBars || 4;
    const beatsPerMeasure = timeSignature.numerator;
    const totalBeats = measureCount * beatsPerMeasure;
    const msPerBeat = 60000 / bpm;

    scrollParamsRef.current = {
      containerCenter: containerWidth / 2,
      maxScroll: Math.max(0, contentWidth - containerWidth),
      paddingLeft,
      totalScrollableWidth: osmdRenderWidth,
      totalDurationMs: totalBeats * msPerBeat,
      beatsPerMeasure,
      msPerBeat,
    };
  }, [isMapReady, positionMap, totalBars, bpm, timeSignature.numerator]);

  // Store current position in a ref so the animation loop can access latest value
  // without causing effect re-runs
  const currentPositionRef = useRef(currentPosition);
  useEffect(() => {
    currentPositionRef.current = currentPosition;
  }, [currentPosition]);

  // Cubic ease-in-out function for smooth acceleration and deceleration
  // t < 0.5: acceleration phase (ease-in)
  // t >= 0.5: deceleration phase (ease-out)
  const easeInOutCubic = useCallback((t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }, []);

  // Main animation loop - PAGE-FLIP style scroll
  // Sheet stays still until playhead crosses 75% threshold, then quickly scrolls
  // with ease-in-out animation to move that position to the left edge
  useEffect(() => {
    // Cancel any existing animation frame
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Don't scroll when not playing
    if (!isPlaying) {
      // Reset page flip state when playback stops
      isPageFlippingRef.current = false;
      return;
    }

    // Skip if auto-scroll is disabled (user manually scrolled)
    if (isAutoScrollDisabled) {
      return;
    }

    const scrollContainer = parentRef.current;
    if (!scrollContainer) {
      return;
    }

    // Page flip animation duration (ms) - slower for more noticeable, elegant flip
    const PAGE_FLIP_DURATION = 1000; // 1000ms for smooth, visible page flip

    // Performance monitoring (logs every 300 frames)
    let frameCount = 0;
    let totalDeltaTime = 0;
    let minDeltaTime = Infinity;
    let maxDeltaTime = 0;
    let lastFrameTime = performance.now();

    // Animation loop - handles both idle monitoring and page-flip animation
    const animate = () => {
      const now = performance.now();
      const deltaTime = now - lastFrameTime;
      lastFrameTime = now;

      // Track performance stats
      frameCount++;
      totalDeltaTime += deltaTime;
      minDeltaTime = Math.min(minDeltaTime, deltaTime);
      maxDeltaTime = Math.max(maxDeltaTime, deltaTime);

      // Reset performance stats every 300 frames to keep tracking fresh
      if (frameCount >= 300) {
        frameCount = 0;
        totalDeltaTime = 0;
        minDeltaTime = Infinity;
        maxDeltaTime = 0;
      }

      const params = scrollParamsRef.current;
      const pos = currentPositionRef.current;

      // Skip if params not ready, auto-scroll disabled, or reset animation is running
      if (!params || isAutoScrollDisabled || isResettingRef.current) {
        if (isPlaying && !isAutoScrollDisabled) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
        return;
      }

      // Calculate current playhead X position from transport
      let progressMs = 0;
      if (pos && pos.bars >= 0) {
        const elapsedBars = pos.bars;
        const elapsedBeatsInCurrentBar = pos.beats - 1;
        const tickFraction = pos.ticks / 960;
        const totalElapsedBeats =
          elapsedBars * params.beatsPerMeasure +
          elapsedBeatsInCurrentBar +
          tickFraction;
        progressMs = totalElapsedBeats * params.msPerBeat;
      }

      const progressRatio = Math.min(progressMs / params.totalDurationMs, 1);
      const targetXInSheet = progressRatio * params.totalScrollableWidth;
      const playheadXAbsolute = params.paddingLeft + targetXInSheet;

      // Calculate playhead position RELATIVE to current scroll (viewport position)
      const playheadXInViewport = playheadXAbsolute - currentScrollRef.current;

      // 100% threshold for triggering page flip (right edge of viewport)
      const scrollThreshold = params.containerCenter * 2;

      // STATE MACHINE: Either animating a page flip OR monitoring for threshold crossing
      if (isPageFlippingRef.current) {
        // === ANIMATING PAGE FLIP ===
        const elapsed = now - pageFlipStartTimeRef.current;
        const progress = Math.min(elapsed / PAGE_FLIP_DURATION, 1);
        const easedProgress = easeInOutCubic(progress);

        // Interpolate from start to target using eased progress
        const scrollDiff =
          pageFlipTargetScrollRef.current - pageFlipStartScrollRef.current;
        currentScrollRef.current =
          pageFlipStartScrollRef.current + scrollDiff * easedProgress;

        // Apply scroll position
        scrollContainer.scrollLeft = currentScrollRef.current;

        // Check if animation complete
        if (progress >= 1) {
          console.log('[PAGE-FLIP] Animation complete', {
            finalScroll: currentScrollRef.current.toFixed(2),
            target: pageFlipTargetScrollRef.current.toFixed(2),
          });
          isPageFlippingRef.current = false;
          // Update last trigger position to current playhead position
          lastScrollTriggerXRef.current = playheadXAbsolute;
        }
      } else {
        // === MONITORING FOR THRESHOLD CROSSING ===
        // Check if playhead has crossed into the trigger zone (past 75% of viewport)
        // AND has moved forward since last trigger (prevents re-triggering at same spot)
        const hasPassedThreshold = playheadXInViewport > scrollThreshold;
        const hasMovedForwardSinceTrigger =
          playheadXAbsolute > lastScrollTriggerXRef.current + 10; // 10px hysteresis

        if (hasPassedThreshold && hasMovedForwardSinceTrigger) {
          // TRIGGER PAGE FLIP!
          // Target: move content so current playhead position lands at 80px from left edge
          // This gives some buffer space for reading context
          const FLIP_TARGET_OFFSET = 130; // Playhead lands 130px from left edge after flip
          const targetScroll = Math.max(
            0,
            Math.min(
              playheadXAbsolute - FLIP_TARGET_OFFSET, // Move playhead to 80px from left
              params.maxScroll,
            ),
          );

          console.log('[PAGE-FLIP] Triggered!', {
            playheadXInViewport: playheadXInViewport.toFixed(2),
            threshold: scrollThreshold.toFixed(2),
            currentScroll: currentScrollRef.current.toFixed(2),
            targetScroll: targetScroll.toFixed(2),
            scrollDistance: (targetScroll - currentScrollRef.current).toFixed(
              2,
            ),
          });

          // Initialize page flip animation
          isPageFlippingRef.current = true;
          pageFlipStartTimeRef.current = now;
          pageFlipStartScrollRef.current = currentScrollRef.current;
          pageFlipTargetScrollRef.current = targetScroll;
          lastScrollTriggerXRef.current = playheadXAbsolute;
        }
        // No scroll update when not flipping - sheet stays still
      }

      // Continue animation loop while playing
      if (isPlaying && !isAutoScrollDisabled) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    // Initialize scroll state when starting playback
    currentScrollRef.current = scrollContainer.scrollLeft;
    lastScrollTriggerXRef.current = 0; // Reset trigger tracking
    isPageFlippingRef.current = false;

    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, isAutoScrollDisabled, easeInOutCubic]); // NO currentPosition dependency!

  // Detect manual scroll (user touching/dragging the sheet)
  useEffect(() => {
    const scrollContainer = parentRef.current;
    if (!scrollContainer) return;

    let isUserScrolling = false;
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      // If we're playing and the scroll wasn't initiated by us, it's a manual scroll
      if (isPlaying && animationFrameRef.current !== null) {
        // Debounce to detect end of manual scroll gesture
        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
        }

        // Check if this looks like a user scroll (significant deviation from expected position)
        // We use a small threshold to avoid false positives from rounding errors
        scrollTimeout = setTimeout(() => {
          // If user scrolled while we were animating, disable auto-scroll
          const timeSinceLastManualScroll =
            performance.now() - lastManualScrollTime.current;
          if (timeSinceLastManualScroll < 200) {
            // Recent manual scroll detected
            setIsAutoScrollDisabled(true);
          }
        }, 100);

        lastManualScrollTime.current = performance.now();
      }
    };

    // Use wheel event for more reliable manual scroll detection
    const handleWheel = () => {
      if (isPlaying) {
        setIsAutoScrollDisabled(true);
      }
    };

    // Touch events for mobile
    const handleTouchStart = () => {
      if (isPlaying) {
        setIsAutoScrollDisabled(true);
      }
    };

    scrollContainer.addEventListener('wheel', handleWheel, { passive: true });
    scrollContainer.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    });

    return () => {
      scrollContainer.removeEventListener('wheel', handleWheel);
      scrollContainer.removeEventListener('touchstart', handleTouchStart);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [isPlaying]);

  // Re-enable auto-scroll and animate reset to start when playback begins
  // OPTIMIZED: Only runs when isPlaying changes, not on every position update
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    // Detect transition from not playing to playing
    if (isPlaying && !wasPlayingRef.current) {
      // Re-enable auto-scroll when playback starts
      enableAutoScroll();

      // Animate scroll back to beginning when playback starts (if not already at start)
      const scrollContainer = parentRef.current;
      if (scrollContainer && scrollContainer.scrollLeft > 10) {
        // Use same animation duration as page-flip for consistency
        const RESET_ANIMATION_DURATION = 1000;

        // Cancel any existing reset animation
        if (resetAnimationFrameRef.current !== null) {
          cancelAnimationFrame(resetAnimationFrameRef.current);
        }

        // Initialize reset animation state
        isResettingRef.current = true;
        const resetStartTime = performance.now();
        const resetStartScroll = scrollContainer.scrollLeft;
        const resetTargetScroll = 0;

        // Reset animation loop
        const animateReset = (now: number) => {
          if (!isResettingRef.current) {
            return; // Animation was cancelled
          }

          const elapsed = now - resetStartTime;
          const progress = Math.min(elapsed / RESET_ANIMATION_DURATION, 1);

          // Use same cubic ease-in-out as page-flip
          const easedProgress =
            progress < 0.5
              ? 4 * progress * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 3) / 2;

          // Interpolate from start to target
          const currentScroll =
            resetStartScroll +
            (resetTargetScroll - resetStartScroll) * easedProgress;

          // Apply scroll position
          if (scrollContainer) {
            scrollContainer.scrollLeft = currentScroll;
            currentScrollRef.current = currentScroll;
          }

          // Check if animation complete
          if (progress >= 1) {
            isResettingRef.current = false;
            currentScrollRef.current = 0;
            lastScrollTriggerXRef.current = 0;
          } else {
            // Continue animation
            resetAnimationFrameRef.current =
              requestAnimationFrame(animateReset);
          }
        };

        // Start reset animation
        resetAnimationFrameRef.current = requestAnimationFrame(animateReset);
      } else if (scrollContainer) {
        // Already at start, just reset refs
        currentScrollRef.current = 0;
        lastScrollTriggerXRef.current = 0;
      }
    }
    wasPlayingRef.current = isPlaying;

    // Cleanup reset animation on unmount or when isPlaying changes
    return () => {
      if (resetAnimationFrameRef.current !== null) {
        cancelAnimationFrame(resetAnimationFrameRef.current);
        resetAnimationFrameRef.current = null;
      }
      isResettingRef.current = false;
    };
  }, [isPlaying, enableAutoScroll]);

  // Legacy playback highlighting (keeping for compatibility)
  useEffect(() => {
    if (!osmdRef.current || currentNoteIndex === undefined) return;
    // currentNoteIndex is legacy - use currentBar instead
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
        // GPU acceleration for smooth scrolling
        willChange: 'scroll-position',
        transform: 'translateZ(0)',
        // Prevent browser smooth scrolling from interfering with our JS animation
        scrollBehavior: 'auto',
      }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <div className="text-sm text-gray-600">Loading sheet music...</div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50">
          <div className="text-sm text-red-600">Error: {error}</div>
        </div>
      )}

      {/* Resume Auto-Scroll button - shown when user manually scrolled during playback */}
      {isPlaying && isAutoScrollDisabled && (
        <button
          onClick={enableAutoScroll}
          className="absolute top-2 right-2 z-10 px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded shadow-md transition-colors"
          style={{ fontSize: '10px' }}
        >
          Resume Auto-Scroll
        </button>
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
