'use client';

import React, { useState } from 'react';
import { DrummerWidget } from '@/domains/widgets/components/YouTubeWidgetPage/components/DrummerWidget';
import { MetronomeWidget } from '@/domains/widgets/components/YouTubeWidgetPage/components/MetronomeWidget';

export default function TestDrumsPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">
          🥁 Drum Kit Integration Test - Hydrogen Samples
        </h1>

        <div className="bg-slate-800/50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            Test Instructions
          </h2>
          <div className="text-slate-300 space-y-2">
            <p>• Click the Drum Kit selector to expand settings</p>
            <p>
              • Try different Hydrogen drum kits: TR-808, Hip-Hop, Acoustic,
              Techno
            </p>
            <p>• Click individual drum pads to test samples</p>
            <p>• Use the metronome to test admin-curated click sounds</p>
            <p>• Listen for professional drum samples instead of synthesis</p>
            <p>• Check browser console for sample loading messages</p>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Controls</h2>
          <div className="flex gap-4 mb-6">
            <button
              onClick={async () => {
                // Resume AudioContext on first user interaction
                if (typeof window !== 'undefined' && window.Tone) {
                  await window.Tone.start();
                }
                setIsPlaying(!isPlaying);
              }}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                isPlaying
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isPlaying ? '⏸️ Stop' : '▶️ Play'}
            </button>

            <div className="text-white flex items-center gap-4">
              Tempo:
              <input
                type="range"
                min="60"
                max="200"
                value={tempo}
                onChange={(e) => setTempo(parseInt(e.target.value))}
                className="w-32"
              />
              <span className="font-bold text-blue-400">{tempo} BPM</span>
            </div>
          </div>

          {/* Drum Widget */}
          <div className="max-w-2xl mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">
              Hydrogen Drum Kits
            </h3>
            <DrummerWidget
              isPlaying={isPlaying}
              isVisible={true}
              onToggleVisibility={() => {}}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              tempo={tempo}
            />
          </div>

          {/* Metronome Widget */}
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              Professional Metronome Clicks
            </h3>
            <MetronomeWidget
              tempo={tempo}
              isPlaying={isPlaying}
              isVisible={true}
              onToggleVisibility={() => {}}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              onTempoChange={setTempo}
            />
          </div>
        </div>

        <div className="bg-blue-900/30 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            🔧 Expected Behavior
          </h2>
          <div className="text-slate-300 space-y-2">
            <p>
              <strong>✅ If Hydrogen integration works:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>
                Console shows "🥁 Loaded Hydrogen kit: [kit-name]" messages
              </li>
              <li>
                Drum kits have distinct characteristics (TR-808 vs Acoustic vs
                Hip-Hop)
              </li>
              <li>
                Individual drum pad hits sound professional (kick, snare, hihat)
              </li>
              <li>
                Metronome has different click sound options (wood, metal,
                digital)
              </li>
              <li>No synthesis/artificial drum sounds</li>
            </ul>

            <p className="mt-4">
              <strong>❌ If still using fallback:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>Console shows Hydrogen loading errors</li>
              <li>All drum kits sound the same (synthesis)</li>
              <li>Basic/electronic drum sounds only</li>
              <li>Metronome uses basic beep sounds</li>
            </ul>

            <p className="mt-4">
              <strong>🎵 Available Hydrogen Kits:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>
                <strong>Classic TR-808:</strong> Authentic Roland electronic
                sounds
              </li>
              <li>
                <strong>TR-808/909 Hybrid:</strong> Combined Roland drum
                machines
              </li>
              <li>
                <strong>Hip-Hop Kit:</strong> Urban drums with deep bass
              </li>
              <li>
                <strong>Techno Kit:</strong> Modern electronic dance music
              </li>
              <li>
                <strong>Colombo Acoustic:</strong> Professional acoustic drum
                recordings
              </li>
              <li>
                <strong>Yamaha Vintage:</strong> Classic Yamaha vintage sounds
              </li>
              <li>
                <strong>Electric Empire:</strong> Synthesized percussion
              </li>
              <li>
                <strong>Boss DR-110:</strong> Classic drum machine
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
