'use client';

/**
 * BlockEditor - Step wizard for composing modular tutorial lesson flows.
 *
 * Renders an ordered list of TutorialBlocks with drag-and-drop reordering
 * (via @dnd-kit), inline editing, and block type selection.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type { AnyBlock, BlockType } from '@bassnotion/contracts';
import { Plus } from 'lucide-react';

import { BlockCard } from './BlockCard.js';
import { BlockTypeSelector } from './BlockTypeSelector.js';
import { VideoBlockForm } from './configs/VideoBlockForm.js';
import { ExerciseBlockForm } from './configs/ExerciseBlockForm.js';
import { GrooveBlockForm } from './configs/GrooveBlockForm.js';
import { GrooveCardBlockForm } from './configs/GrooveCardBlockForm.js';
import { TextBlockForm } from './configs/TextBlockForm.js';
import { CelebrationBlockForm } from './configs/CelebrationBlockForm.js';
import { ExplainBlockForm } from './configs/ExplainBlockForm.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlockEditorProps {
  /** Current ordered list of blocks in the tutorial */
  blocks: AnyBlock[];
  /** Available exercises for Exercise / Groove block selection */
  exercises: Array<{
    id: string | { value: string };
    title?: string;
    difficulty?: string;
  }>;
  /** Callback fired whenever the block list changes */
  onBlocksChange: (blocks: AnyBlock[]) => void;
  /** Available tutorials for "Next tutorial" CTA in celebration blocks */
  tutorials?: Array<{ slug: string; title: string }>;
  /** Current tutorial's slug. Used by groove-card stem uploads to
   * compose the bucket storage path:
   *   audio-samples/grooves/{tutorialSlug}/{keyFolder}/{stem}.ogg */
  tutorialSlug?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a collision-resistant client-side ID for new blocks */
function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Default config factory per block type */
function createDefaultBlock(type: BlockType, order: number): AnyBlock {
  const id = generateBlockId();

  const factories: Record<BlockType, () => AnyBlock> = {
    video: () => ({
      id,
      type: 'video' as const,
      title: 'Understand',
      order,
      showInIsland: true,
      config: {
        videoUrl: '',
        videoLibraryId: '',
        overlayTypes: ['QUIZ' as const],
      },
    }),
    exercise: () => ({
      id,
      type: 'exercise' as const,
      title: 'Practice',
      order,
      showInIsland: true,
      config: {
        exerciseIds: [],
        requiredCompletions: 4,
        lockedDifficulties: ['advanced', 'hard', 'expert'],
      },
    }),
    groove: () => ({
      id,
      type: 'groove' as const,
      title: 'Apply',
      order,
      showInIsland: true,
      config: { requiresPreviousCompletion: true },
    }),
    'groove-card': () => ({
      id,
      type: 'groove-card' as const,
      title: 'Groove Card',
      order,
      showInIsland: true,
      config: {
        title: 'New Groove',
        subtitle: '',
        originalBpm: 100,
        originalKey: 'E',
        lengthBars: 4,
        stems: { bass: '', drums: '', harmony: '' },
        // Caption copy is baked in (groove-card/captions.ts); no
        // per-block override needed. The contract still allows
        // previewCaption / stateCaptions so a future story can opt
        // back into per-card overrides if a specific groove wants
        // bespoke voice.
      },
    }),
    text: () => ({
      id,
      type: 'text' as const,
      title: 'Notes',
      order,
      showInIsland: false,
      config: { content: '', variant: 'default' as const },
    }),
    celebration: () => ({
      id,
      type: 'celebration' as const,
      title: 'Celebration',
      order,
      showInIsland: false,
      config: { title: 'Great job!' },
    }),
    explain: () => ({
      id,
      type: 'explain' as const,
      title: 'Explain',
      order,
      showInIsland: true,
      config: { slides: [] },
    }),
  };

  return factories[type]();
}

/** Re-index block order values to match array position */
function reindexBlocks(blocks: AnyBlock[]): AnyBlock[] {
  return blocks.map((block, index) => ({ ...block, order: index }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BlockEditor({
  blocks,
  exercises,
  onBlocksChange,
  tutorials,
  tutorialSlug,
}: BlockEditorProps) {
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  // Keyboard + pointer sensors for accessibility
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // --------------------------------------------------
  // Drag-and-drop reorder
  // --------------------------------------------------

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      onBlocksChange(reindexBlocks(arrayMove(blocks, oldIndex, newIndex)));
    },
    [blocks, onBlocksChange],
  );

  // --------------------------------------------------
  // Block CRUD
  // --------------------------------------------------

  const handleAddBlock = useCallback(
    (type: BlockType) => {
      const newBlock = createDefaultBlock(type, blocks.length);
      onBlocksChange([...blocks, newBlock]);
      setShowTypeSelector(false);
      setEditingBlockId(newBlock.id);
    },
    [blocks, onBlocksChange],
  );

  const handleDeleteBlock = useCallback(
    (blockId: string) => {
      onBlocksChange(reindexBlocks(blocks.filter((b) => b.id !== blockId)));
      if (editingBlockId === blockId) setEditingBlockId(null);
    },
    [blocks, onBlocksChange, editingBlockId],
  );

  const handleUpdateBlock = useCallback(
    (blockId: string, updates: Partial<AnyBlock>) => {
      onBlocksChange(
        blocks.map((b) =>
          b.id === blockId ? ({ ...b, ...updates } as AnyBlock) : b,
        ),
      );
    },
    [blocks, onBlocksChange],
  );

  const handleToggleEdit = useCallback((blockId: string) => {
    setEditingBlockId((prev) => (prev === blockId ? null : blockId));
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditingBlockId(null);
  }, []);

  const handleOpenTypeSelector = useCallback(() => {
    setShowTypeSelector(true);
  }, []);

  const handleCloseTypeSelector = useCallback(() => {
    setShowTypeSelector(false);
  }, []);

  // --------------------------------------------------
  // Derived state
  // --------------------------------------------------

  const editingBlock = useMemo(
    () => blocks.find((b) => b.id === editingBlockId),
    [blocks, editingBlockId],
  );

  const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks]);

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Lesson Flow</h3>
        <span className="text-sm text-white/40">{blocks.length} blocks</span>
      </div>

      {/* Sortable block list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blockIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {blocks.map((block) => (
              <BlockCard
                key={block.id}
                block={block}
                isEditing={editingBlockId === block.id}
                onEdit={handleToggleEdit}
                onDelete={handleDeleteBlock}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add block button */}
      <button
        onClick={handleOpenTypeSelector}
        className="w-full py-3 border-2 border-dashed border-white/10 hover:border-white/20 rounded-xl text-white/40 hover:text-white/60 transition-all duration-200 flex items-center justify-center gap-2 text-sm"
      >
        <Plus className="w-4 h-4" />
        Add Block
      </button>

      {/* Block type selector modal */}
      {showTypeSelector && (
        <BlockTypeSelector
          onSelect={handleAddBlock}
          onClose={handleCloseTypeSelector}
        />
      )}

      {/* Inline editing form for the selected block */}
      {editingBlock && (
        <EditingPanel
          block={editingBlock}
          exercises={exercises}
          tutorials={tutorials}
          tutorialSlug={tutorialSlug}
          onUpdate={handleUpdateBlock}
          onClose={handleCloseEdit}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editing Panel (extracted to keep BlockEditor body lean)
// ---------------------------------------------------------------------------

interface EditingPanelProps {
  block: AnyBlock;
  exercises: BlockEditorProps['exercises'];
  tutorials?: BlockEditorProps['tutorials'];
  tutorialSlug?: BlockEditorProps['tutorialSlug'];
  onUpdate: (blockId: string, updates: Partial<AnyBlock>) => void;
  onClose: () => void;
}

const EditingPanel = React.memo(function EditingPanel({
  block,
  exercises,
  tutorials,
  tutorialSlug,
  onUpdate,
  onClose,
}: EditingPanelProps) {
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(block.id, { title: e.target.value });
    },
    [block.id, onUpdate],
  );

  const handleShowInIslandToggle = useCallback(() => {
    onUpdate(block.id, {
      showInIsland: !block.showInIsland,
    } as Partial<AnyBlock>);
  }, [block.id, block.showInIsland, onUpdate]);

  const handleConfigChange = useCallback(
    (config: AnyBlock['config']) => {
      onUpdate(block.id, { config } as Partial<AnyBlock>);
    },
    [block.id, onUpdate],
  );

  return (
    <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-xl">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-white uppercase tracking-wider">
          Edit: {block.title}
        </h4>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/60 text-sm"
        >
          Close
        </button>
      </div>

      {/* Block title + show in island */}
      <div className="mb-4 flex items-end gap-4">
        <div className="flex-1">
          <label className="block text-xs text-white/40 mb-1">
            Block Title
          </label>
          <input
            type="text"
            value={block.title}
            onChange={handleTitleChange}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          />
        </div>
        <button
          onClick={handleShowInIslandToggle}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
            block.showInIsland !== false
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'bg-white/5 text-white/40 border border-white/10 hover:border-white/20'
          }`}
        >
          {block.showInIsland !== false ? 'In Island' : 'Hidden'}
        </button>
      </div>

      {/* Type-specific config form */}
      {block.type === 'video' && (
        <VideoBlockForm config={block.config} onChange={handleConfigChange} />
      )}
      {block.type === 'exercise' && (
        <ExerciseBlockForm
          config={block.config}
          exercises={exercises}
          onChange={handleConfigChange}
        />
      )}
      {block.type === 'groove' && (
        <GrooveBlockForm
          config={block.config}
          exercises={exercises}
          onChange={handleConfigChange}
        />
      )}
      {block.type === 'groove-card' && (
        <GrooveCardBlockForm
          config={block.config}
          onChange={handleConfigChange}
          tutorialSlug={tutorialSlug}
        />
      )}
      {block.type === 'text' && (
        <TextBlockForm config={block.config} onChange={handleConfigChange} />
      )}
      {block.type === 'celebration' && (
        <CelebrationBlockForm
          config={block.config}
          onChange={handleConfigChange}
          tutorials={tutorials}
        />
      )}
      {block.type === 'explain' && (
        <ExplainBlockForm config={block.config} onChange={handleConfigChange} />
      )}
    </div>
  );
});
