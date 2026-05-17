'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface LessonHeaderProps {
  /** Category/series name (e.g., "STARTER KIT") */
  category?: string;
  /** Lesson number within the category */
  lessonNumber?: number;
  /** Tutorial title */
  title: string;
  /** Words to highlight with gradient (case-insensitive match) */
  highlightWords?: string[];
  /** Optional className for container */
  className?: string;
}

/**
 * Renders title with optional gradient-highlighted words
 */
function TitleWithHighlights({
  title,
  highlightWords,
}: {
  title: string;
  highlightWords?: string[];
}) {
  const renderedTitle = useMemo(() => {
    if (!highlightWords || highlightWords.length === 0) {
      return title;
    }

    // Create a regex pattern to match any of the highlight words (case-insensitive)
    // Match whole words only
    const pattern = new RegExp(
      `\\b(${highlightWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
      'gi',
    );

    const parts: { text: string; highlight: boolean }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(title)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({
          text: title.slice(lastIndex, match.index),
          highlight: false,
        });
      }
      // Add the matched word
      parts.push({ text: match[0], highlight: true });
      lastIndex = pattern.lastIndex;
    }

    // Add remaining text
    if (lastIndex < title.length) {
      parts.push({ text: title.slice(lastIndex), highlight: false });
    }

    return parts.map((part, i) =>
      part.highlight ? (
        <span
          key={i}
          className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent"
        >
          {part.text}
        </span>
      ) : (
        <span key={i}>{part.text}</span>
      ),
    );
  }, [title, highlightWords]);

  return <>{renderedTitle}</>;
}

/**
 * Context header for Act 1: Understand
 * Shows lesson category, number, title, and one-line pitch
 */
export function LessonHeader({
  category,
  lessonNumber,
  title,
  highlightWords,
  className,
}: LessonHeaderProps) {
  return (
    <div
      className={cn(
        'text-center max-w-[64rem] mx-auto relative z-10',
        className,
      )}
    >
      {/* Category badge with lesson number */}
      {category && (
        <span
          className={cn(
            'inline-block px-4 py-1.5 rounded-full text-sm font-medium',
            'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
            'mb-4',
          )}
        >
          {category.toUpperCase()}
          {lessonNumber != null && ` · LESSON ${lessonNumber}`}
        </span>
      )}

      {/* Title */}
      <h1
        className="text-4xl sm:text-5xl md:text-6xl font-semibold text-white mb-3 tracking-wide"
        style={{ fontFamily: 'var(--font-podium-sharp), sans-serif' }}
      >
        <TitleWithHighlights title={title} highlightWords={highlightWords} />
      </h1>
    </div>
  );
}
