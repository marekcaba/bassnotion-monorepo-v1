'use client';

/**
 * DrumPatternEditorModal Component
 *
 * Main modal container for the drum pattern editor.
 * Integrates grid, transport controls, and toolbar.
 */

import React, { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { v4 as uuidv4 } from 'uuid';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Save, X, Trash2, Undo, Redo, ZoomIn, ZoomOut } from 'lucide-react';
import { DrumGrid } from './DrumGrid.js';
import { DrumEditorTransport } from './DrumEditorTransport.js';
import type { DrumPatternEditorModalProps, PatternMetadata, GridResolution } from './types.js';
import { useDrumEditorStore } from './hooks/useDrumEditorStore.js';
import {
  DEFAULT_EDITOR_SETTINGS,
  BAR_OPTIONS,
  GRID_RESOLUTION_OPTIONS,
  ZOOM_LIMITS,
} from './constants.js';
import { useDrumEditorPlayback } from './hooks/useDrumEditorPlayback.js';

/**
 * DrumPatternEditorModal Component
 */
export function DrumPatternEditorModal({
  isOpen,
  onClose,
  initialPattern,
  initialMetadata,
  onSave,
  contextTempo,
  contextTimeSignature,
}: DrumPatternEditorModalProps) {
  // Store state - use useShallow for objects/arrays to prevent infinite loops
  // Select all primitive values in a single useShallow call for efficiency
  const {
    patternName,
    bars,
    gridResolution,
    zoomLevel,
    snapEnabled,
    isPlaying,
    isLooping,
    previewTempo,
    currentPlayheadTick,
    isDirty,
    historyIndex,
    historyLength,
    patternLength,
  } = useDrumEditorStore(
    useShallow((state) => ({
      patternName: state.patternName,
      bars: state.bars,
      gridResolution: state.gridResolution,
      zoomLevel: state.zoomLevel,
      snapEnabled: state.snapEnabled,
      isPlaying: state.isPlaying,
      isLooping: state.isLooping,
      previewTempo: state.previewTempo,
      currentPlayheadTick: state.currentPlayheadTick,
      isDirty: state.isDirty,
      historyIndex: state.historyIndex,
      historyLength: state.history.length,
      patternLength: state.pattern.length,
    }))
  );

  // Use useShallow for the timeSignature object
  const timeSignature = useDrumEditorStore(
    useShallow((state) => state.timeSignature)
  );

  // Compute derived values from primitives (no selector needed)
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLength - 1;
  const isEmpty = patternLength === 0;

  // Audio playback hook
  const {
    state: playbackState,
    previewHit,
    play: playAudio,
    stop: stopAudio,
    playheadTick: audioPlayheadTick,
  } = useDrumEditorPlayback();

  // Local state for pattern name input
  const [localPatternName, setLocalPatternName] = React.useState(patternName);

  // Initialize store when modal opens
  // NOTE: We use getState() to avoid infinite loops from function reference changes
  useEffect(() => {
    if (isOpen) {
      const store = useDrumEditorStore.getState();
      if (initialPattern && initialPattern.length > 0) {
        store.loadPattern(initialPattern, {
          ...initialMetadata,
          tempo: contextTempo || initialMetadata?.tempo || DEFAULT_EDITOR_SETTINGS.tempo,
          timeSignature: contextTimeSignature || initialMetadata?.timeSignature || DEFAULT_EDITOR_SETTINGS.timeSignature,
        });
        setLocalPatternName(initialMetadata?.name || 'Untitled Pattern');
      } else {
        store.resetToInitial();
        if (contextTempo) store.setTempo(contextTempo);
        setLocalPatternName('Untitled Pattern');
      }
      useDrumEditorStore.getState().setZoomLevel(DEFAULT_EDITOR_SETTINGS.zoomLevel);
    }
  }, [isOpen, initialPattern, initialMetadata, contextTempo, contextTimeSignature]);

  // Handle save
  const handleSave = useCallback(() => {
    const store = useDrumEditorStore.getState();
    const metadata: PatternMetadata = {
      id: initialMetadata?.id || uuidv4(),
      name: localPatternName || 'Untitled Pattern',
      timeSignature: store.timeSignature,
      bars: store.bars,
      tempo: store.previewTempo,
      createdAt: initialMetadata?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    onSave(store.pattern, metadata);
    onClose();
  }, [localPatternName, initialMetadata, onSave, onClose]);

  // Handle close with confirmation if dirty
  const handleClose = useCallback(() => {
    const store = useDrumEditorStore.getState();
    if (store.isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close?'
      );
      if (!confirmed) return;
    }
    store.stop();
    onClose();
  }, [onClose]);

  // Handle clear pattern
  const handleClear = useCallback(() => {
    const confirmed = window.confirm(
      'Are you sure you want to clear all hits? This cannot be undone.'
    );
    if (confirmed) {
      useDrumEditorStore.getState().clearPattern();
    }
  }, []);

  // Store action callbacks (stable references using getState)
  // Play: start audio playback and update UI state
  const handlePlay = useCallback(() => {
    const store = useDrumEditorStore.getState();
    store.play(); // Update UI state
    // Start actual audio playback
    if (playbackState.isReady) {
      playAudio(store.pattern, store.previewTempo, store.isLooping);
    }
  }, [playbackState.isReady, playAudio]);

  // Stop: stop audio and update UI state
  const handleStop = useCallback(() => {
    useDrumEditorStore.getState().stop(); // Update UI state
    stopAudio(); // Stop audio playback
  }, [stopAudio]);
  const handleToggleLoop = useCallback(() => useDrumEditorStore.getState().toggleLoop(), []);
  const handleTempoChange = useCallback((tempo: number) => useDrumEditorStore.getState().setTempo(tempo), []);
  const handleUndo = useCallback(() => useDrumEditorStore.getState().undo(), []);
  const handleRedo = useCallback(() => useDrumEditorStore.getState().redo(), []);

  // Handle zoom - update store directly so pinch gestures and buttons stay in sync
  const handleZoomIn = useCallback(() => {
    const currentZoom = useDrumEditorStore.getState().zoomLevel;
    useDrumEditorStore.getState().setZoomLevel(
      Math.min(ZOOM_LIMITS.max, currentZoom + ZOOM_LIMITS.step)
    );
  }, []);

  const handleZoomOut = useCallback(() => {
    const currentZoom = useDrumEditorStore.getState().zoomLevel;
    useDrumEditorStore.getState().setZoomLevel(
      Math.max(ZOOM_LIMITS.min, currentZoom - ZOOM_LIMITS.step)
    );
  }, []);

  // Handle bars change
  const handleBarsChange = useCallback((value: string) => {
    useDrumEditorStore.getState().setBars(parseInt(value, 10));
  }, []);

  // Handle resolution change
  const handleResolutionChange = useCallback((value: string) => {
    useDrumEditorStore.getState().setGridResolution(value as GridResolution);
  }, []);

  // Sync audio playhead tick with store for UI display
  useEffect(() => {
    if (playbackState.isPlaying) {
      useDrumEditorStore.getState().setPlayheadTick(audioPlayheadTick);
    }
  }, [audioPlayheadTick, playbackState.isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const store = useDrumEditorStore.getState();

      if (e.key === ' ') {
        e.preventDefault();
        if (store.isPlaying) {
          handleStop();
        } else {
          handlePlay();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleSave, handleClose, handlePlay, handleStop]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      {/* Custom portal with higher z-index for nested modal */}
      <DialogPortal>
        <DialogOverlay className="z-[55] bg-black/80" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-[60] w-full max-w-6xl max-h-[90vh] translate-x-[-50%] translate-y-[-50%] flex flex-col gap-0 border border-zinc-700 bg-zinc-950 p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-xl"
        >
          {/* Close button */}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-zinc-950 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:pointer-events-none text-zinc-400 hover:text-zinc-100">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          <DialogHeader className="pb-4 border-b border-zinc-800">
            <DialogTitle className="flex items-center gap-4 text-zinc-100">
              <span className="text-lg font-semibold">Drum Pattern Editor</span>
              <Input
                value={localPatternName}
                onChange={(e) => setLocalPatternName(e.target.value)}
                placeholder="Pattern name"
                className="max-w-xs h-8 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-zinc-500"
              />
              {isDirty && (
                <span className="text-xs text-amber-400 font-medium">• Unsaved</span>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-4 py-3 border-b border-zinc-800">
            {/* Transport Controls */}
            <DrumEditorTransport
              isPlaying={isPlaying}
              isLooping={isLooping}
              tempo={previewTempo}
              onPlay={handlePlay}
              onStop={handleStop}
              onToggleLoop={handleToggleLoop}
              onTempoChange={handleTempoChange}
            />

            {/* Separator */}
            <div className="w-px h-8 bg-zinc-700" />

            {/* Grid Settings */}
            <div className="flex items-center gap-3">
              {/* Bars */}
              <div className="flex items-center gap-2">
                <Label className="text-xs text-zinc-400 font-medium">Bars</Label>
                <Select value={String(bars)} onValueChange={handleBarsChange}>
                  <SelectTrigger className="w-16 h-8 bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-zinc-500 focus:ring-zinc-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {BAR_OPTIONS.map((b) => (
                      <SelectItem key={b} value={String(b)} className="text-zinc-100 focus:bg-zinc-800">
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Resolution */}
              <div className="flex items-center gap-2">
                <Label className="text-xs text-zinc-400 font-medium">Grid</Label>
                <Select value={gridResolution} onValueChange={handleResolutionChange}>
                  <SelectTrigger className="w-28 h-8 bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-zinc-500 focus:ring-zinc-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {GRID_RESOLUTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-zinc-100 focus:bg-zinc-800">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Zoom */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:text-zinc-600"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= ZOOM_LIMITS.min}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs text-zinc-300 w-12 text-center font-medium">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:text-zinc-600"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= ZOOM_LIMITS.max}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Separator */}
            <div className="w-px h-8 bg-zinc-700" />

            {/* Edit Actions */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:text-zinc-600"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (Cmd+Z)"
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:text-zinc-600"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (Cmd+Shift+Z)"
              >
                <Redo className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-950/50 disabled:text-zinc-600"
                onClick={handleClear}
                disabled={isEmpty}
                title="Clear all hits"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-auto py-4">
            <DrumGrid
              bars={bars}
              resolution={gridResolution}
              timeSignature={timeSignature}
              zoomLevel={zoomLevel}
              snapEnabled={snapEnabled}
              playheadTick={currentPlayheadTick}
              onPreviewHit={previewHit}
            />
          </div>

          {/* Footer */}
          <DialogFooter className="pt-4 border-t border-zinc-800">
            <div className="flex items-center gap-2 w-full justify-between">
              <span className="text-xs text-zinc-500">
                Space: Play/Stop • Cmd+Z: Undo • Cmd+S: Save
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isEmpty}
                  className="bg-blue-600 hover:bg-blue-500 text-white disabled:bg-zinc-700 disabled:text-zinc-500"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Pattern
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
