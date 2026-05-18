'use client';

/**
 * ExplainBlockForm - Configuration form for Explain blocks.
 *
 * Manages a list of slides, each containing ordered media items (text, image,
 * video, audio). Supports add/delete/reorder for both slides and items.
 */

import React, { useState, useCallback } from 'react';
import type {
  ExplainBlockConfig,
  ExplainSlide,
  ExplainMediaItem,
  ExplainMediaType,
} from '@bassnotion/contracts';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  ImageIcon,
  Video,
  Volume2,
  GripVertical,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface MediaTypeOption {
  type: ExplainMediaType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MEDIA_TYPE_OPTIONS: MediaTypeOption[] = [
  { type: 'text', label: 'Text', icon: FileText },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'video', label: 'Video', icon: Video },
  { type: 'audio', label: 'Audio', icon: Volume2 },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ExplainBlockFormProps {
  config: ExplainBlockConfig;
  onChange: (config: ExplainBlockConfig) => void;
}

export const ExplainBlockForm = React.memo(function ExplainBlockForm({
  config,
  onChange,
}: ExplainBlockFormProps) {
  const [expandedSlide, setExpandedSlide] = useState<string | null>(
    config.slides[0]?.id ?? null,
  );

  const handleHeadingChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...config, heading: e.target.value });
    },
    [config, onChange],
  );

  // -- Slide operations --

  const addSlide = useCallback(() => {
    const newSlide: ExplainSlide = { id: generateId(), items: [] };
    const updated = { ...config, slides: [...config.slides, newSlide] };
    onChange(updated);
    setExpandedSlide(newSlide.id);
  }, [config, onChange]);

  const deleteSlide = useCallback(
    (slideId: string) => {
      onChange({
        ...config,
        slides: config.slides.filter((s) => s.id !== slideId),
      });
      if (expandedSlide === slideId) setExpandedSlide(null);
    },
    [config, onChange, expandedSlide],
  );

  const moveSlide = useCallback(
    (slideId: string, direction: 'up' | 'down') => {
      const idx = config.slides.findIndex((s) => s.id === slideId);
      if (idx < 0) return;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= config.slides.length) return;
      const newSlides = [...config.slides];
      [newSlides[idx], newSlides[target]] = [newSlides[target], newSlides[idx]];
      onChange({ ...config, slides: newSlides });
    },
    [config, onChange],
  );

  const updateSlideTitle = useCallback(
    (slideId: string, title: string) => {
      onChange({
        ...config,
        slides: config.slides.map((s) =>
          s.id === slideId ? { ...s, title } : s,
        ),
      });
    },
    [config, onChange],
  );

  // -- Item operations --

  const addItem = useCallback(
    (slideId: string, type: ExplainMediaType) => {
      const newItem: ExplainMediaItem = { id: generateId(), type };
      onChange({
        ...config,
        slides: config.slides.map((s) =>
          s.id === slideId ? { ...s, items: [...s.items, newItem] } : s,
        ),
      });
    },
    [config, onChange],
  );

  const deleteItem = useCallback(
    (slideId: string, itemId: string) => {
      onChange({
        ...config,
        slides: config.slides.map((s) =>
          s.id === slideId
            ? { ...s, items: s.items.filter((i) => i.id !== itemId) }
            : s,
        ),
      });
    },
    [config, onChange],
  );

  const updateItem = useCallback(
    (slideId: string, itemId: string, updates: Partial<ExplainMediaItem>) => {
      onChange({
        ...config,
        slides: config.slides.map((s) =>
          s.id === slideId
            ? {
                ...s,
                items: s.items.map((i) =>
                  i.id === itemId ? { ...i, ...updates } : i,
                ),
              }
            : s,
        ),
      });
    },
    [config, onChange],
  );

  const moveItem = useCallback(
    (slideId: string, itemId: string, direction: 'up' | 'down') => {
      const slide = config.slides.find((s) => s.id === slideId);
      if (!slide) return;
      const idx = slide.items.findIndex((i) => i.id === itemId);
      if (idx < 0) return;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= slide.items.length) return;
      const newItems = [...slide.items];
      [newItems[idx], newItems[target]] = [newItems[target], newItems[idx]];
      onChange({
        ...config,
        slides: config.slides.map((s) =>
          s.id === slideId ? { ...s, items: newItems } : s,
        ),
      });
    },
    [config, onChange],
  );

  const toggleSlide = useCallback((slideId: string) => {
    setExpandedSlide((prev) => (prev === slideId ? null : slideId));
  }, []);

  return (
    <div className="space-y-4">
      {/* Heading */}
      <div>
        <label className="block text-xs text-white/40 mb-1">
          Heading (optional)
        </label>
        <input
          type="text"
          value={config.heading ?? ''}
          onChange={handleHeadingChange}
          placeholder="e.g. What is a Blues Scale?"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20"
        />
      </div>

      {/* Slides */}
      <div>
        <label className="block text-xs text-white/40 mb-2">
          Slides ({config.slides.length})
        </label>

        <div className="space-y-2">
          {config.slides.map((slide, slideIdx) => (
            <SlideEditor
              key={slide.id}
              slide={slide}
              slideIndex={slideIdx}
              isFirst={slideIdx === 0}
              isLast={slideIdx === config.slides.length - 1}
              isExpanded={expandedSlide === slide.id}
              onToggle={toggleSlide}
              onTitleChange={updateSlideTitle}
              onDelete={deleteSlide}
              onMove={moveSlide}
              onAddItem={addItem}
              onDeleteItem={deleteItem}
              onUpdateItem={updateItem}
              onMoveItem={moveItem}
            />
          ))}
        </div>

        <button
          onClick={addSlide}
          className="mt-2 w-full py-2.5 border-2 border-dashed border-white/10 hover:border-white/20 rounded-xl text-white/40 hover:text-white/60 transition-all duration-200 flex items-center justify-center gap-2 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Slide
        </button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Slide editor (collapsible)
// ---------------------------------------------------------------------------

interface SlideEditorProps {
  slide: ExplainSlide;
  slideIndex: number;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: (slideId: string) => void;
  onTitleChange: (slideId: string, title: string) => void;
  onDelete: (slideId: string) => void;
  onMove: (slideId: string, direction: 'up' | 'down') => void;
  onAddItem: (slideId: string, type: ExplainMediaType) => void;
  onDeleteItem: (slideId: string, itemId: string) => void;
  onUpdateItem: (
    slideId: string,
    itemId: string,
    updates: Partial<ExplainMediaItem>,
  ) => void;
  onMoveItem: (
    slideId: string,
    itemId: string,
    direction: 'up' | 'down',
  ) => void;
}

const SlideEditor = React.memo(function SlideEditor({
  slide,
  slideIndex,
  isFirst,
  isLast,
  isExpanded,
  onToggle,
  onTitleChange,
  onDelete,
  onMove,
  onAddItem,
  onDeleteItem,
  onUpdateItem,
  onMoveItem,
}: SlideEditorProps) {
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const handleToggle = useCallback(
    () => onToggle(slide.id),
    [onToggle, slide.id],
  );
  const handleDelete = useCallback(
    () => onDelete(slide.id),
    [onDelete, slide.id],
  );
  const handleMoveUp = useCallback(
    () => onMove(slide.id, 'up'),
    [onMove, slide.id],
  );
  const handleMoveDown = useCallback(
    () => onMove(slide.id, 'down'),
    [onMove, slide.id],
  );
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onTitleChange(slide.id, e.target.value),
    [onTitleChange, slide.id],
  );
  const handleAddItem = useCallback(
    (type: ExplainMediaType) => {
      onAddItem(slide.id, type);
      setShowMediaPicker(false);
    },
    [onAddItem, slide.id],
  );

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Slide header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <GripVertical className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />

        <button
          onClick={handleToggle}
          className="flex-1 text-left text-sm font-medium text-white/70 hover:text-white transition-colors"
        >
          Slide {slideIndex + 1}
          {slide.title ? ` — ${slide.title}` : ''}
          <span className="text-white/30 ml-2">
            ({slide.items.length} item{slide.items.length !== 1 ? 's' : ''})
          </span>
        </button>

        <div className="flex items-center gap-0.5">
          {!isFirst && (
            <button
              onClick={handleMoveUp}
              className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
              aria-label="Move slide up"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}
          {!isLast && (
            <button
              onClick={handleMoveDown}
              className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
              aria-label="Move slide down"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors"
            aria-label="Delete slide"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-3">
          {/* Slide title */}
          <div>
            <label className="block text-xs text-white/30 mb-1">
              Slide Title (optional)
            </label>
            <input
              type="text"
              value={slide.title ?? ''}
              onChange={handleTitleChange}
              placeholder="e.g. The Root Note"
              className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs placeholder-white/20"
            />
          </div>

          {/* Media items */}
          <div className="space-y-2">
            {slide.items.map((item, itemIdx) => (
              <MediaItemEditor
                key={item.id}
                item={item}
                slideId={slide.id}
                isFirst={itemIdx === 0}
                isLast={itemIdx === slide.items.length - 1}
                onDelete={onDeleteItem}
                onUpdate={onUpdateItem}
                onMove={onMoveItem}
              />
            ))}
          </div>

          {/* Add media item */}
          {showMediaPicker ? (
            <div className="flex flex-wrap gap-1.5">
              {MEDIA_TYPE_OPTIONS.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => handleAddItem(type)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-white/50 hover:text-white/70 text-xs transition-colors"
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
              <button
                onClick={() => setShowMediaPicker(false)}
                className="px-2.5 py-1.5 text-xs text-white/30 hover:text-white/50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowMediaPicker(true)}
              className="w-full py-2 border border-dashed border-white/10 hover:border-white/20 rounded-lg text-white/30 hover:text-white/50 text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add Media
            </button>
          )}
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Media item editor
// ---------------------------------------------------------------------------

interface MediaItemEditorProps {
  item: ExplainMediaItem;
  slideId: string;
  isFirst: boolean;
  isLast: boolean;
  onDelete: (slideId: string, itemId: string) => void;
  onUpdate: (
    slideId: string,
    itemId: string,
    updates: Partial<ExplainMediaItem>,
  ) => void;
  onMove: (slideId: string, itemId: string, direction: 'up' | 'down') => void;
}

const MediaItemEditor = React.memo(function MediaItemEditor({
  item,
  slideId,
  isFirst,
  isLast,
  onDelete,
  onUpdate,
  onMove,
}: MediaItemEditorProps) {
  const handleDelete = useCallback(
    () => onDelete(slideId, item.id),
    [onDelete, slideId, item.id],
  );
  const handleMoveUp = useCallback(
    () => onMove(slideId, item.id, 'up'),
    [onMove, slideId, item.id],
  );
  const handleMoveDown = useCallback(
    () => onMove(slideId, item.id, 'down'),
    [onMove, slideId, item.id],
  );
  const handleFieldChange = useCallback(
    (field: string, value: string) =>
      onUpdate(slideId, item.id, { [field]: value }),
    [onUpdate, slideId, item.id],
  );

  const typeOption = MEDIA_TYPE_OPTIONS.find((o) => o.type === item.type);
  const Icon = typeOption?.icon ?? FileText;

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-lg p-2.5">
      {/* Item header */}
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
        <span className="text-xs font-medium text-white/40 uppercase tracking-wider flex-1">
          {typeOption?.label}
        </span>
        <div className="flex items-center gap-0.5">
          {!isFirst && (
            <button
              onClick={handleMoveUp}
              className="p-0.5 rounded hover:bg-white/10 text-white/20 hover:text-white/50 transition-colors"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
          )}
          {!isLast && (
            <button
              onClick={handleMoveDown}
              className="p-0.5 rounded hover:bg-white/10 text-white/20 hover:text-white/50 transition-colors"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={handleDelete}
            className="p-0.5 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Type-specific fields */}
      {item.type === 'text' && (
        <textarea
          value={item.content ?? ''}
          onChange={(e) => handleFieldChange('content', e.target.value)}
          placeholder="Write your explanation..."
          rows={3}
          className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs placeholder-white/20 resize-y"
        />
      )}

      {item.type === 'image' && (
        <div className="space-y-1.5">
          <input
            type="text"
            value={item.imageUrl ?? ''}
            onChange={(e) => handleFieldChange('imageUrl', e.target.value)}
            placeholder="Image URL"
            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs placeholder-white/20"
          />
          <div className="flex gap-1.5">
            <input
              type="text"
              value={item.caption ?? ''}
              onChange={(e) => handleFieldChange('caption', e.target.value)}
              placeholder="Caption (optional)"
              className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs placeholder-white/20"
            />
            <input
              type="text"
              value={item.alt ?? ''}
              onChange={(e) => handleFieldChange('alt', e.target.value)}
              placeholder="Alt text"
              className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs placeholder-white/20"
            />
          </div>
        </div>
      )}

      {item.type === 'video' && (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={item.videoUrl ?? ''}
            onChange={(e) => handleFieldChange('videoUrl', e.target.value)}
            placeholder="Bunny Stream Video ID"
            className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs placeholder-white/20"
          />
          <input
            type="text"
            value={item.videoLibraryId ?? ''}
            onChange={(e) =>
              handleFieldChange('videoLibraryId', e.target.value)
            }
            placeholder="Library ID"
            className="w-28 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs placeholder-white/20"
          />
        </div>
      )}

      {item.type === 'audio' && (
        <div className="space-y-1.5">
          <input
            type="text"
            value={item.audioUrl ?? ''}
            onChange={(e) => handleFieldChange('audioUrl', e.target.value)}
            placeholder="Audio file URL"
            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs placeholder-white/20"
          />
          <input
            type="text"
            value={item.audioLabel ?? ''}
            onChange={(e) => handleFieldChange('audioLabel', e.target.value)}
            placeholder="Label (e.g. Listen to this riff)"
            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs placeholder-white/20"
          />
        </div>
      )}
    </div>
  );
});
