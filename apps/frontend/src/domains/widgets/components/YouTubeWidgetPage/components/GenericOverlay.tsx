'use client';

import React, { useCallback } from 'react';
import { BookOpen, Mic, Headphones, Upload, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnyVideoOverlayEvent, VideoOverlayType } from '@bassnotion/contracts';

// ---------------------------------------------------------------------------
// Type configuration: color-coded badges and icons per overlay type
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<
  Exclude<VideoOverlayType, 'QUIZ'>,
  { label: string; color: string; icon: React.ElementType }
> = {
  PREP: {
    label: 'Prep',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    icon: BookOpen,
  },
  RECORD: {
    label: 'Record',
    color: 'bg-red-500/20 text-red-300 border-red-500/30',
    icon: Mic,
  },
  LISTEN: {
    label: 'Listen',
    color: 'bg-green-500/20 text-green-300 border-green-500/30',
    icon: Headphones,
  },
  UPLOAD: {
    label: 'Upload',
    color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    icon: Upload,
  },
  REFLECT: {
    label: 'Reflect',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: MessageSquare,
  },
};

// ---------------------------------------------------------------------------
// Content extraction helpers
// ---------------------------------------------------------------------------

/** Extracts the primary instruction text from any non-quiz overlay event */
function getInstructionText(event: AnyVideoOverlayEvent): string {
  switch (event.type) {
    case 'REFLECT':
      return event.content.prompt;
    case 'PREP':
    case 'RECORD':
    case 'LISTEN':
    case 'UPLOAD':
      return event.content.instruction;
    default:
      return '';
  }
}

/** Extracts optional detail text from an overlay event, if present */
function getDetailText(event: AnyVideoOverlayEvent): string | undefined {
  switch (event.type) {
    case 'PREP':
      return event.content.detail;
    case 'LISTEN':
      return event.content.listenFor;
    case 'REFLECT':
      return event.content.placeholder;
    case 'RECORD':
      return event.content.durationHint
        ? `Suggested duration: ~${event.content.durationHint}s`
        : undefined;
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GenericOverlayProps {
  /** The current non-quiz overlay event */
  event: AnyVideoOverlayEvent;
  /** Position in timeline (1-based) */
  eventNumber: number;
  /** Total overlay events */
  totalEvents: number;
  /** Called when user clicks Continue */
  onContinue: () => void;
  /** Controls visibility */
  isVisible: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Glassmorphic overlay for non-quiz overlay types (PREP, RECORD, LISTEN, UPLOAD, REFLECT).
 *
 * Renders a centered 16:9 glass card matching the visual style of
 * UnderstandQuestionOverlay, with a color-coded type badge, icon,
 * main instruction text, optional detail text, and a Continue button.
 */
export const GenericOverlay = React.memo(function GenericOverlay({
  event,
  eventNumber,
  totalEvents,
  onContinue,
  isVisible,
}: GenericOverlayProps) {
  const handleContinue = useCallback(() => {
    onContinue();
  }, [onContinue]);

  if (!isVisible) return null;

  // QUIZ events are handled by UnderstandQuestionOverlay, not here
  if (event.type === 'QUIZ') return null;

  const config = TYPE_CONFIG[event.type];
  const Icon = config.icon;
  const instruction = getInstructionText(event);
  const detail = getDetailText(event);

  return (
    <div
      className={cn(
        'absolute inset-0 z-10',
        'flex items-center justify-center',
        'bg-black/30 backdrop-blur-sm',
        'animate-fade-in',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="overlay-instruction"
    >
      {/* Progress indicator */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <span className="text-white/40 text-xs sm:text-sm">
          {eventNumber} / {totalEvents}
        </span>
      </div>

      {/* Content area */}
      <div className="w-full h-full flex items-center justify-center p-4 sm:p-6 md:p-8 animate-fade-in-up">
        {/* Glassmorphism card with 16:9 aspect ratio */}
        <div
          className={cn(
            'relative w-[85%] max-w-3xl',
            'rounded-2xl sm:rounded-3xl',
            'bg-white/[0.03] backdrop-blur-xl',
            'border border-white/[0.08]',
            'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
          )}
          style={{ aspectRatio: '16 / 9' }}
        >
          {/* Content positioned absolutely to respect aspect ratio */}
          <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto">
            <div className="w-full max-w-lg">
              <div className="flex flex-col gap-4 sm:gap-5">
                {/* Type badge */}
                <div className="flex justify-center">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border',
                      config.color,
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {config.label}
                  </span>
                </div>

                {/* Main instruction text */}
                <div id="overlay-instruction" className="text-center">
                  <h2 className="text-base sm:text-lg md:text-xl font-normal text-white/90 leading-snug">
                    {instruction}
                  </h2>
                </div>

                {/* Optional detail text */}
                {detail && (
                  <div className="text-center">
                    <p className="text-sm text-white/50 leading-relaxed">
                      {detail}
                    </p>
                  </div>
                )}

                {/* Continue button */}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleContinue}
                    className={cn(
                      'px-5 py-2 rounded-lg text-sm transition-all duration-150',
                      'bg-white text-black hover:bg-white/90',
                    )}
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
