'use client';

import React, { useState, useCallback } from 'react';
import {
  ChordInstrumentProcessor,
  ChordPreset,
} from '@/domains/playback/services/plugins/ChordInstrumentProcessor';
import * as Tone from 'tone';

/**
 * Test page for all 4 professional instruments:
 * 1. Salamander Grand Piano (Tone.Sampler)
 * 2. Nice Keys Rhodes (Future: samples, Current: synthesis)
 * 3. Drawbar Organ (Synthesis)
 * 4. Warm Pad (Synthesis)
 */
export default function TestProfessionalInstrumentsPage() {
  const [processor, setProcessor] = useState<ChordInstrumentProcessor | null>(
    null,
  );
  const [currentInstrument, setCurrentInstrument] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Ready to initialize...');

  const initializeProcessor = useCallback(async () => {
    try {
      setStatus('Initializing processor...');
      const proc = new ChordInstrumentProcessor();
      await proc.initialize();
      setProcessor(proc);
      setStatus('Processor initialized. Select an instrument.');
    } catch (error) {
      setStatus(`Error: ${error}`);
    }
  }, []);

  const loadInstrument = useCallback(
    async (instrumentName: string, preset: ChordPreset) => {
      if (!processor) return;

      try {
        setIsLoading(true);
        setStatus(`Loading ${instrumentName}...`);

        // Map preset to instrument name for loading
        const instrumentMap: Record<ChordPreset, string> = {
          [ChordPreset.PIANO]: 'acoustic_grand_piano',
          [ChordPreset.RHODES]: 'electric_piano_1',
          [ChordPreset.ORGAN]: 'drawbar_organ',
          [ChordPreset.PAD]: 'pad_2_warm',
          [ChordPreset.STRINGS]: 'string_ensemble_1',
          [ChordPreset.BRASS]: 'brass_section',
          [ChordPreset.SYNTH_LEAD]: 'lead_1_square',
          [ChordPreset.WARM_PAD]: 'pad_1_new_age',
        };

        await processor.loadPreset(preset);
        setCurrentInstrument(instrumentName);
        setStatus(`✅ ${instrumentName} loaded successfully!`);
      } catch (error) {
        setStatus(`Error loading ${instrumentName}: ${error}`);
      } finally {
        setIsLoading(false);
      }
    },
    [processor],
  );

  const playChord = useCallback(
    async (notes: string[]) => {
      if (!processor || !currentInstrument) return;

      try {
        // Start audio context if needed
        if (Tone.context.state !== 'running') {
          await Tone.start();
        }

        setStatus(`Playing chord: ${notes.join(', ')}`);
        processor.triggerChord(notes, { velocity: 0.7 });

        // Stop after 2 seconds
        setTimeout(() => {
          processor.stopChord();
        }, 2000);
      } catch (error) {
        setStatus(`Error playing chord: ${error}`);
      }
    },
    [processor, currentInstrument],
  );

  const playArpeggio = useCallback(
    async (notes: string[]) => {
      if (!processor || !currentInstrument) return;

      try {
        // Start audio context if needed
        if (Tone.context.state !== 'running') {
          await Tone.start();
        }

        setStatus(`Playing arpeggio: ${notes.join(', ')}`);

        // Play notes one by one
        notes.forEach((note, index) => {
          setTimeout(() => {
            processor.triggerChord([note], { velocity: 0.6 });
            setTimeout(() => processor.stopChord(), 500);
          }, index * 300);
        });
      } catch (error) {
        setStatus(`Error playing arpeggio: ${error}`);
      }
    },
    [processor, currentInstrument],
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">
        🎹 Professional Instruments Test
      </h1>

      {/* Status Display */}
      <div className="bg-gray-100 p-4 rounded mb-6">
        <p className="font-mono text-sm">{status}</p>
        {currentInstrument && (
          <p className="font-mono text-sm text-green-600 mt-2">
            Current Instrument: {currentInstrument}
          </p>
        )}
      </div>

      {/* Initialize Button */}
      {!processor && (
        <button
          onClick={initializeProcessor}
          className="bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600 mb-6"
        >
          Initialize Audio System
        </button>
      )}

      {/* Instrument Selection */}
      {processor && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="border rounded p-4">
            <h3 className="font-bold mb-2">🎹 Salamander Piano</h3>
            <p className="text-sm text-gray-600 mb-2">
              Professional samples via CDN
            </p>
            <button
              onClick={() =>
                loadInstrument('Salamander Grand Piano', ChordPreset.PIANO)
              }
              disabled={isLoading}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400 w-full"
            >
              Load Piano
            </button>
          </div>

          <div className="border rounded p-4">
            <h3 className="font-bold mb-2">🎸 Rhodes Electric</h3>
            <p className="text-sm text-gray-600 mb-2">
              FM synthesis (samples coming)
            </p>
            <button
              onClick={() =>
                loadInstrument('Rhodes Electric Piano', ChordPreset.RHODES)
              }
              disabled={isLoading}
              className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:bg-gray-400 w-full"
            >
              Load Rhodes
            </button>
          </div>

          <div className="border rounded p-4">
            <h3 className="font-bold mb-2">🎵 Drawbar Organ</h3>
            <p className="text-sm text-gray-600 mb-2">
              Hammond B3-style synthesis
            </p>
            <button
              onClick={() => loadInstrument('Drawbar Organ', ChordPreset.ORGAN)}
              disabled={isLoading}
              className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:bg-gray-400 w-full"
            >
              Load Organ
            </button>
          </div>

          <div className="border rounded p-4">
            <h3 className="font-bold mb-2">🎛️ Warm Pad</h3>
            <p className="text-sm text-gray-600 mb-2">Analog-style synthesis</p>
            <button
              onClick={() => loadInstrument('Warm Pad Synth', ChordPreset.PAD)}
              disabled={isLoading}
              className="bg-pink-500 text-white px-4 py-2 rounded hover:bg-pink-600 disabled:bg-gray-400 w-full"
            >
              Load Pad
            </button>
          </div>
        </div>
      )}

      {/* Chord Playing Controls */}
      {processor && currentInstrument && (
        <div>
          <h2 className="text-xl font-bold mb-4">Play Chords & Notes</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => playChord(['C4', 'E4', 'G4'])}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              C Major
            </button>
            <button
              onClick={() => playChord(['D4', 'F#4', 'A4'])}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              D Major
            </button>
            <button
              onClick={() => playChord(['G3', 'B3', 'D4'])}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              G Major
            </button>
            <button
              onClick={() => playChord(['A3', 'C#4', 'E4'])}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              A Major
            </button>
            <button
              onClick={() => playChord(['C4', 'Eb4', 'G4'])}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              C Minor
            </button>
            <button
              onClick={() => playChord(['F3', 'A3', 'C4', 'E4'])}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              F Major 7
            </button>
          </div>

          <h3 className="text-lg font-bold mb-2">Arpeggios</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <button
              onClick={() => playArpeggio(['C4', 'E4', 'G4', 'C5'])}
              className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600"
            >
              C Major Arp
            </button>
            <button
              onClick={() => playArpeggio(['A3', 'C4', 'E4', 'A4'])}
              className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600"
            >
              A Minor Arp
            </button>
            <button
              onClick={() => playArpeggio(['G3', 'B3', 'D4', 'G4', 'B4', 'D5'])}
              className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600"
            >
              G Major Scale
            </button>
          </div>
        </div>
      )}

      {/* Implementation Notes */}
      <div className="mt-12 bg-gray-50 p-6 rounded">
        <h2 className="text-xl font-bold mb-4">Implementation Status</h2>
        <ul className="space-y-2">
          <li className="flex items-center">
            <span className="text-green-500 mr-2">✅</span>
            <strong>Salamander Piano:</strong> Real samples from Tone.js CDN
            (~2MB)
          </li>
          <li className="flex items-center">
            <span className="text-green-500 mr-2">✅</span>
            <strong>Drawbar Organ:</strong> Hammond B3-style synthesis with
            rotary effect
          </li>
          <li className="flex items-center">
            <span className="text-green-500 mr-2">✅</span>
            <strong>Warm Pad:</strong> Analog-style synthesis with chorus and
            filter
          </li>
          <li className="flex items-center">
            <span className="text-yellow-500 mr-2">⏳</span>
            <strong>Rhodes Electric:</strong> Currently using synthesis, real
            samples pending
          </li>
        </ul>
      </div>
    </div>
  );
}
