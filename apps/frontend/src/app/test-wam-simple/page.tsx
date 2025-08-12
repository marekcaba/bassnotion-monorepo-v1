'use client';

import React, { useState, useEffect } from 'react';
import { DrummerWidget } from '@/domains/widgets/components/YouTubeWidgetPage/components/DrummerWidget';
import { GlobalControlsCard } from '@/domains/widgets/components/YouTubeWidgetPage/components/GlobalControlsCard';

export default function TestWamSimplePage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [useWamDrummer, setUseWamDrummer] = useState(false);

  const handlePlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold mb-8">Simple WAM Drummer Test</h1>
        
        {/* Configuration */}
        <div className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2">Configuration</h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useWamDrummer}
              onChange={(e) => setUseWamDrummer(e.target.checked)}
              className="rounded"
            />
            <span>Use WAM Drummer (instead of legacy Tone.js)</span>
          </label>
        </div>

        {/* Global Controls - this handles transport */}
        <GlobalControlsCard 
          isPlaying={isPlaying}
          onTogglePlay={handlePlay}
        />

        {/* Drummer Widget */}
        <div className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">
            Drummer Widget {useWamDrummer ? '(WAM Mode)' : '(Legacy Mode)'}
          </h2>
          <DrummerWidget
            pattern="Rock Steady"
            isVisible={true}
            onPatternChange={(pattern) => console.log('Pattern changed:', pattern)}
            onToggleVisibility={() => console.log('Toggle visibility')}
            enableWamDrummer={useWamDrummer}
          />
        </div>

        {/* Instructions */}
        <div className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2">Instructions</h2>
          <ol className="list-decimal list-inside text-sm text-slate-400 space-y-1">
            <li>Toggle "Use WAM Drummer" to switch between legacy and WAM modes</li>
            <li>Use the Global Controls to play/stop and adjust tempo</li>
            <li>Click on the Drummer Widget to test sounds</li>
            <li>Expand the widget (click the pattern grid) to modify the drum pattern</li>
            <li>Check the console for debug logs</li>
          </ol>
        </div>
      </div>
    </div>
  );
}