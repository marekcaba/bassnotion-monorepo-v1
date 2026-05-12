'use client';

/**
 * BlockTypeSelector - Modal for choosing which block type to add.
 *
 * Presents all available block types (video, exercise, groove, text,
 * celebration) with icons and descriptions.
 */

import React, { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { BlockType } from '@bassnotion/contracts';
import { Video, Music, Sparkles, FileText, PartyPopper, BookOpen, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Block type option metadata
// ---------------------------------------------------------------------------

interface BlockTypeOption {
  type: BlockType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const BLOCK_TYPE_OPTIONS: BlockTypeOption[] = [
  { type: 'video', label: 'Video', icon: Video, description: 'Bunny Stream video with quiz overlays' },
  { type: 'exercise', label: 'Exercise', icon: Music, description: 'Interactive practice with fretboard' },
  { type: 'groove', label: 'Groove', icon: Sparkles, description: 'Full performance with YouTube sync' },
  { type: 'text', label: 'Text', icon: FileText, description: 'Rich text notes and explanations' },
  { type: 'celebration', label: 'Celebration', icon: PartyPopper, description: 'Milestone celebration moment' },
  { type: 'explain', label: 'Explain', icon: BookOpen, description: 'Rich multimedia explanation carousel' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BlockTypeSelectorProps {
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export const BlockTypeSelector = React.memo(function BlockTypeSelector({
  onSelect,
  onClose,
}: BlockTypeSelectorProps) {
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only close when clicking the backdrop itself, not the panel
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Add block"
    >
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Add Block</h3>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/60 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-2">
          {BLOCK_TYPE_OPTIONS.map(({ type, label, icon: Icon, description }) => (
            <BlockTypeOptionButton
              key={type}
              type={type}
              label={label}
              icon={Icon}
              description={description}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
});

// ---------------------------------------------------------------------------
// Individual option button (memoized to avoid re-renders)
// ---------------------------------------------------------------------------

interface BlockTypeOptionButtonProps {
  type: BlockType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  onSelect: (type: BlockType) => void;
}

const BlockTypeOptionButton = React.memo(function BlockTypeOptionButton({
  type,
  label,
  icon: Icon,
  description,
  onSelect,
}: BlockTypeOptionButtonProps) {
  const handleClick = useCallback(() => {
    onSelect(type);
  }, [onSelect, type]);

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors text-left"
    >
      <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-white/60" />
      </div>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-white/40">{description}</p>
      </div>
    </button>
  );
});
