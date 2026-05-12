'use client';

/**
 * VideoBlockForm - Configuration form for Video blocks.
 *
 * Allows editing Bunny Stream video ID, library ID, headline,
 * and managing timed overlay events via the unified timeline editor.
 */

import React, { useCallback, useMemo } from 'react';
import type { VideoBlockConfig, AnyVideoOverlayEvent } from '@bassnotion/contracts';
import { resolveOverlayEvents } from '@bassnotion/contracts';
import { OverlayTimelineEditor } from '../../OverlayTimelineEditor.js';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface VideoBlockFormProps {
  config: VideoBlockConfig;
  onChange: (config: VideoBlockConfig) => void;
}

export const VideoBlockForm = React.memo(function VideoBlockForm({
  config,
  onChange,
}: VideoBlockFormProps) {
  const handleFieldChange = useCallback(
    (field: keyof VideoBlockConfig, value: string) => {
      onChange({ ...config, [field]: value });
    },
    [config, onChange],
  );

  const overlayEvents = useMemo(
    () => config.overlayEvents ?? resolveOverlayEvents(config),
    [config],
  );

  const handleOverlayEventsChange = useCallback(
    (events: AnyVideoOverlayEvent[]) => {
      onChange({ ...config, overlayEvents: events });
    },
    [config, onChange],
  );

  const hasVideo = config.videoUrl && config.videoLibraryId;

  return (
    <div className="space-y-4">
      {/* Video Preview */}
      {hasVideo && (
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-gray-900">
          <iframe
            src={`https://iframe.mediadelivery.net/embed/${config.videoLibraryId}/${config.videoUrl}?autoplay=false`}
            className="w-full h-full"
            loading="lazy"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            frameBorder="0"
          />
        </div>
      )}

      {/* Video ID + Library ID on one row */}
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <label className="block text-xs text-white/40 mb-1">Video ID</label>
          <input
            type="text"
            value={config.videoUrl ?? ''}
            onChange={(e) => handleFieldChange('videoUrl', e.target.value)}
            placeholder="e.g. c9242729-b4d2-4bc3-a18a-626490752288"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 font-mono"
          />
        </div>
        <div className="w-28">
          <label className="block text-xs text-white/40 mb-1">Library ID</label>
          <input
            type="text"
            value={config.videoLibraryId ?? ''}
            onChange={(e) => handleFieldChange('videoLibraryId', e.target.value)}
            placeholder="e.g. 583585"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 font-mono"
          />
        </div>
      </div>

      {/* Headline */}
      <div>
        <label className="block text-xs text-white/40 mb-1">Headline</label>
        <input
          type="text"
          value={config.headline ?? ''}
          onChange={(e) => handleFieldChange('headline', e.target.value)}
          placeholder="One-line pitch (e.g., 'Before you play, know where your notes live.')"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20"
        />
      </div>

      {/* Overlay Timeline */}
      <div className="border-t border-white/10 pt-4">
        <OverlayTimelineEditor
          events={overlayEvents}
          onEventsChange={handleOverlayEventsChange}
        />
      </div>
    </div>
  );
});
