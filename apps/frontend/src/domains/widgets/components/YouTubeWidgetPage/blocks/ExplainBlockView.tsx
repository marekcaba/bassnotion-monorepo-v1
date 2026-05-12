'use client';

import React, { useState, useCallback } from 'react';
import type { TutorialBlock, ExplainMediaItem } from '@bassnotion/contracts';
import { ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';

interface ExplainBlockViewProps {
  block: TutorialBlock<'explain'>;
  isActive: boolean;
  isCompleted: boolean;
  onComplete: () => void;
  onNext: () => void;
}

// ---------------------------------------------------------------------------
// Media item renderers
// ---------------------------------------------------------------------------

const TextItem = React.memo(function TextItem({ item }: { item: ExplainMediaItem }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none text-white/80 whitespace-pre-wrap">
      {item.content}
    </div>
  );
});

const ImageItem = React.memo(function ImageItem({ item }: { item: ExplainMediaItem }) {
  if (!item.imageUrl) return null;
  return (
    <figure className="space-y-2">
      <img
        src={item.imageUrl}
        alt={item.alt || item.caption || ''}
        className="w-full rounded-xl object-cover"
      />
      {item.caption && (
        <figcaption className="text-xs text-white/40 text-center italic">
          {item.caption}
        </figcaption>
      )}
    </figure>
  );
});

const VideoItem = React.memo(function VideoItem({ item }: { item: ExplainMediaItem }) {
  if (!item.videoUrl || !item.videoLibraryId) return null;
  return (
    <div className="aspect-video w-full rounded-xl overflow-hidden">
      <iframe
        src={`https://iframe.mediadelivery.net/embed/${item.videoLibraryId}/${item.videoUrl}?autoplay=false&preload=true`}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        frameBorder="0"
        title="Explanation video"
      />
    </div>
  );
});

const AudioItem = React.memo(function AudioItem({ item }: { item: ExplainMediaItem }) {
  if (!item.audioUrl) return null;
  return (
    <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
      <Volume2 className="w-5 h-5 text-white/40 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {item.audioLabel && (
          <p className="text-xs text-white/50 mb-1.5">{item.audioLabel}</p>
        )}
        <audio controls className="w-full h-8 [&::-webkit-media-controls-panel]:bg-white/5">
          <source src={item.audioUrl} />
        </audio>
      </div>
    </div>
  );
});

const ITEM_RENDERERS: Record<string, React.ComponentType<{ item: ExplainMediaItem }>> = {
  text: TextItem,
  image: ImageItem,
  video: VideoItem,
  audio: AudioItem,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const ExplainBlockView = React.memo(function ExplainBlockView({
  block,
  onComplete,
  onNext,
}: ExplainBlockViewProps) {
  const { heading, slides } = block.config;
  const [currentSlide, setCurrentSlide] = useState(0);

  const totalSlides = slides.length;
  const isFirstSlide = currentSlide === 0;
  const isLastSlide = currentSlide >= totalSlides - 1;
  const isSingleSlide = totalSlides <= 1;
  const activeSlide = slides[currentSlide];

  const handlePrev = useCallback(() => {
    setCurrentSlide((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentSlide((prev) => Math.min(totalSlides - 1, prev + 1));
  }, [totalSlides]);

  const handleContinue = useCallback(() => {
    onComplete();
    onNext();
  }, [onComplete, onNext]);

  // Empty state
  if (totalSlides === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-white/30 text-sm">No content yet</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="mx-auto px-4 w-full max-w-2xl flex flex-col gap-4">
        {/* Heading */}
        {heading && (
          <h2 className="text-2xl font-bold text-white text-center">{heading}</h2>
        )}

        {/* Slide card */}
        <div className="relative">
          {/* Left arrow */}
          {!isSingleSlide && !isFirstSlide && (
            <button
              onClick={handlePrev}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-center transition-colors z-10"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5 text-white/70" />
            </button>
          )}

          {/* Slide content */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 min-h-[200px] overflow-y-auto max-h-[60vh]">
            {activeSlide.title && (
              <h3 className="text-lg font-semibold text-white mb-4">
                {activeSlide.title}
              </h3>
            )}
            <div className="space-y-4">
              {activeSlide.items.map((item) => {
                const Renderer = ITEM_RENDERERS[item.type];
                if (!Renderer) return null;
                return <Renderer key={item.id} item={item} />;
              })}
            </div>
          </div>

          {/* Right arrow */}
          {!isSingleSlide && !isLastSlide && (
            <button
              onClick={handleNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-center transition-colors z-10"
              aria-label="Next slide"
            >
              <ChevronRight className="w-5 h-5 text-white/70" />
            </button>
          )}
        </div>

        {/* Dot indicators */}
        {!isSingleSlide && (
          <div className="flex items-center justify-center gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => setCurrentSlide(i)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  i === currentSlide
                    ? 'bg-white/80 scale-125'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Continue button — shown on last slide (or single slide) */}
        {isLastSlide && (
          <div className="text-center">
            <button
              onClick={handleContinue}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-base tracking-wide shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200 inline-flex items-center gap-2"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
