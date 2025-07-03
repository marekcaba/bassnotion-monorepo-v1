'use client';

import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { useYouTubeChannelData } from '../../hooks/useYouTubeChannelData';
import type { Tutorial } from '@bassnotion/contracts';

interface CreatorInfoSectionProps {
  tutorialData?: Tutorial;
}

export function CreatorInfoSection({ tutorialData }: CreatorInfoSectionProps) {
  // Creator data from tutorial or fallback
  const defaultCreator = {
    name: 'Rick Astley',
    channelUrl: 'https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw',
    avatarUrl:
      'https://yt3.ggpht.com/ytc/AIdro_kGrq_Vgk8_3AvvjTJPb_Qp2Kk8z4f4z4f4z4f4z4f4z4f4z4f4z4f4z4f4z4f4z4=s176-c-k-c0x00ffffff-no-rj',
  };

  const creator = tutorialData?.creator_name
    ? {
        name: tutorialData.creator_name,
        channelUrl: tutorialData.creator_channel_url || '',
        avatarUrl: tutorialData.creator_avatar_url || '',
      }
    : defaultCreator;

  // Fetch live YouTube subscriber data from cached backend
  const { subscriberCount, isLoading } = useYouTubeChannelData(
    creator.channelUrl,
    creator.name,
  );

  // Don't render if no creator data
  if (!creator || !creator.name) {
    return null;
  }

  return (
    <div className="w-[90%] mx-auto">
      {/* 90% width as requested */}
      {/* Creator Attribution - YouTube Style */}
      <div className="flex items-center gap-3 p-3 bg-slate-800/40 backdrop-blur-xl rounded-lg border border-slate-700/50 shadow-lg">
        {/* Creator Avatar */}
        {creator.avatarUrl ? (
          <a
            href={creator.channelUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0"
          >
            <img
              src={creator.avatarUrl}
              alt={`${creator.name} avatar`}
              className="w-10 h-10 rounded-full object-cover border-2 border-slate-600"
            />
          </a>
        ) : (
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-sm font-medium">
            {creator.name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Creator Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {creator.channelUrl ? (
              <a
                href={creator.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-blue-300 text-sm font-medium transition-colors duration-200 truncate"
              >
                {creator.name}
              </a>
            ) : (
              <p className="text-white text-sm font-medium truncate">
                {creator.name}
              </p>
            )}
            {/* Verified Badge - You can add this if needed */}
            {/* <div className="w-4 h-4 bg-gray-500 rounded-full flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div> */}
          </div>
          {/* Subscriber Count - Live YouTube API integration */}
          <p className="text-slate-400 text-xs">
            {isLoading
              ? 'Loading...'
              : subscriberCount === 'Subscribe'
                ? 'Subscribe to see subscriber count'
                : subscriberCount}
          </p>
        </div>

        {/* Follow Button - YouTube Style */}
        <div className="flex-shrink-0">
          {creator.channelUrl ? (
            <Button
              size="sm"
              className="bg-white hover:bg-gray-100 text-black font-medium px-4 py-2 rounded-full transition-colors duration-200"
              onClick={() =>
                window.open(creator.channelUrl, '_blank', 'noopener,noreferrer')
              }
            >
              Subscribe
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-gray-500 hover:bg-gray-600 text-white font-medium px-4 py-2 rounded-full"
              disabled
            >
              Subscribe
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
