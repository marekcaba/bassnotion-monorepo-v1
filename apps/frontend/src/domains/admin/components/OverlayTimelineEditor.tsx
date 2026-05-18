'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  HelpCircle,
  BookOpen,
  Mic,
  Headphones,
  Upload,
  MessageSquare,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  AnyVideoOverlayEvent,
  VideoOverlayEvent,
  VideoOverlayType,
  QuizOverlayContent,
  PrepOverlayContent,
  RecordOverlayContent,
  ListenOverlayContent,
  UploadOverlayContent,
  ReflectOverlayContent,
  UnderstandQuestionOption,
} from '@bassnotion/contracts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<
  VideoOverlayType,
  {
    label: string;
    color: string;
    selectedColor: string;
    icon: React.ElementType;
  }
> = {
  QUIZ: {
    label: 'Quiz',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    selectedColor: 'bg-blue-500/30 text-blue-200 border-blue-400/50',
    icon: HelpCircle,
  },
  PREP: {
    label: 'Prep',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    selectedColor: 'bg-purple-500/30 text-purple-200 border-purple-400/50',
    icon: BookOpen,
  },
  RECORD: {
    label: 'Record',
    color: 'bg-red-500/20 text-red-300 border-red-500/30',
    selectedColor: 'bg-red-500/30 text-red-200 border-red-400/50',
    icon: Mic,
  },
  LISTEN: {
    label: 'Listen',
    color: 'bg-green-500/20 text-green-300 border-green-500/30',
    selectedColor: 'bg-green-500/30 text-green-200 border-green-400/50',
    icon: Headphones,
  },
  UPLOAD: {
    label: 'Upload',
    color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    selectedColor: 'bg-indigo-500/30 text-indigo-200 border-indigo-400/50',
    icon: Upload,
  },
  REFLECT: {
    label: 'Reflect',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    selectedColor: 'bg-amber-500/30 text-amber-200 border-amber-400/50',
    icon: MessageSquare,
  },
};

const OVERLAY_TYPES = Object.keys(TYPE_CONFIG) as VideoOverlayType[];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getPreviewText(event: AnyVideoOverlayEvent): string {
  switch (event.type) {
    case 'QUIZ':
      return event.content.question || 'Untitled question';
    case 'REFLECT':
      return event.content.prompt || 'Untitled prompt';
    default:
      return (
        (event.content as { instruction?: string }).instruction || 'Untitled'
      );
  }
}

function createDefaultEvent(type: VideoOverlayType): AnyVideoOverlayEvent {
  const base = { id: crypto.randomUUID(), type, timestamp: 0, label: '' };

  switch (type) {
    case 'QUIZ':
      return {
        ...base,
        type: 'QUIZ',
        content: {
          question: '',
          options: [
            { id: crypto.randomUUID(), text: '' },
            { id: crypto.randomUUID(), text: '' },
          ],
          correct_option_id: '',
        },
      };
    case 'PREP':
      return { ...base, type: 'PREP', content: { instruction: '' } };
    case 'RECORD':
      return { ...base, type: 'RECORD', content: { instruction: '' } };
    case 'LISTEN':
      return { ...base, type: 'LISTEN', content: { instruction: '' } };
    case 'UPLOAD':
      return { ...base, type: 'UPLOAD', content: { instruction: '' } };
    case 'REFLECT':
      return { ...base, type: 'REFLECT', content: { prompt: '' } };
  }
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const INPUT_CLASSES =
  'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/30';

const TEXTAREA_CLASSES = `${INPUT_CLASSES} resize-y min-h-[60px]`;

const LABEL_CLASSES = 'block text-xs text-white/40 mb-1';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OverlayTimelineEditorProps {
  events: AnyVideoOverlayEvent[];
  onEventsChange: (events: AnyVideoOverlayEvent[]) => void;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const OverlayTimelineEditor = React.memo(function OverlayTimelineEditor({
  events,
  onEventsChange,
}: OverlayTimelineEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.timestamp - b.timestamp),
    [events],
  );

  const editingEvent = useMemo(
    () => (editingId ? (events.find((e) => e.id === editingId) ?? null) : null),
    [events, editingId],
  );

  const updateEvent = useCallback(
    (id: string, patch: Partial<AnyVideoOverlayEvent>) => {
      const updated = events.map((e) => (e.id === id ? { ...e, ...patch } : e));
      onEventsChange(updated as AnyVideoOverlayEvent[]);
    },
    [events, onEventsChange],
  );

  const deleteEvent = useCallback(
    (id: string) => {
      if (editingId === id) setEditingId(null);
      onEventsChange(events.filter((e) => e.id !== id));
    },
    [events, onEventsChange, editingId],
  );

  const handleAddEvent = useCallback(
    (type: VideoOverlayType) => {
      const newEvent = createDefaultEvent(type);
      onEventsChange([...events, newEvent]);
      setEditingId(newEvent.id);
      setShowTypePicker(false);
    },
    [events, onEventsChange],
  );

  const handleEdit = useCallback((id: string) => {
    setEditingId((prev) => (prev === id ? null : id));
  }, []);

  const handleDoneEditing = useCallback(() => {
    setEditingId(null);
  }, []);

  const toggleTypePicker = useCallback(() => {
    setShowTypePicker((prev) => !prev);
  }, []);

  return (
    <div className="space-y-3">
      <label className="block text-xs text-white/40">Overlay Timeline</label>

      {sortedEvents.length === 0 && !showTypePicker && (
        <div className="text-center py-6 border border-dashed border-white/10 rounded-lg">
          <p className="text-white/30 text-sm mb-3">No overlay events yet</p>
          <button
            onClick={toggleTypePicker}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-white/50 hover:text-white/70 text-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Overlay
          </button>
        </div>
      )}

      {sortedEvents.length > 0 && (
        <div className="space-y-1">
          {sortedEvents.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              isEditing={editingId === event.id}
              onEdit={handleEdit}
              onDelete={deleteEvent}
            />
          ))}
        </div>
      )}

      {editingEvent && (
        <EventEditPanel
          event={editingEvent}
          onUpdate={updateEvent}
          onDone={handleDoneEditing}
        />
      )}

      {showTypePicker && (
        <TypePicker onSelect={handleAddEvent} onClose={toggleTypePicker} />
      )}

      {sortedEvents.length > 0 && !showTypePicker && (
        <button
          onClick={toggleTypePicker}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-white/40 hover:text-white/60 text-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Overlay
        </button>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// EventRow
// ---------------------------------------------------------------------------

interface EventRowProps {
  event: AnyVideoOverlayEvent;
  isEditing: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const EventRow = React.memo(function EventRow({
  event,
  isEditing,
  onEdit,
  onDelete,
}: EventRowProps) {
  const cfg = TYPE_CONFIG[event.type];
  const Icon = cfg.icon;

  const handleEdit = useCallback(() => onEdit(event.id), [onEdit, event.id]);
  const handleDelete = useCallback(
    () => onDelete(event.id),
    [onDelete, event.id],
  );

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
        isEditing
          ? 'bg-white/10 border-white/20'
          : 'bg-white/5 border-white/10 hover:border-white/15',
      )}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border shrink-0',
          cfg.color,
        )}
      >
        <Icon className="w-3 h-3" />
        {cfg.label}
      </span>

      <span className="text-white/30 text-xs font-mono shrink-0">
        {formatTimestamp(event.timestamp)}
      </span>

      <span className="text-white/60 text-xs truncate flex-1 min-w-0">
        {getPreviewText(event)}
      </span>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={handleEdit}
          className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleDelete}
          className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// TypePicker
// ---------------------------------------------------------------------------

interface TypePickerProps {
  onSelect: (type: VideoOverlayType) => void;
  onClose: () => void;
}

const TypePicker = React.memo(function TypePicker({
  onSelect,
  onClose,
}: TypePickerProps) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">Choose overlay type</span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {OVERLAY_TYPES.map((type) => {
          const cfg = TYPE_CONFIG[type];
          const Icon = cfg.icon;
          return (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors hover:scale-[1.02]',
                cfg.color,
                'hover:brightness-125',
              )}
            >
              <Icon className="w-4 h-4" />
              {cfg.label}
            </button>
          );
        })}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// EventEditPanel
// ---------------------------------------------------------------------------

interface EventEditPanelProps {
  event: AnyVideoOverlayEvent;
  onUpdate: (id: string, patch: Partial<AnyVideoOverlayEvent>) => void;
  onDone: () => void;
}

const EventEditPanel = React.memo(function EventEditPanel({
  event,
  onUpdate,
  onDone,
}: EventEditPanelProps) {
  const handleTimestampChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Math.max(0, Number(e.target.value) || 0);
      onUpdate(event.id, { timestamp: value });
    },
    [event.id, onUpdate],
  );

  return (
    <div className="p-4 rounded-lg bg-white/[0.03] border border-white/10 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/70 font-medium">
          Edit {TYPE_CONFIG[event.type].label} Overlay
        </span>
        <button
          onClick={onDone}
          className="px-3 py-1 rounded-lg bg-white/10 border border-white/10 hover:border-white/20 text-white/60 hover:text-white/80 text-xs transition-colors"
        >
          Done
        </button>
      </div>

      <div>
        <label className={LABEL_CLASSES}>Timestamp (seconds)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={event.timestamp}
            onChange={handleTimestampChange}
            min={0}
            className={cn(INPUT_CLASSES, 'w-24')}
          />
          <span className="text-xs text-white/30 font-mono">
            {formatTimestamp(event.timestamp)}
          </span>
        </div>
      </div>

      <ContentEditor event={event} onUpdate={onUpdate} />
    </div>
  );
});

// ---------------------------------------------------------------------------
// ContentEditor (type-specific fields)
// ---------------------------------------------------------------------------

interface ContentEditorProps {
  event: AnyVideoOverlayEvent;
  onUpdate: (id: string, patch: Partial<AnyVideoOverlayEvent>) => void;
}

const ContentEditor = React.memo(function ContentEditor({
  event,
  onUpdate,
}: ContentEditorProps) {
  switch (event.type) {
    case 'QUIZ':
      return <QuizContentEditor event={event} onUpdate={onUpdate} />;
    case 'PREP':
      return <PrepContentEditor event={event} onUpdate={onUpdate} />;
    case 'RECORD':
      return <RecordContentEditor event={event} onUpdate={onUpdate} />;
    case 'LISTEN':
      return <ListenContentEditor event={event} onUpdate={onUpdate} />;
    case 'UPLOAD':
      return <UploadContentEditor event={event} onUpdate={onUpdate} />;
    case 'REFLECT':
      return <ReflectContentEditor event={event} onUpdate={onUpdate} />;
  }
});

// ---------------------------------------------------------------------------
// Quiz Editor
// ---------------------------------------------------------------------------

interface TypedEditorProps<T extends VideoOverlayType> {
  event: VideoOverlayEvent<T>;
  onUpdate: (id: string, patch: Partial<AnyVideoOverlayEvent>) => void;
}

const QuizContentEditor = React.memo(function QuizContentEditor({
  event,
  onUpdate,
}: TypedEditorProps<'QUIZ'>) {
  const { question, options, correct_option_id } = event.content;

  const updateContent = useCallback(
    (patch: Partial<QuizOverlayContent>) => {
      onUpdate(event.id, { content: { ...event.content, ...patch } } as Partial<
        VideoOverlayEvent<'QUIZ'>
      >);
    },
    [event.id, event.content, onUpdate],
  );

  const handleQuestionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      updateContent({ question: e.target.value }),
    [updateContent],
  );

  const handleOptionTextChange = useCallback(
    (optionId: string, text: string) => {
      updateContent({
        options: options.map((o) => (o.id === optionId ? { ...o, text } : o)),
      });
    },
    [options, updateContent],
  );

  const handleSetCorrect = useCallback(
    (optionId: string) => updateContent({ correct_option_id: optionId }),
    [updateContent],
  );

  const handleAddOption = useCallback(() => {
    if (options.length >= 6) return;
    const newOption: UnderstandQuestionOption = {
      id: crypto.randomUUID(),
      text: '',
    };
    updateContent({ options: [...options, newOption] });
  }, [options, updateContent]);

  const handleRemoveOption = useCallback(
    (optionId: string) => {
      if (options.length <= 2) return;
      const filtered = options.filter((o) => o.id !== optionId);
      const patch: Partial<QuizOverlayContent> = { options: filtered };
      if (correct_option_id === optionId) patch.correct_option_id = '';
      updateContent(patch);
    },
    [options, correct_option_id, updateContent],
  );

  return (
    <div className="space-y-3">
      <div>
        <label className={LABEL_CLASSES}>Question</label>
        <input
          type="text"
          value={question}
          onChange={handleQuestionChange}
          placeholder="What note is on the 3rd fret of the A string?"
          className={INPUT_CLASSES}
          maxLength={500}
        />
      </div>

      <div>
        <label className={LABEL_CLASSES}>
          Options (click circle to mark correct)
        </label>
        <div className="space-y-2">
          {options.map((option, idx) => (
            <div key={option.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSetCorrect(option.id)}
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                  correct_option_id === option.id
                    ? 'border-green-400 bg-green-500 text-white'
                    : 'border-white/20 hover:border-green-400/50',
                )}
              >
                {correct_option_id === option.id && (
                  <Check className="w-3 h-3" />
                )}
              </button>
              <input
                type="text"
                value={option.text}
                onChange={(e) =>
                  handleOptionTextChange(option.id, e.target.value)
                }
                placeholder={`Option ${idx + 1}`}
                className={cn(INPUT_CLASSES, 'flex-1')}
                maxLength={200}
              />
              {options.length > 2 && (
                <button
                  onClick={() => handleRemoveOption(option.id)}
                  className="p-1 rounded hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 6 && (
          <button
            onClick={handleAddOption}
            className="mt-2 flex items-center gap-1 text-white/30 hover:text-white/50 text-xs transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Option
          </button>
        )}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Prep Editor
// ---------------------------------------------------------------------------

const PrepContentEditor = React.memo(function PrepContentEditor({
  event,
  onUpdate,
}: TypedEditorProps<'PREP'>) {
  const updateContent = useCallback(
    (patch: Partial<PrepOverlayContent>) => {
      onUpdate(event.id, { content: { ...event.content, ...patch } } as Partial<
        VideoOverlayEvent<'PREP'>
      >);
    },
    [event.id, event.content, onUpdate],
  );

  return (
    <div className="space-y-3">
      <div>
        <label className={LABEL_CLASSES}>Instruction</label>
        <textarea
          value={event.content.instruction}
          onChange={(e) => updateContent({ instruction: e.target.value })}
          placeholder="Grab your bass and get ready..."
          className={TEXTAREA_CLASSES}
        />
      </div>
      <div>
        <label className={LABEL_CLASSES}>Detail (optional)</label>
        <textarea
          value={event.content.detail ?? ''}
          onChange={(e) =>
            updateContent({ detail: e.target.value || undefined })
          }
          placeholder="Additional detail or context..."
          className={TEXTAREA_CLASSES}
        />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Record Editor
// ---------------------------------------------------------------------------

const RecordContentEditor = React.memo(function RecordContentEditor({
  event,
  onUpdate,
}: TypedEditorProps<'RECORD'>) {
  const updateContent = useCallback(
    (patch: Partial<RecordOverlayContent>) => {
      onUpdate(event.id, { content: { ...event.content, ...patch } } as Partial<
        VideoOverlayEvent<'RECORD'>
      >);
    },
    [event.id, event.content, onUpdate],
  );

  return (
    <div className="space-y-3">
      <div>
        <label className={LABEL_CLASSES}>Instruction</label>
        <textarea
          value={event.content.instruction}
          onChange={(e) => updateContent({ instruction: e.target.value })}
          placeholder="Record yourself playing the riff..."
          className={TEXTAREA_CLASSES}
        />
      </div>
      <div>
        <label className={LABEL_CLASSES}>
          Duration hint in seconds (optional)
        </label>
        <input
          type="number"
          value={event.content.durationHint ?? ''}
          onChange={(e) => {
            const v = e.target.value ? Number(e.target.value) : undefined;
            updateContent({ durationHint: v });
          }}
          placeholder="e.g. 30"
          min={1}
          className={cn(INPUT_CLASSES, 'w-32')}
        />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Listen Editor
// ---------------------------------------------------------------------------

const ListenContentEditor = React.memo(function ListenContentEditor({
  event,
  onUpdate,
}: TypedEditorProps<'LISTEN'>) {
  const updateContent = useCallback(
    (patch: Partial<ListenOverlayContent>) => {
      onUpdate(event.id, { content: { ...event.content, ...patch } } as Partial<
        VideoOverlayEvent<'LISTEN'>
      >);
    },
    [event.id, event.content, onUpdate],
  );

  return (
    <div className="space-y-3">
      <div>
        <label className={LABEL_CLASSES}>Instruction</label>
        <textarea
          value={event.content.instruction}
          onChange={(e) => updateContent({ instruction: e.target.value })}
          placeholder="Listen carefully to the bass line..."
          className={TEXTAREA_CLASSES}
        />
      </div>
      <div>
        <label className={LABEL_CLASSES}>Listen for (optional)</label>
        <input
          type="text"
          value={event.content.listenFor ?? ''}
          onChange={(e) =>
            updateContent({ listenFor: e.target.value || undefined })
          }
          placeholder="e.g. the ghost notes on beat 2 and 4"
          className={INPUT_CLASSES}
        />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Upload Editor
// ---------------------------------------------------------------------------

const UploadContentEditor = React.memo(function UploadContentEditor({
  event,
  onUpdate,
}: TypedEditorProps<'UPLOAD'>) {
  const updateContent = useCallback(
    (patch: Partial<UploadOverlayContent>) => {
      onUpdate(event.id, { content: { ...event.content, ...patch } } as Partial<
        VideoOverlayEvent<'UPLOAD'>
      >);
    },
    [event.id, event.content, onUpdate],
  );

  return (
    <div>
      <label className={LABEL_CLASSES}>Instruction</label>
      <textarea
        value={event.content.instruction}
        onChange={(e) => updateContent({ instruction: e.target.value })}
        placeholder="Upload a recording of your performance..."
        className={TEXTAREA_CLASSES}
      />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Reflect Editor
// ---------------------------------------------------------------------------

const ReflectContentEditor = React.memo(function ReflectContentEditor({
  event,
  onUpdate,
}: TypedEditorProps<'REFLECT'>) {
  const updateContent = useCallback(
    (patch: Partial<ReflectOverlayContent>) => {
      onUpdate(event.id, { content: { ...event.content, ...patch } } as Partial<
        VideoOverlayEvent<'REFLECT'>
      >);
    },
    [event.id, event.content, onUpdate],
  );

  return (
    <div className="space-y-3">
      <div>
        <label className={LABEL_CLASSES}>Prompt</label>
        <textarea
          value={event.content.prompt}
          onChange={(e) => updateContent({ prompt: e.target.value })}
          placeholder="What did you notice about the rhythm?"
          className={TEXTAREA_CLASSES}
        />
      </div>
      <div>
        <label className={LABEL_CLASSES}>Placeholder text (optional)</label>
        <input
          type="text"
          value={event.content.placeholder ?? ''}
          onChange={(e) =>
            updateContent({ placeholder: e.target.value || undefined })
          }
          placeholder="e.g. Type your thoughts here..."
          className={INPUT_CLASSES}
        />
      </div>
    </div>
  );
});
