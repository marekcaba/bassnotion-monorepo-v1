'use client';

import React, { useState } from 'react';
import { DrummerWidget } from '@/domains/widgets/components/YouTubeWidgetPage/components/DrummerWidget';

export default function TestDrumsDirectPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [pattern, setPattern] = useState('Rock Beat');

  const handlePlayToggle = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-white mb-8">Drum Sample Loading Test</h1>
        
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-2">Instructions:</h2>
          <ol className="text-gray-300 space-y-1 list-decimal list-inside">
            <li>Click anywhere on the page to initialize audio context</li>
            <li>Check the console for loading status messages</li>
            <li>Expand the drummer widget (click the pattern grid)</li>
            <li>Click on HH, SN, or K labels to test individual sounds</li>
            <li>Check console for trigger messages</li>
          </ol>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">DrummerWidget Test</h2>
          <DrummerWidget
            pattern={pattern}
            isPlaying={isPlaying}
            isVisible={true}
            onPatternChange={setPattern}
            onToggleVisibility={() => {}}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
          />
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <button
            onClick={handlePlayToggle}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {isPlaying ? 'Stop' : 'Play'} Pattern
          </button>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg text-gray-300">
          <h3 className="text-white font-semibold mb-2">Expected Supabase Paths:</h3>
          <ul className="space-y-1 font-mono text-sm">
            <li>Kick: audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110kik.mp3</li>
            <li>Snare: audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110clp.mp3</li>
            <li>Hihat: audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110cht.mp3</li>
          </ul>
        </div>
      </div>
    </div>
  );
}