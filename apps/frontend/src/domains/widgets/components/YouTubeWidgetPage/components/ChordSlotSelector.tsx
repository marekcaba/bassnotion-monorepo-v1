'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

interface ChordSlotSelectorProps {
  value: string;
  onChange: (value: string) => void;
  isActive?: boolean;
  onFocus?: () => void;
}

// Root notes for the first reel
const rootNotes = [
  'C',
  'C♯',
  'D♭',
  'D',
  'D♯',
  'E♭',
  'E',
  'F',
  'F♯',
  'G♭',
  'G',
  'G♯',
  'A♭',
  'A',
  'A♯',
  'B♭',
  'B',
];

// Chord qualities for the second reel
const chordQualities = [
  { value: '', label: 'maj' },
  { value: 'm', label: 'm' },
  { value: '7', label: '7' },
  { value: 'maj7', label: 'M7' },
  { value: 'm7', label: 'm7' },
  { value: '9', label: '9' },
  { value: 'm9', label: 'm9' },
  { value: '11', label: '11' },
  { value: '13', label: '13' },
  { value: 'dim', label: 'dim' },
  { value: 'aug', label: 'aug' },
  { value: 'sus2', label: 'sus2' },
  { value: 'sus4', label: 'sus4' },
  { value: '6', label: '6' },
  { value: 'm6', label: 'm6' },
  { value: 'add9', label: 'add9' },
];

type SelectionState = 'default' | 'selecting-root' | 'selecting-quality';

export function ChordSlotSelector({
  value,
  onChange,
  isActive = false,
  onFocus,
}: ChordSlotSelectorProps) {
  const { correlationId, logger } = useCorrelation('ChordSlotSelector');
  const [selectedRoot, setSelectedRoot] = useState('');
  const currentRootRef = useRef('');
  const currentQualityRef = useRef('');
  const [selectedQuality, setSelectedQuality] = useState('');
  const [selectionState, setSelectionState] =
    useState<SelectionState>('default');

  const rootReelRef = useRef<HTMLDivElement>(null);
  const qualityReelRef = useRef<HTMLDivElement>(null);
  const rootDragging = useRef(false);
  const qualityDragging = useRef(false);
  const rootStartY = useRef(0);
  const qualityStartY = useRef(0);
  const rootStartScroll = useRef(0);
  const qualityStartScroll = useRef(0);

  // Parse current value - default state shows the complete chord
  useEffect(() => {
    logger.info('🎵 ChordSlotSelector: value prop changed to:', value);
    if (!value) {
      setSelectedRoot('');
      setSelectedQuality('');
      setSelectionState('default');
      return;
    }

    let root = '';
    let quality = '';

    if (
      value.length >= 2 &&
      (value[1] === '#' ||
        value[1] === '♯' ||
        value[1] === 'b' ||
        value[1] === '♭')
    ) {
      root = value.substring(0, 2);
      quality = value.substring(2);
    } else {
      root = value[0] || '';
      quality = value.substring(1);
    }

    // Normalize sharps and flats
    root = root.replace('#', '♯').replace('b', '♭');

    logger.info(
      '🎵 ChordSlotSelector: parsed root:',
      root,
      'quality:',
      quality,
    );
    setSelectedRoot(root);
    currentRootRef.current = root; // Keep ref in sync
    const qualityItem = chordQualities.find((q) => q.value === quality);
    const finalQuality = qualityItem ? qualityItem.value : '';
    setSelectedQuality(finalQuality);
    currentQualityRef.current = finalQuality; // Keep ref in sync
    setSelectionState('default');
  }, [value]);

  // Handle click to start chord editing
  const handleChordClick = () => {
    if (selectionState === 'default') {
      // Parse current chord and set initial selection
      let parsedRoot = '';
      let parsedQuality = '';

      if (value) {
        if (
          value.length >= 2 &&
          (value[1] === '#' ||
            value[1] === '♯' ||
            value[1] === 'b' ||
            value[1] === '♭')
        ) {
          parsedRoot = value.substring(0, 2);
          parsedQuality = value.substring(2);
        } else {
          parsedRoot = value[0] || '';
          parsedQuality = value.substring(1);
        }

        // Normalize sharps and flats
        parsedRoot = parsedRoot.replace('#', '♯').replace('b', '♭');

        // Find quality match
        const qualityItem = chordQualities.find(
          (q) => q.value === parsedQuality,
        );
        parsedQuality = qualityItem ? qualityItem.value : '';
      }

      setSelectedRoot(parsedRoot);
      currentRootRef.current = parsedRoot; // Keep ref in sync
      setSelectedQuality(parsedQuality);
      currentQualityRef.current = parsedQuality; // Keep ref in sync
      setSelectionState('selecting-root');
      if (onFocus) onFocus();

      // Scroll to current root position after state change
      setTimeout(() => {
        if (rootReelRef.current && parsedRoot) {
          const rootIndex = rootNotes.findIndex((note) => note === parsedRoot);
          if (rootIndex !== -1) {
            const middleSetIndex = rootNotes.length + rootIndex; // Use middle set
            rootReelRef.current.scrollTop = middleSetIndex * 24;
          }
        }
      }, 0);
    }
  };

  // Handle root selection
  const handleRootSelect = (root: string) => {
    logger.info('🎵 ChordSlotSelector: Root selected:', root);
    setSelectedRoot(root);
    currentRootRef.current = root; // Store in ref for immediate access
    setSelectionState('selecting-quality');

    // Scroll to current quality position after state change
    setTimeout(() => {
      if (qualityReelRef.current) {
        const currentQuality = currentQualityRef.current;
        let qualityIndex = chordQualities.findIndex(
          (q) => q.value === currentQuality,
        );
        // If no quality is selected, default to first quality (major)
        if (qualityIndex === -1) {
          qualityIndex = 0;
        }
        const middleSetIndex = chordQualities.length + qualityIndex; // Use middle set
        qualityReelRef.current.scrollTop = middleSetIndex * 24;
        logger.info(
          '🎵 ChordSlotSelector: Scrolled to quality:',
          currentQuality || 'default',
          'at index',
          qualityIndex,
        );
      }
    }, 0);
  };

  // Handle quality selection
  const handleQualitySelect = (quality: string) => {
    setSelectedQuality(quality);
    // Use the current selectedRoot from state, but if it's empty, get it from the current value
    let currentRoot = selectedRoot;
    if (!currentRoot && value) {
      // Parse the current value to get the root
      if (
        value.length >= 2 &&
        (value[1] === '#' ||
          value[1] === '♯' ||
          value[1] === 'b' ||
          value[1] === '♭')
      ) {
        currentRoot = value.substring(0, 2);
      } else {
        currentRoot = value[0] || '';
      }
      currentRoot = currentRoot.replace('#', '♯').replace('b', '♭');
    }

    const newChord = currentRoot + quality;
    logger.info(
      '🎵 ChordSlotSelector: Complete chord constructed:',
      newChord,
      'from root:',
      currentRoot,
      'quality:',
      quality,
    );
    onChange(newChord);
    setSelectionState('default');
  };

  // Handle quality selection with explicit root (for snap operations)
  const handleQualitySelectWithRoot = (quality: string, root: string) => {
    setSelectedQuality(quality);
    const newChord = root + quality;
    logger.info(
      '🎵 ChordSlotSelector: Complete chord constructed with explicit root:',
      newChord,
      'from root:',
      root,
      'quality:',
      quality,
    );
    onChange(newChord);
    setSelectionState('default');
  };

  // Snap to nearest item
  const snapToItem = (reel: 'root' | 'quality', scrollTop: number) => {
    const itemHeight = 24;
    const nearestIndex = Math.round(scrollTop / itemHeight);
    const snappedPosition = nearestIndex * itemHeight;

    if (reel === 'root') {
      const index = nearestIndex % rootNotes.length;
      const adjustedIndex = index < 0 ? rootNotes.length + index : index;
      const newRoot = rootNotes[adjustedIndex];
      logger.info('🎵 ChordSlotSelector: Snapping to root:', newRoot);
      handleRootSelect(newRoot);
      if (rootReelRef.current) {
        rootReelRef.current.scrollTop = snappedPosition;
      }
    } else {
      const index = nearestIndex % chordQualities.length;
      const adjustedIndex = index < 0 ? chordQualities.length + index : index;
      const newQuality = chordQualities[adjustedIndex].value;
      const currentRoot = currentRootRef.current; // Use ref for immediate access
      logger.info(
        '🎵 ChordSlotSelector: Snapping to quality:',
        newQuality,
        'with root:',
        currentRoot,
      );
      // Pass the current root from ref to avoid async state issues
      handleQualitySelectWithRoot(newQuality, currentRoot);
      if (qualityReelRef.current) {
        qualityReelRef.current.scrollTop = snappedPosition;
      }
    }
  };

  // Mouse handlers for root reel
  const handleRootMouseDown = (e: React.MouseEvent) => {
    rootDragging.current = true;
    rootStartY.current = e.clientY;
    rootStartScroll.current = rootReelRef.current?.scrollTop || 0;
    e.preventDefault();
  };

  const handleRootMouseMove = (e: MouseEvent) => {
    if (!rootDragging.current || !rootReelRef.current) return;
    const deltaY = e.clientY - rootStartY.current;
    rootReelRef.current.scrollTop = rootStartScroll.current - deltaY;
  };

  const handleRootMouseUp = () => {
    if (!rootDragging.current || !rootReelRef.current) return;
    rootDragging.current = false;
    snapToItem('root', rootReelRef.current.scrollTop);
  };

  // Mouse handlers for quality reel
  const handleQualityMouseDown = (e: React.MouseEvent) => {
    if (selectionState !== 'selecting-quality') return;
    qualityDragging.current = true;
    qualityStartY.current = e.clientY;
    qualityStartScroll.current = qualityReelRef.current?.scrollTop || 0;
    e.preventDefault();
  };

  const handleQualityMouseMove = (e: MouseEvent) => {
    if (!qualityDragging.current || !qualityReelRef.current) return;
    const deltaY = e.clientY - qualityStartY.current;
    qualityReelRef.current.scrollTop = qualityStartScroll.current - deltaY;
  };

  const handleQualityMouseUp = () => {
    if (!qualityDragging.current || !qualityReelRef.current) return;
    qualityDragging.current = false;
    snapToItem('quality', qualityReelRef.current.scrollTop);
  };

  // Global mouse event listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handleRootMouseMove(e);
      handleQualityMouseMove(e);
    };

    const handleMouseUp = () => {
      handleRootMouseUp();
      handleQualityMouseUp();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Create repeated items for infinite scroll effect
  const repeatedRoots = [...rootNotes, ...rootNotes, ...rootNotes];
  const repeatedQualities = [
    ...chordQualities,
    ...chordQualities,
    ...chordQualities,
  ];

  // Get background color based on state
  const getBackgroundColor = () => {
    switch (selectionState) {
      case 'default':
        return '#3b82f6'; // Blue - default state
      case 'selecting-root':
        return '#fb923c'; // Orange - selecting root
      case 'selecting-quality':
        return '#eab308'; // Yellow - selecting quality
      default:
        return '#1e293b'; // Gray - inactive
    }
  };

  return (
    <div
      className={`relative w-12 h-8 rounded-md overflow-hidden transition-all duration-300 ${
        isActive
          ? 'shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.2)]'
          : 'shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)]'
      }`}
      style={{
        background: getBackgroundColor(),
        cursor: selectionState === 'default' ? 'pointer' : 'grab',
      }}
      onClick={selectionState === 'default' ? handleChordClick : undefined}
    >
      {/* Default state - show complete chord */}
      {selectionState === 'default' && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-black font-bold">
          {value || '—'}
        </div>
      )}

      {/* Root selection state - show root note spinner */}
      {selectionState === 'selecting-root' && (
        <div
          ref={rootReelRef}
          className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={handleRootMouseDown}
        >
          <div
            className="relative"
            style={{ paddingTop: '4px', paddingBottom: '4px' }}
          >
            {repeatedRoots.map((note, index) => (
              <div
                key={`root-${index}`}
                className={`h-6 flex items-center justify-center text-xs font-mono font-bold transition-all duration-200 ${
                  note === selectedRoot ? 'text-black' : 'text-black/60'
                }`}
                style={{
                  transform:
                    note === selectedRoot ? 'scale(1.1)' : 'scale(0.9)',
                }}
              >
                {note}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quality selection state - show quality spinner */}
      {selectionState === 'selecting-quality' && (
        <div
          ref={qualityReelRef}
          className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={handleQualityMouseDown}
        >
          <div
            className="relative"
            style={{ paddingTop: '4px', paddingBottom: '4px' }}
          >
            {repeatedQualities.map((quality, index) => (
              <div
                key={`quality-${index}`}
                className={`h-6 flex items-center justify-center text-xs font-mono font-bold transition-all duration-200 ${
                  quality.value === selectedQuality
                    ? 'text-black'
                    : 'text-black/60'
                }`}
                style={{
                  transform:
                    quality.value === selectedQuality
                      ? 'scale(1.1)'
                      : 'scale(0.9)',
                }}
              >
                {quality.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Center line indicator - only show during selection */}
      {selectionState !== 'default' && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-white/20 pointer-events-none" />
      )}
    </div>
  );
}
