'use client';

import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import type { AssessmentQuestion } from '@bassnotion/contracts';

interface DragDropQuestionProps {
  question: AssessmentQuestion;
  mapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
  onSubmit: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
}

// Draggable item component
function DraggableItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 1000 : 'auto',
    position: isDragging ? 'relative' : 'static',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'px-3 py-1.5 rounded-lg text-sm cursor-grab active:cursor-grabbing',
        'transition-colors duration-150 touch-none select-none',
        'bg-white/15 text-white border border-white/20',
        'hover:bg-white/25 hover:border-white/30',
        isDragging && 'opacity-60 shadow-lg shadow-black/30',
      )}
    >
      {children}
    </div>
  );
}

// Drop zone component
function DropZone({
  id,
  label,
  value,
  onClear,
  isOver,
}: {
  id: string;
  label: string;
  value: string | null;
  onClear: () => void;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div className="flex items-center gap-3">
      <span className="text-white/60 min-w-[80px] text-right text-sm">
        {label}
      </span>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-[36px] px-3 rounded-lg border-2 border-dashed',
          'flex items-center justify-center',
          'transition-all duration-150',
          isOver
            ? 'border-white/60 bg-white/15 scale-[1.02]'
            : value
              ? 'border-white/40 bg-white/10'
              : 'border-white/20 bg-white/[0.02]',
        )}
      >
        {value ? (
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-white">{value}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="ml-2 p-1 text-white/40 hover:text-white/80 transition-colors"
              aria-label={`Clear ${label}`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ) : (
          <span
            className={cn(
              'text-xs transition-colors',
              isOver ? 'text-white/70' : 'text-white/30',
            )}
          >
            {isOver ? 'Drop here' : 'Drag item here'}
          </span>
        )}
      </div>
    </div>
  );
}

export function DragDropQuestion({
  question,
  mapping,
  onMappingChange,
  onSubmit,
  onBack,
  canGoBack = false,
}: DragDropQuestionProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const config = question.dragDropConfig;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor),
  );

  if (!config) {
    return <div>Invalid question configuration</div>;
  }

  // Get items that haven't been placed yet
  const placedItems = Object.values(mapping);
  const availableItems = config.draggableItems.filter(
    (item) => !placedItems.includes(item),
  );

  // Check if all zones are filled
  const allZonesFilled = config.dropZones.every((zone) => mapping[zone]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? (over.id as string) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const draggedItem = active.id as string;
    const targetZone = over.id as string;

    // Check if dropping on a valid zone
    if (config.dropZones.includes(targetZone)) {
      const newMapping = { ...mapping };

      // Remove item from any previous zone
      Object.keys(newMapping).forEach((zone) => {
        if (newMapping[zone] === draggedItem) {
          delete newMapping[zone];
        }
      });

      // Place item in new zone
      newMapping[targetZone] = draggedItem;
      onMappingChange(newMapping);
    }
  };

  const clearZone = (zone: string) => {
    const newMapping = { ...mapping };
    delete newMapping[zone];
    onMappingChange(newMapping);
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Question - Minimal */}
      <div className="text-center">
        <h2 className="text-base sm:text-lg md:text-xl font-normal text-white/90 leading-snug">
          {question.question}
        </h2>
        {question.description && (
          <p className="mt-1.5 text-xs sm:text-sm text-white/40">
            {question.description}
          </p>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Stacked layout - items on top, drop zones below */}
        <div className="flex flex-col gap-4">
          {/* Available items to drag */}
          <div className="flex flex-wrap gap-2 justify-center">
            {availableItems.map((item) => (
              <DraggableItem key={item} id={item}>
                {item}
              </DraggableItem>
            ))}
            {availableItems.length === 0 && (
              <p className="text-white/40 text-xs">All items placed</p>
            )}
          </div>

          {/* Drop zones */}
          <div className="flex flex-col gap-2">
            {config.dropZones.map((zone) => (
              <DropZone
                key={zone}
                id={zone}
                label={zone}
                value={mapping[zone] || null}
                onClear={() => clearZone(zone)}
                isOver={overId === zone}
              />
            ))}
          </div>
        </div>
      </DndContext>

      {/* Action buttons - Minimal */}
      <div className="flex justify-between items-center pt-1">
        {canGoBack ? (
          <button
            onClick={onBack}
            className="px-2 py-1 text-xs text-white/40 hover:text-white/60 transition-colors duration-150"
          >
            Back
          </button>
        ) : (
          <div />
        )}

        <button
          onClick={onSubmit}
          disabled={!allZonesFilled}
          className={cn(
            'px-5 py-2 rounded-lg text-sm transition-all duration-150',
            allZonesFilled
              ? 'bg-white text-black hover:bg-white/90'
              : 'bg-white/10 text-white/30 cursor-not-allowed',
          )}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
