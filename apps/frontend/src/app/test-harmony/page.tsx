'use client';

import React, { useState } from 'react';
import { HarmonyWidget } from '@/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidget';

export default function TestHarmonyPage() {
  console.log('🚨 TestHarmonyPage component is rendering!');

  const [isPlaying, setIsPlaying] = useState(false);
  const [progression] = useState(['C', 'G', 'Am', 'F']);
  const [currentChord, setCurrentChord] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">
          🎹 Harmony Widget Test - Soundfont Loading Fix
        </h1>

        <div className="bg-slate-800/50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            Test Instructions
          </h2>
          <div className="text-slate-300 space-y-2">
            <p>
              • Click the harmony widget chord progression to expand settings
            </p>
            <p>• Try different presets: Piano, Rhodes, Organ</p>
            <p>• Click Play to start the harmony progression</p>
            <p>• Listen for real instrument samples instead of synthesis</p>
            <p>• Check browser console for soundfont loading messages</p>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Controls</h2>
          <div className="flex gap-4 mb-6">
            <button
              onClick={async () => {
                console.log(
                  '🎵 Play button clicked - pre-activating AudioContext...',
                );

                // Resume AudioContext on first user interaction
                if (typeof window !== 'undefined' && window.Tone) {
                  await window.Tone.start();
                }

                // CRITICAL: Pre-activate all chord processors before starting playback
                // This must happen with user gesture to maintain audio permission
                if (!isPlaying && typeof window !== 'undefined') {
                  try {
                    // Find the harmony widget's chord processor and pre-activate it
                    const AudioContextClass =
                      window.AudioContext || window.webkitAudioContext;
                    const preActivatedContext = new AudioContextClass();
                    if (preActivatedContext.state === 'suspended') {
                      await preActivatedContext.resume();
                    }
                    console.log(
                      '🎵 Pre-activated AudioContext for harmony widget with user gesture',
                    );

                    // Store globally for harmony widget to use
                    window.preActivatedHarmonyContext = preActivatedContext;
                  } catch (error) {
                    console.warn(
                      '🎵 Failed to pre-activate AudioContext:',
                      error,
                    );
                  }
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

            <button
              onClick={async () => {
                console.log('🔊 Test Audio button clicked!');

                try {
                  // Check if Web Audio API is available
                  const AudioContextClass =
                    window.AudioContext || window.webkitAudioContext;
                  if (!AudioContextClass) {
                    console.error(
                      '❌ Web Audio API not supported in this browser',
                    );
                    alert('Web Audio API not supported in this browser');
                    return;
                  }

                  console.log('✅ Web Audio API is available');

                  // Create audio context
                  const audioContext = new AudioContextClass();
                  console.log(
                    `🔊 AudioContext created, state: ${audioContext.state}`,
                  );
                  console.log(
                    `🔊 Test button AudioContext instance:`,
                    audioContext,
                  );

                  // Resume context if suspended
                  if (audioContext.state === 'suspended') {
                    console.log('🔊 Resuming suspended AudioContext...');
                    await audioContext.resume();
                    console.log(
                      `🔊 AudioContext resumed, new state: ${audioContext.state}`,
                    );
                  }

                  // Create oscillator
                  const oscillator = audioContext.createOscillator();
                  const gainNode = audioContext.createGain();

                  console.log('🔊 Created oscillator and gain node');

                  // Connect audio graph
                  oscillator.connect(gainNode);
                  gainNode.connect(audioContext.destination);

                  // Set parameters
                  oscillator.frequency.value = 440; // A4
                  gainNode.gain.value = 0.5; // Increased volume
                  oscillator.type = 'sine';

                  console.log('🔊 Audio graph connected and configured');
                  console.log(
                    `🔊 AudioContext state: ${audioContext.state}, sampleRate: ${audioContext.sampleRate}`,
                  );
                  console.log(
                    `🔊 Destination channels: ${audioContext.destination.channelCount}, maxChannels: ${audioContext.destination.maxChannelCount}`,
                  );
                  console.log(
                    `🔊 Playing 440Hz sine wave at gain ${gainNode.gain.value} for 1 second...`,
                  );

                  // Start playing
                  oscillator.start();

                  // Stop after 1 second
                  setTimeout(() => {
                    try {
                      oscillator.stop();
                      console.log('🔊 Test tone stopped');
                    } catch (error) {
                      console.error('❌ Error stopping oscillator:', error);
                    }
                  }, 1000);

                  // Monitor ended event
                  oscillator.addEventListener('ended', () => {
                    console.log('🔊 Oscillator ended event fired');
                  });
                } catch (error) {
                  console.error('❌ Error in test audio:', error);
                  alert(`Audio test failed: ${error.message}`);
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
            >
              🔊 Test Audio
            </button>

            <div className="text-white flex items-center">
              Current chord:{' '}
              <span className="ml-2 font-bold text-blue-400">
                {progression[currentChord]}
              </span>
            </div>
          </div>

          {/* Harmony Widget */}
          <div className="max-w-2xl">
            <HarmonyWidget
              progression={progression}
              currentChord={currentChord}
              isPlaying={isPlaying}
              isVisible={true}
              onNextChord={() =>
                setCurrentChord((prev) => (prev + 1) % progression.length)
              }
              onProgressionChange={(newProgression) => {
                console.log('Progression changed:', newProgression);
              }}
              onToggleVisibility={() => {}}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              tempo={120}
            />
          </div>
        </div>

        <div className="bg-yellow-900/30 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-yellow-400 mb-4">
            🎹 To Hear Salamander Grand Piano (Real Samples)
          </h2>
          <ol className="text-yellow-200 space-y-2 list-decimal list-inside">
            <li>
              Click on the chord progression (C - G - Am - F) to expand the
              widget
            </li>
            <li>
              Find the instrument preset selector (currently showing "Rhodes" or
              "Pad")
            </li>
            <li>
              Select <strong>"Piano"</strong> from the dropdown
            </li>
            <li>
              Wait for "Successfully loaded Salamander Grand Piano" in console
            </li>
            <li>
              Click Play - you'll hear real piano samples instead of synthesis!
            </li>
          </ol>
          <p className="text-yellow-300 mt-4 text-sm">
            Current presets: Piano (real samples), Rhodes/Organ/Pad (synthesis)
          </p>
        </div>

        <div className="bg-blue-900/30 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            🔧 Expected Behavior
          </h2>
          <div className="text-slate-300 space-y-2">
            <p>
              <strong>✅ If fix works:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>Console shows "🎼 Soundfont loaded successfully" messages</li>
              <li>
                Different presets sound like real piano, Rhodes, organ
                instruments
              </li>
              <li>No synthesis/artificial sounds</li>
              <li>Rich, realistic chord voicings</li>
            </ul>

            <p className="mt-4">
              <strong>❌ If still broken:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>Console shows soundfont loading errors</li>
              <li>All presets sound the same (synthesis)</li>
              <li>Artificial/electronic chord sounds</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
