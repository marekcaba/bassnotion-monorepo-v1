'use client';

/**
 * BlockCard - A single draggable block in the sortable lesson flow list.
 *
 * Uses @dnd-kit/sortable for drag-and-drop reordering. Displays the block
 * type icon, title, and edit/delete action buttons.
 */

import React, { useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AnyBlock, BlockType } from '@bassnotion/contracts';
import {
  GripVertical,
  Pencil,
  Trash2,
  Video,
  Music,
  Sparkles,
  Disc3,
  FileText,
  PartyPopper,
  BookOpen,
  Timer,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Icon registry
// ---------------------------------------------------------------------------

const BLOCK_ICONS: Record<
  BlockType,
  React.ComponentType<{ className?: string }>
> = {
  video: Video,
  exercise: Music,
  groove: Sparkles,
  'groove-card': Disc3,
  text: FileText,
  celebration: PartyPopper,
  explain: BookOpen,
  task: Timer,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BlockCardProps {
  block: AnyBlock;
  isEditing: boolean;
  /** Called with the block ID to toggle editing */
  onEdit: (blockId: string) => void;
  /** Called with the block ID to delete the block */
  onDelete: (blockId: string) => void;
}

export const BlockCard = React.memo(function BlockCard({
  block,
  isEditing,
  onEdit,
  onDelete,
}: BlockCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = BLOCK_ICONS[block.type] ?? FileText;

  const handleEdit = useCallback(() => {
    onEdit(block.id);
  }, [onEdit, block.id]);

  const handleDelete = useCallback(() => {
    onDelete(block.id);
  }, [onDelete, block.id]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
        isEditing
          ? 'bg-white/10 border-blue-500/30'
          : 'bg-white/5 border-white/10 hover:border-white/20'
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/50 transition-colors"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Block type icon */}
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-white/50" />
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{block.title}</p>
        <p className="text-xs text-white/30 capitalize">
          {block.type}
          {block.showInIsland === false && ' · hidden from island'}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleEdit}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/60 transition-colors"
          aria-label={`Edit ${block.title}`}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleDelete}
          className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
          aria-label={`Delete ${block.title}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});
