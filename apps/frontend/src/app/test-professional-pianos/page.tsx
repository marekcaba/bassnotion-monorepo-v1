'use client';

import React, { useState, useEffect } from 'react';
import * as Tone from 'tone';
import { SalamanderVelocitySampler } from '@/domains/playback/services/plugins/SalamanderVelocitySampler';
import { WurlitzerVelocitySampler } from '@/domains/playback/services/plugins/WurlitzerVelocitySampler';
import { LongPadSampler } from '@/domains/playback/services/plugins/LongPadSampler';
import { RhodesVelocitySampler } from '@/domains/playback/services/plugins/RhodesVelocitySampler';
import { TheSawSampler } from '@/domains/playback/services/plugins/TheSawSampler';

type InstrumentType =
  | 'salamander'
  | 'wurlitzer'
  | 'longpad'
  | 'rhodes'
  | 'thesaw';

export default function TestProfessionalPianosPage() {
  const [salamanderSampler, setSalamanderSampler] =
    useState<SalamanderVelocitySampler | null>(null);
  const [wurlitzerSampler, setWurlitzerSampler] =
    useState<WurlitzerVelocitySampler | null>(null);
  const [longPadSampler, setLongPadSampler] = useState<LongPadSampler | null>(
    null,
  );
  const [rhodesSampler, setRhodesSampler] =
    useState<RhodesVelocitySampler | null>(null);
  const [theSawSampler, setTheSawSampler] = useState<TheSawSampler | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [salamanderLoaded, setSalamanderLoaded] = useState(false);
  const [wurlitzerLoaded, setWurlitzerLoaded] = useState(false);
  const [longPadLoaded, setLongPadLoaded] = useState(false);
  const [rhodesLoaded, setRhodesLoaded] = useState(false);
  const [theSawLoaded, setTheSawLoaded] = useState(false);
  const [activeInstrument, setActiveInstrument] =
    useState<InstrumentType>('salamander');
  const [velocity, setVelocity] = useState(64);
  const [noteLength, setNoteLength] = useState(1);
  const [status, setStatus] = useState('Ready to load instruments...');
  const [samplerStatus, setSamplerStatus] = useState<any>(null);
  const [mechanicalSounds, setMechanicalSounds] = useState(true);
  const [mechanicalVolume, setMechanicalVolume] = useState(0); // Default 0dB for testing

  // ADSR controls for Long Pad
  const [attack, setAttack] = useState(0.05);
  const [decay, setDecay] = useState(0.3);
  const [sustain, setSustain] = useState(1.0);
  const [release, setRelease] = useState(2.0);

  // The Saw Synth controls
  const [filterCutoff, setFilterCutoff] = useState(20000); // Fully open by default
  const [filterResonance, setFilterResonance] = useState(0); // No resonance by default

  // Get current sampler
  const currentSampler =
    activeInstrument === 'salamander'
      ? salamanderSampler
      : activeInstrument === 'wurlitzer'
        ? wurlitzerSampler
        : activeInstrument === 'longpad'
          ? longPadSampler
          : activeInstrument === 'rhodes'
            ? rhodesSampler
            : theSawSampler;
  const isCurrentLoaded =
    activeInstrument === 'salamander'
      ? salamanderLoaded
      : activeInstrument === 'wurlitzer'
        ? wurlitzerLoaded
        : activeInstrument === 'longpad'
          ? longPadLoaded
          : activeInstrument === 'rhodes'
            ? rhodesLoaded
            : theSawLoaded;

  // Velocity layer info
  const getVelocityLayer = (vel: number) => {
    if (activeInstrument === 'salamander') {
      // Salamander has 16 layers
      if (vel <= 8) return { name: 'ppp', layer: 'v1' };
      if (vel <= 16) return { name: 'pp-', layer: 'v2' };
      if (vel <= 24) return { name: 'pp', layer: 'v3' };
      if (vel <= 32) return { name: 'pp+', layer: 'v4' };
      if (vel <= 40) return { name: 'p-', layer: 'v5' };
      if (vel <= 48) return { name: 'p', layer: 'v6' };
      if (vel <= 56) return { name: 'p+', layer: 'v7' };
      if (vel <= 64) return { name: 'mp', layer: 'v8' };
      if (vel <= 72) return { name: 'mf-', layer: 'v9' };
      if (vel <= 80) return { name: 'mf', layer: 'v10' };
      if (vel <= 88) return { name: 'mf+', layer: 'v11' };
      if (vel <= 96) return { name: 'f-', layer: 'v12' };
      if (vel <= 104) return { name: 'f', layer: 'v13' };
      if (vel <= 112) return { name: 'f+', layer: 'v14' };
      if (vel <= 120) return { name: 'ff', layer: 'v15' };
      return { name: 'fff', layer: 'v16' };
    } else if (activeInstrument === 'wurlitzer') {
      // Wurlitzer has variable layers
      return { name: 'Dynamic', layer: 'Variable' };
    } else if (activeInstrument === 'rhodes') {
      // Rhodes has 4 velocity layers
      if (vel <= 31) return { name: 'p', layer: 'v1' };
      if (vel <= 63) return { name: 'mp', layer: 'v2' };
      if (vel <= 95) return { name: 'mf', layer: 'v3' };
      return { name: 'f', layer: 'v4' };
    } else if (activeInstrument === 'thesaw') {
      // The Saw has single velocity with filter control
      return { name: 'Synth', layer: 'Filter' };
    } else {
      // Long Pad has single velocity
      return { name: 'Pad', layer: 'Single' };
    }
  };

  const loadSalamander = async () => {
    if (salamanderLoaded) return;

    setIsLoading(true);
    setStatus('Loading Salamander Grand Piano...');

    try {
      await Tone.start();

      const newSampler = new SalamanderVelocitySampler();
      await newSampler.initialize();
      newSampler.connect(Tone.Destination);

      setSalamanderSampler(newSampler);
      setSalamanderLoaded(true);
      setStatus('✅ Salamander Grand Piano loaded!');

      if (activeInstrument === 'salamander') {
        const status = newSampler.getStatus();
        setSamplerStatus(status);
      }
    } catch (error) {
      console.error('Failed to load Salamander:', error);
      setStatus(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadLongPad = async () => {
    if (longPadLoaded) return;

    setIsLoading(true);
    setStatus('Loading Long Pad...');

    try {
      await Tone.start();

      const newSampler = new LongPadSampler();
      await newSampler.initialize();
      newSampler.connect(Tone.Destination);

      setLongPadSampler(newSampler);
      setLongPadLoaded(true);
      setStatus('✅ Long Pad loaded!');

      if (activeInstrument === 'longpad') {
        const status = newSampler.getStatus();
        setSamplerStatus(status);
      }
    } catch (error) {
      console.error('Failed to load Long Pad:', error);
      setStatus(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadRhodes = async () => {
    if (rhodesLoaded) return;

    setIsLoading(true);
    setStatus('Loading Fender Rhodes...');

    try {
      await Tone.start();

      const newSampler = new RhodesVelocitySampler();
      await newSampler.initialize();
      newSampler.connect(Tone.Destination);

      setRhodesSampler(newSampler);
      setRhodesLoaded(true);
      setStatus('✅ Fender Rhodes loaded!');

      if (activeInstrument === 'rhodes') {
        const status = newSampler.getStatus();
        setSamplerStatus(status);
      }
    } catch (error) {
      console.error('Failed to load Rhodes:', error);
      setStatus(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadWurlitzer = async () => {
    if (wurlitzerLoaded) return;

    setIsLoading(true);
    setStatus('Loading Wurlitzer Electric Piano...');

    try {
      await Tone.start();

      const newSampler = new WurlitzerVelocitySampler();
      await newSampler.initialize();
      newSampler.connect(Tone.Destination);

      // Preload some common notes to avoid initial loading issues
      setStatus('Preloading common notes...');
      await newSampler.preloadNotes([
        'C3',
        'D3',
        'E3',
        'F3',
        'G3',
        'A3',
        'B3',
        'C4',
        'D4',
        'E4',
        'F4',
        'G4',
        'A4',
        'B4',
        'C5',
        'D5',
      ]);

      setWurlitzerSampler(newSampler);
      setWurlitzerLoaded(true);
      setStatus('✅ Wurlitzer Electric Piano loaded!');

      if (activeInstrument === 'wurlitzer') {
        const status = newSampler.getStatus();
        setSamplerStatus(status);
      }
    } catch (error) {
      console.error('Failed to load Wurlitzer:', error);
      setStatus(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadTheSaw = async () => {
    if (theSawLoaded) return;

    setIsLoading(true);
    setStatus('Loading The Saw synthesizer...');

    try {
      await Tone.start();

      const newSampler = new TheSawSampler();
      await newSampler.initialize();
      newSampler.connect(Tone.Destination);

      setTheSawSampler(newSampler);
      setTheSawLoaded(true);
      setStatus('✅ The Saw synthesizer loaded!');

      if (activeInstrument === 'thesaw') {
        const status = newSampler.getStatus();
        setSamplerStatus(status);
      }
    } catch (error) {
      console.error('Failed to load The Saw:', error);
      setStatus(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const playNote = async (note: string) => {
    if (!isCurrentLoaded || !currentSampler) {
      alert(`Please load the ${activeInstrument} first!`);
      return;
    }

    if (activeInstrument === 'salamander') {
      await (currentSampler as SalamanderVelocitySampler).triggerAttackRelease(
        note,
        noteLength,
        undefined,
        velocity,
        mechanicalSounds,
      );
    } else if (activeInstrument === 'wurlitzer') {
      await (currentSampler as WurlitzerVelocitySampler).triggerAttackRelease(
        note,
        noteLength,
        undefined,
        velocity,
        mechanicalSounds,
      );
    } else if (activeInstrument === 'longpad') {
      await (currentSampler as LongPadSampler).triggerAttackRelease(
        note,
        noteLength,
        undefined,
        velocity / 127,
      );
    } else if (activeInstrument === 'rhodes') {
      await (currentSampler as RhodesVelocitySampler).triggerAttackRelease(
        note,
        noteLength,
        undefined,
        velocity,
      );
    } else {
      await (currentSampler as TheSawSampler).triggerAttackRelease(
        note,
        noteLength,
        undefined,
        velocity / 127,
      );
    }

    // Update status
    const status = currentSampler.getStatus();
    setSamplerStatus(status);
  };

  const playScale = async () => {
    if (!isCurrentLoaded || !currentSampler) {
      alert(`Please load the ${activeInstrument} first!`);
      return;
    }

    const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
    const time = Tone.now();

    // Schedule all notes at once without awaiting each one
    for (let i = 0; i < notes.length; i++) {
      const noteTime = time + i * 0.25;
      if (activeInstrument === 'salamander') {
        // Don't await - let them schedule in parallel
        (currentSampler as SalamanderVelocitySampler).triggerAttackRelease(
          notes[i],
          '8n',
          noteTime,
          velocity,
          mechanicalSounds,
        );
      } else if (activeInstrument === 'wurlitzer') {
        // Don't await - let them schedule in parallel
        (currentSampler as WurlitzerVelocitySampler).triggerAttackRelease(
          notes[i],
          '16n',
          noteTime,
          velocity,
          mechanicalSounds,
        );
      } else if (activeInstrument === 'longpad') {
        // Don't await - let them schedule in parallel
        (currentSampler as LongPadSampler).triggerAttackRelease(
          notes[i],
          '4n',
          noteTime,
          velocity / 127,
        );
      } else if (activeInstrument === 'rhodes') {
        // Rhodes - Don't await - let them schedule in parallel
        (currentSampler as RhodesVelocitySampler).triggerAttackRelease(
          notes[i],
          '8n',
          noteTime,
          velocity,
        );
      } else {
        // The Saw - Don't await - let them schedule in parallel
        (currentSampler as TheSawSampler).triggerAttackRelease(
          notes[i],
          '8n',
          noteTime,
          velocity / 127,
        );
      }
    }
  };

  const playChord = async () => {
    if (!isCurrentLoaded || !currentSampler) {
      alert(`Please load the ${activeInstrument} first!`);
      return;
    }

    const chord = ['C4', 'E4', 'G4', 'C5'];
    if (activeInstrument === 'salamander') {
      await (currentSampler as SalamanderVelocitySampler).triggerAttackRelease(
        chord,
        noteLength,
        undefined,
        velocity,
        mechanicalSounds,
      );
    } else if (activeInstrument === 'wurlitzer') {
      await (currentSampler as WurlitzerVelocitySampler).triggerAttackRelease(
        chord,
        noteLength,
        undefined,
        velocity,
        mechanicalSounds,
      );
    } else if (activeInstrument === 'longpad') {
      await (currentSampler as LongPadSampler).triggerAttackRelease(
        chord,
        noteLength,
        undefined,
        velocity / 127,
      );
    } else if (activeInstrument === 'rhodes') {
      await (currentSampler as RhodesVelocitySampler).triggerAttackRelease(
        chord,
        noteLength,
        undefined,
        velocity,
      );
    } else {
      await (currentSampler as TheSawSampler).triggerAttackRelease(
        chord,
        noteLength,
        undefined,
        velocity / 127,
      );
    }
  };

  const playVelocityDemo = async () => {
    if (!isCurrentLoaded || !currentSampler) {
      alert(`Please load the ${activeInstrument} first!`);
      return;
    }

    setStatus('🎵 Playing velocity demonstration...');
    const velocities = [20, 40, 60, 80, 100, 120];
    const now = Tone.now();

    // Pre-load velocities for Salamander
    if (activeInstrument === 'salamander') {
      await (currentSampler as SalamanderVelocitySampler).preloadVelocities(
        velocities,
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    for (let i = 0; i < velocities.length; i++) {
      const noteTime = now + i * 0.7;
      if (activeInstrument === 'salamander') {
        // Schedule notes but don't await - let them handle their own loading
        (currentSampler as SalamanderVelocitySampler).triggerAttackRelease(
          'C4',
          '4n',
          noteTime,
          velocities[i],
          mechanicalSounds,
        );
      } else if (activeInstrument === 'wurlitzer') {
        // For immediate playback, await; for scheduled, don't await
        if (i === 0) {
          await (
            currentSampler as WurlitzerVelocitySampler
          ).triggerAttackRelease(
            'E4',
            '4n',
            noteTime,
            velocities[i],
            mechanicalSounds,
          );
        } else {
          (currentSampler as WurlitzerVelocitySampler).triggerAttackRelease(
            'E4',
            '4n',
            noteTime,
            velocities[i],
            mechanicalSounds,
          );
        }
      } else if (activeInstrument === 'longpad') {
        // Long Pad doesn't have velocity layers, just vary the velocity parameter
        (currentSampler as LongPadSampler).triggerAttackRelease(
          'G3',
          '4n',
          noteTime,
          velocities[i] / 127,
        );
      } else if (activeInstrument === 'rhodes') {
        // Rhodes has 4 velocity layers
        (currentSampler as RhodesVelocitySampler).triggerAttackRelease(
          'F4',
          '4n',
          noteTime,
          velocities[i],
        );
      } else {
        // The Saw with filter modulation based on velocity
        (currentSampler as TheSawSampler).triggerAttackRelease(
          'C3',
          '4n',
          noteTime,
          velocities[i] / 127,
        );
      }
    }

    setTimeout(() => {
      setStatus('✅ Velocity demo complete! Notice how the timbre changes.');
      const status = currentSampler.getStatus();
      setSamplerStatus(status);
    }, 5000);
  };

  const testPedal = async () => {
    if (
      activeInstrument !== 'wurlitzer' ||
      !wurlitzerSampler ||
      !wurlitzerLoaded
    ) {
      alert('Pedal sounds are only available for Wurlitzer!');
      return;
    }

    const now = Tone.now();
    wurlitzerSampler.triggerPedalPress(now);
    wurlitzerSampler.triggerPedalRelease(now + 0.5);
  };

  const preloadAll = async () => {
    if (
      activeInstrument === 'salamander' &&
      salamanderSampler &&
      salamanderLoaded
    ) {
      setIsLoading(true);
      setStatus('Loading all 16 velocity layers...');

      try {
        await salamanderSampler.preloadAll();
        setStatus('✅ All 16 velocity layers loaded!');

        const status = salamanderSampler.getStatus();
        setSamplerStatus(status);
      } catch (error) {
        setStatus(
          `❌ Error loading all layers: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      } finally {
        setIsLoading(false);
      }
    } else {
      alert('Preload all is only available for Salamander Grand Piano!');
    }
  };

  const velocityInfo = getVelocityLayer(velocity);

  useEffect(() => {
    // Update status when switching instruments
    if (activeInstrument === 'salamander' && salamanderSampler) {
      setSamplerStatus(salamanderSampler.getStatus());
    } else if (activeInstrument === 'wurlitzer' && wurlitzerSampler) {
      setSamplerStatus(wurlitzerSampler.getStatus());
    } else if (activeInstrument === 'longpad' && longPadSampler) {
      setSamplerStatus(longPadSampler.getStatus());
    } else if (activeInstrument === 'rhodes' && rhodesSampler) {
      setSamplerStatus(rhodesSampler.getStatus());
    } else if (activeInstrument === 'thesaw' && theSawSampler) {
      setSamplerStatus(theSawSampler.getStatus());
    }
  }, [
    activeInstrument,
    salamanderSampler,
    wurlitzerSampler,
    longPadSampler,
    rhodesSampler,
    theSawSampler,
  ]);

  // Update mechanical volume for both instruments
  useEffect(() => {
    if (wurlitzerSampler) {
      wurlitzerSampler.setMechanicalVolume(mechanicalVolume);
    }
    if (salamanderSampler) {
      salamanderSampler.setMechanicalVolume(mechanicalVolume);
    }
  }, [mechanicalVolume, wurlitzerSampler, salamanderSampler]);

  // Set default mechanical volume when switching instruments
  useEffect(() => {
    if (activeInstrument === 'salamander') {
      setMechanicalVolume(0); // 0dB for Salamander
    } else if (activeInstrument === 'wurlitzer') {
      setMechanicalVolume(-30); // -30dB for Wurlitzer
    }
  }, [activeInstrument]);

  useEffect(() => {
    return () => {
      salamanderSampler?.dispose();
      wurlitzerSampler?.dispose();
      longPadSampler?.dispose();
      rhodesSampler?.dispose();
      theSawSampler?.dispose();
    };
  }, [
    salamanderSampler,
    wurlitzerSampler,
    longPadSampler,
    rhodesSampler,
    theSawSampler,
  ]);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">
        🎹 Professional Piano Test Suite
      </h1>

      {/* Instrument Selector */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveInstrument('salamander')}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            activeInstrument === 'salamander'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >
          🎹 Salamander Grand Piano
        </button>
        <button
          onClick={() => setActiveInstrument('wurlitzer')}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            activeInstrument === 'wurlitzer'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >
          ⚡ Wurlitzer Electric Piano
        </button>
        <button
          onClick={() => setActiveInstrument('longpad')}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            activeInstrument === 'longpad'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >
          🌊 Long Pad
        </button>
        <button
          onClick={() => setActiveInstrument('rhodes')}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            activeInstrument === 'rhodes'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >
          🎸 Rhodes Electric Piano
        </button>
        <button
          onClick={() => setActiveInstrument('thesaw')}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            activeInstrument === 'thesaw'
              ? 'bg-orange-600 text-white'
              : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >
          🎛️ The Saw Synth
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controls Card */}
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h2 className="text-2xl font-semibold mb-4">Controls</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {activeInstrument === 'salamander'
              ? 'Professional grand piano with 16 velocity layers'
              : activeInstrument === 'wurlitzer'
                ? 'Vintage electric piano with variable velocity layers and mechanical sounds'
                : activeInstrument === 'longpad'
                  ? 'Atmospheric pad instrument with ADSR envelope control'
                  : activeInstrument === 'rhodes'
                    ? 'Classic Fender Rhodes electric piano with 4 velocity layers'
                    : 'Analog-style saw synthesizer with resonant filter and envelope control'}
          </p>

          {/* Load Buttons */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            <button
              onClick={loadSalamander}
              disabled={isLoading || salamanderLoaded}
              className={`px-4 py-2 rounded-md font-medium transition-colors
                ${salamanderLoaded ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'} 
                ${isLoading || salamanderLoaded ? 'opacity-60 cursor-not-allowed' : ''}
                text-white`}
            >
              {salamanderLoaded ? '✓ Salamander' : 'Load Salamander'}
            </button>
            <button
              onClick={loadWurlitzer}
              disabled={isLoading || wurlitzerLoaded}
              className={`px-4 py-2 rounded-md font-medium transition-colors
                ${wurlitzerLoaded ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-700'} 
                ${isLoading || wurlitzerLoaded ? 'opacity-60 cursor-not-allowed' : ''}
                text-white`}
            >
              {wurlitzerLoaded ? '✓ Wurlitzer' : 'Load Wurlitzer'}
            </button>
            <button
              onClick={loadLongPad}
              disabled={isLoading || longPadLoaded}
              className={`px-4 py-2 rounded-md font-medium transition-colors
                ${longPadLoaded ? 'bg-green-600' : 'bg-green-600 hover:bg-green-700'} 
                ${isLoading || longPadLoaded ? 'opacity-60 cursor-not-allowed' : ''}
                text-white`}
            >
              {longPadLoaded ? '✓ Long Pad' : 'Load Long Pad'}
            </button>
            <button
              onClick={loadRhodes}
              disabled={isLoading || rhodesLoaded}
              className={`px-4 py-2 rounded-md font-medium transition-colors
                ${rhodesLoaded ? 'bg-green-600' : 'bg-yellow-600 hover:bg-yellow-700'} 
                ${isLoading || rhodesLoaded ? 'opacity-60 cursor-not-allowed' : ''}
                text-white`}
            >
              {rhodesLoaded ? '✓ Rhodes' : 'Load Rhodes'}
            </button>
            <button
              onClick={loadTheSaw}
              disabled={isLoading || theSawLoaded}
              className={`px-4 py-2 rounded-md font-medium transition-colors
                ${theSawLoaded ? 'bg-green-600' : 'bg-orange-600 hover:bg-orange-700'} 
                ${isLoading || theSawLoaded ? 'opacity-60 cursor-not-allowed' : ''}
                text-white`}
            >
              {theSawLoaded ? '✓ The Saw' : 'Load The Saw'}
            </button>
          </div>

          {/* Velocity Control */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between">
              <label className="text-sm font-medium">
                Velocity (MIDI 0-127)
              </label>
              <span className="text-sm text-muted-foreground">
                {velocity} - {velocityInfo.name} ({velocityInfo.layer})
              </span>
            </div>
            <input
              type="range"
              value={velocity}
              onChange={(e) => setVelocity(Number(e.target.value))}
              min={0}
              max={127}
              step={1}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <div className="h-2 rounded-full bg-gradient-to-r from-blue-200 via-blue-500 to-blue-900" />
          </div>

          {/* Note Length Control */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between">
              <label className="text-sm font-medium">Note Length</label>
              <span className="text-sm text-muted-foreground">
                {noteLength}s
              </span>
            </div>
            <input
              type="range"
              value={noteLength}
              onChange={(e) => setNoteLength(Number(e.target.value))}
              min={0.1}
              max={6}
              step={0.1}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
          </div>

          {/* ADSR Controls for Long Pad */}
          {activeInstrument === 'longpad' && (
            <div className="space-y-3 mb-4 p-4 bg-muted rounded-lg">
              <h3 className="text-sm font-semibold mb-2">ADSR Envelope</h3>

              {/* Attack */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-xs font-medium">Attack</label>
                  <span className="text-xs text-muted-foreground">
                    {attack}s
                  </span>
                </div>
                <input
                  type="range"
                  value={attack}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setAttack(val);
                    longPadSampler?.setEnvelope({ attack: val });
                  }}
                  min={0}
                  max={2}
                  step={0.01}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
              </div>

              {/* Decay */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-xs font-medium">Decay</label>
                  <span className="text-xs text-muted-foreground">
                    {decay}s
                  </span>
                </div>
                <input
                  type="range"
                  value={decay}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDecay(val);
                    longPadSampler?.setEnvelope({ decay: val });
                  }}
                  min={0}
                  max={2}
                  step={0.01}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
              </div>

              {/* Sustain */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-xs font-medium">Sustain</label>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(sustain * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  value={sustain}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSustain(val);
                    longPadSampler?.setEnvelope({ sustain: val });
                  }}
                  min={0}
                  max={1}
                  step={0.01}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
              </div>

              {/* Release */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-xs font-medium">Release</label>
                  <span className="text-xs text-muted-foreground">
                    {release}s
                  </span>
                </div>
                <input
                  type="range"
                  value={release}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setRelease(val);
                    longPadSampler?.setEnvelope({ release: val });
                  }}
                  min={0}
                  max={5}
                  step={0.01}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
              </div>
            </div>
          )}

          {/* Filter Controls for The Saw */}
          {activeInstrument === 'thesaw' && (
            <div className="space-y-3 mb-4 p-4 bg-muted rounded-lg">
              <h3 className="text-sm font-semibold mb-2">Filter Controls</h3>

              {/* Filter Cutoff */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-xs font-medium">Filter Cutoff</label>
                  <span className="text-xs text-muted-foreground">
                    {filterCutoff}Hz
                  </span>
                </div>
                <input
                  type="range"
                  value={filterCutoff}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFilterCutoff(val);
                    theSawSampler?.setFilterCutoff(val);
                  }}
                  min={20}
                  max={20000}
                  step={10}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
              </div>

              {/* Filter Resonance */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-xs font-medium">Resonance (Q)</label>
                  <span className="text-xs text-muted-foreground">
                    {filterResonance}
                  </span>
                </div>
                <input
                  type="range"
                  value={filterResonance}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFilterResonance(val);
                    theSawSampler?.setFilterResonance(val);
                  }}
                  min={0}
                  max={10}
                  step={0.1}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
              </div>
            </div>
          )}

          {/* Mechanical Sounds Toggle */}
          {activeInstrument !== 'longpad' && activeInstrument !== 'thesaw' && (
            <>
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="mechanical"
                  checked={mechanicalSounds}
                  onChange={(e) => setMechanicalSounds(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="mechanical" className="text-sm font-medium">
                  Play mechanical sounds (
                  {activeInstrument === 'wurlitzer'
                    ? 'key press/release'
                    : 'damper release'}
                  )
                </label>
              </div>

              {/* Mechanical Volume Slider */}
              {mechanicalSounds && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Mechanical Volume Base: {mechanicalVolume}dB
                  </label>
                  <p className="text-xs text-gray-600 mb-2">
                    Volume scales with velocity: softer at low velocities,
                    louder at high velocities
                  </p>
                  <input
                    type="range"
                    min="-60"
                    max="0"
                    value={mechanicalVolume}
                    onChange={(e) =>
                      setMechanicalVolume(parseFloat(e.target.value))
                    }
                    step="1"
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                </div>
              )}
            </>
          )}

          {/* Playback Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => playNote('C4')}
              disabled={!isCurrentLoaded}
              className="px-3 py-2 rounded-md font-medium transition-colors bg-green-600 hover:bg-green-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              ▶️ Play C4
            </button>
            <button
              onClick={playScale}
              disabled={!isCurrentLoaded}
              className="px-3 py-2 rounded-md font-medium transition-colors bg-green-600 hover:bg-green-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              🎵 Play Scale
            </button>
            <button
              onClick={playChord}
              disabled={!isCurrentLoaded}
              className="px-3 py-2 rounded-md font-medium transition-colors bg-green-600 hover:bg-green-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              🎹 Play Chord
            </button>
            <button
              onClick={playVelocityDemo}
              disabled={!isCurrentLoaded}
              className="px-3 py-2 rounded-md font-medium transition-colors bg-green-600 hover:bg-green-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              🔊 Velocity Demo
            </button>
          </div>

          {/* Special Action Buttons */}
          {activeInstrument === 'salamander' ? (
            <div className="space-y-2">
              <button
                onClick={preloadAll}
                disabled={!salamanderLoaded || isLoading}
                className="w-full px-4 py-2 rounded-md font-medium transition-colors border border-gray-300 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Loading...' : 'Preload All 16 Layers'}
              </button>
              <button
                onClick={async () => {
                  // Test damper release sound directly
                  try {
                    const testPlayer = new Tone.Player().toDestination();
                    await testPlayer.load(
                      '/samples/salamander-mp3/AT2035 XY Angle Dn RTN A2.wav',
                    );
                    testPlayer.volume.value = 0; // Max volume
                    testPlayer.start();
                    setTimeout(() => testPlayer.dispose(), 2000);
                  } catch (error) {
                    console.error(
                      'Failed to play damper release sound:',
                      error,
                    );
                  }
                }}
                disabled={!salamanderLoaded}
                className="w-full px-4 py-2 rounded-md font-medium transition-colors bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                🔊 Test Damper Release Sound
              </button>
            </div>
          ) : activeInstrument === 'wurlitzer' ? (
            <div className="space-y-2">
              <button
                onClick={testPedal}
                disabled={!wurlitzerLoaded}
                className="w-full px-4 py-2 rounded-md font-medium transition-colors border border-gray-300 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                🦶 Test Pedal Sounds
              </button>
              <button
                onClick={async () => {
                  // Test release sound directly
                  try {
                    // Create player without loading first
                    const testPlayer = new Tone.Player().toDestination();

                    // Load the file
                    await testPlayer.load(
                      '/samples/wurlitzer-mp3/key-release/key-release-1.mp3',
                    );

                    // Set volume and play
                    testPlayer.volume.value = 0; // Max volume for test
                    testPlayer.start();

                    // Clean up
                    setTimeout(() => {
                      testPlayer.dispose();
                    }, 2000);
                  } catch (error) {
                    console.error('Failed to play release sound:', error);
                  }
                }}
                disabled={!wurlitzerLoaded}
                className="w-full px-4 py-2 rounded-md font-medium transition-colors bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                🔊 Test Release Sound File Directly
              </button>
              <button
                onClick={async () => {
                  // Test multiple release sounds
                  try {
                    const urls = [
                      '/samples/wurlitzer-mp3/key-release/key-release-1.mp3',
                      '/samples/wurlitzer-mp3/key-release/key-release-10.mp3',
                      '/samples/wurlitzer-mp3/key-release/key-release-20.mp3',
                    ];

                    for (let i = 0; i < urls.length; i++) {
                      const testPlayer = new Tone.Player().toDestination();

                      await testPlayer.load(urls[i]);

                      testPlayer.volume.value = 0; // Max volume
                      testPlayer.start();

                      // Wait before playing next
                      await new Promise((resolve) => setTimeout(resolve, 500));
                      testPlayer.dispose();
                    }
                  } catch (error) {
                    console.error('Failed to play release sounds:', error);
                  }
                }}
                disabled={!wurlitzerLoaded}
                className="w-full px-4 py-2 rounded-md font-medium transition-colors bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                🔊 Test Multiple Release Sounds
              </button>
            </div>
          ) : activeInstrument === 'rhodes' ? (
            <div className="space-y-2">
              <button
                onClick={async () => {
                  if (!rhodesSampler || !rhodesLoaded) return;
                  setIsLoading(true);
                  setStatus('Loading all 4 velocity layers...');
                  try {
                    await rhodesSampler.preloadAll();
                    const status = rhodesSampler.getStatus();
                    setSamplerStatus(status);
                    setStatus('✅ All Rhodes layers loaded!');
                  } catch (error) {
                    setStatus('❌ Failed to load all layers');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={!rhodesLoaded || isLoading}
                className="w-full px-4 py-2 rounded-md font-medium transition-colors border border-gray-300 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Loading...' : 'Preload All 4 Layers'}
              </button>
              <button
                onClick={async () => {
                  // Test velocity crossfade
                  if (!rhodesSampler || !rhodesLoaded) return;
                  const notes = ['C4', 'E4', 'G4'];
                  const velocities = [20, 50, 80, 110];
                  const now = Tone.now();
                  for (let i = 0; i < velocities.length; i++) {
                    await rhodesSampler.triggerAttackRelease(
                      notes,
                      '4n',
                      now + i * 0.5,
                      velocities[i],
                    );
                  }
                }}
                disabled={!rhodesLoaded}
                className="w-full px-4 py-2 rounded-md font-medium transition-colors bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                🎹 Test Velocity Crossfade
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => {
                  // Reset ADSR to defaults
                  setAttack(0.05);
                  setDecay(0.3);
                  setSustain(1.0);
                  setRelease(2.0);
                  longPadSampler?.setEnvelope({
                    attack: 0.05,
                    decay: 0.3,
                    sustain: 1.0,
                    release: 2.0,
                  });
                }}
                disabled={!longPadLoaded}
                className="w-full px-4 py-2 rounded-md font-medium transition-colors border border-gray-300 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                🔄 Reset ADSR to Defaults
              </button>
              <button
                onClick={async () => {
                  // Test long sustain with custom ADSR
                  if (!longPadSampler || !longPadLoaded) return;

                  // Set long sustain envelope
                  longPadSampler.setEnvelope({
                    attack: 0.1,
                    decay: 0.1,
                    sustain: 1.0,
                    release: 3.0,
                  });

                  // Play a chord with long sustain
                  await longPadSampler.triggerAttackRelease(
                    ['C3', 'E3', 'G3', 'B3'],
                    4,
                    undefined,
                    0.7,
                  );

                  // Update UI
                  setAttack(0.1);
                  setDecay(0.1);
                  setSustain(1.0);
                  setRelease(3.0);
                }}
                disabled={!longPadLoaded}
                className="w-full px-4 py-2 rounded-md font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                🎵 Test Long Sustain Chord
              </button>
            </div>
          )}
          {activeInstrument === 'thesaw' && (
            <div className="space-y-2">
              <button
                onClick={() => {
                  // Load Classic Lead preset
                  theSawSampler?.loadPresetClassicLead();
                  setFilterCutoff(5000);
                  setFilterResonance(5);
                }}
                disabled={!theSawLoaded}
                className="w-full px-4 py-2 rounded-md font-medium transition-colors border border-gray-300 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                🎸 Classic Lead Preset
              </button>
              <button
                onClick={() => {
                  // Load Bass preset
                  theSawSampler?.loadPresetBass();
                  setFilterCutoff(500);
                  setFilterResonance(8);
                }}
                disabled={!theSawLoaded}
                className="w-full px-4 py-2 rounded-md font-medium transition-colors bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                🎵 Aggressive Bass
              </button>
              <button
                onClick={() => {
                  // Load Warm Pad preset
                  theSawSampler?.loadPresetWarmPad();
                  setFilterCutoff(2000);
                  setFilterResonance(1);
                }}
                disabled={!theSawLoaded}
                className="w-full px-4 py-2 rounded-md font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                🌊 Warm Pad
              </button>
              <button
                onClick={() => {
                  // Load Pluck preset
                  theSawSampler?.loadPresetPluck();
                  setFilterCutoff(8000);
                  setFilterResonance(5);
                }}
                disabled={!theSawLoaded}
                className="w-full px-4 py-2 rounded-md font-medium transition-colors bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                ✨ Bright Pluck
              </button>
            </div>
          )}
        </div>

        {/* Status Card */}
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h2 className="text-2xl font-semibold mb-4">Status</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {activeInstrument === 'salamander'
              ? 'Salamander Grand Piano'
              : activeInstrument === 'wurlitzer'
                ? 'Wurlitzer Electric Piano'
                : activeInstrument === 'longpad'
                  ? 'Long Pad Synthesizer'
                  : activeInstrument === 'rhodes'
                    ? 'Fender Rhodes Electric Piano'
                    : 'The Saw Analog Synthesizer'}
          </p>

          {/* Status Message */}
          <div className="p-4 bg-muted rounded-lg mb-4">
            <p className="font-mono text-sm">{status}</p>
          </div>

          {/* Piano Keys */}
          <div className="space-y-2 mb-4">
            <label className="text-sm font-medium">Piano Keys</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                'C3',
                'D3',
                'E3',
                'F3',
                'G3',
                'A3',
                'B3',
                'C4',
                'D4',
                'E4',
                'F4',
                'G4',
                'A4',
                'B4',
                'C5',
                'D5',
              ].map((note) => (
                <button
                  key={note}
                  onClick={() => playNote(note)}
                  disabled={!isCurrentLoaded}
                  className="px-3 py-2 rounded-md font-medium transition-colors border border-gray-300 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                >
                  {note}
                </button>
              ))}
            </div>
          </div>

          {/* Sampler Status */}
          {samplerStatus && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Sampler Status</label>
              <div className="p-4 bg-muted rounded-lg space-y-1">
                <p className="text-sm">
                  <strong>Initialized:</strong>{' '}
                  {samplerStatus.initialized ? 'Yes' : 'No'}
                </p>
                {activeInstrument === 'salamander' ? (
                  <>
                    <p className="text-sm">
                      <strong>Loaded Layers:</strong>{' '}
                      {samplerStatus.loadedLayers?.length || 0} /{' '}
                      {samplerStatus.totalLayers || 16}
                    </p>
                    <p className="text-sm">
                      <strong>Memory Usage:</strong>{' '}
                      {samplerStatus.memoryEstimate || 'N/A'}
                    </p>
                    <p className="text-sm">
                      <strong>Active Layers:</strong>{' '}
                      {samplerStatus.loadedLayers?.join(', ') || 'None'}
                    </p>
                  </>
                ) : activeInstrument === 'wurlitzer' ? (
                  <>
                    <p className="text-sm">
                      <strong>Notes Loaded:</strong>{' '}
                      {samplerStatus.notesLoaded || 'N/A'}
                    </p>
                    <p className="text-sm">
                      <strong>Mechanical Sounds:</strong>{' '}
                      {samplerStatus.mechanicalSoundsLoaded
                        ? 'Loaded'
                        : 'Not loaded'}
                    </p>
                    <p className="text-sm">
                      <strong>Total Notes:</strong>{' '}
                      {samplerStatus.totalNotes || 'N/A'}
                    </p>
                  </>
                ) : activeInstrument === 'rhodes' ? (
                  <>
                    <p className="text-sm">
                      <strong>Loaded Layers:</strong>{' '}
                      {samplerStatus.loadedLayers?.length || 0} /{' '}
                      {samplerStatus.totalLayers || 4}
                    </p>
                    <p className="text-sm">
                      <strong>Memory Usage:</strong>{' '}
                      {samplerStatus.memoryEstimate || 'N/A'}
                    </p>
                    <p className="text-sm">
                      <strong>Active Layers:</strong>{' '}
                      {samplerStatus.loadedLayers?.join(', ') || 'None'}
                    </p>
                  </>
                ) : activeInstrument === 'thesaw' ? (
                  <>
                    <p className="text-sm">
                      <strong>Sampled Notes:</strong>{' '}
                      {samplerStatus.sampledNotes || 'N/A'}
                    </p>
                    <p className="text-sm">
                      <strong>Filter Cutoff:</strong>{' '}
                      {samplerStatus.filterSettings?.cutoff || 'N/A'}Hz
                    </p>
                    <p className="text-sm">
                      <strong>Filter Resonance:</strong>{' '}
                      {samplerStatus.filterSettings?.resonance || 'N/A'}
                    </p>
                    <p className="text-sm">
                      <strong>Filter Envelope:</strong>
                      Amount:{' '}
                      {samplerStatus.filterSettings?.envelope?.amount || 'N/A'}
                      Hz
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm">
                      <strong>Notes Loaded:</strong>{' '}
                      {samplerStatus.notesLoaded || 'N/A'}
                    </p>
                    <p className="text-sm">
                      <strong>Envelope (ADSR):</strong>
                      A: {samplerStatus.envelope?.attack}s, D:{' '}
                      {samplerStatus.envelope?.decay}s, S:{' '}
                      {Math.round((samplerStatus.envelope?.sustain || 0) * 100)}
                      %, R: {samplerStatus.envelope?.release}s
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Velocity Visualization */}
          {activeInstrument === 'salamander' && (
            <div className="space-y-2 mt-4">
              <label className="text-sm font-medium">Velocity Layers</label>
              <div className="grid grid-cols-8 gap-1">
                {[...Array(16)].map((_, i) => {
                  const layerVel = i * 8 + 4;
                  const isActive = velocity >= i * 8 && velocity <= (i + 1) * 8;
                  return (
                    <div
                      key={i}
                      className={`h-8 rounded text-xs flex items-center justify-center font-mono ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      v{i + 1}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rhodes Velocity Visualization */}
          {activeInstrument === 'rhodes' && (
            <div className="space-y-2 mt-4">
              <label className="text-sm font-medium">Velocity Layers</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { name: 'p', range: '0-31', min: 0, max: 31 },
                  { name: 'mp', range: '32-63', min: 32, max: 63 },
                  { name: 'mf', range: '64-95', min: 64, max: 95 },
                  { name: 'f', range: '96-127', min: 96, max: 127 },
                ].map((layer) => {
                  const isActive =
                    velocity >= layer.min && velocity <= layer.max;
                  return (
                    <div
                      key={layer.name}
                      className={`h-10 rounded text-sm flex flex-col items-center justify-center font-mono ${
                        isActive ? 'bg-yellow-600 text-white' : 'bg-muted'
                      }`}
                    >
                      <div className="font-bold">{layer.name}</div>
                      <div className="text-xs">{layer.range}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Features */}
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h3 className="text-sm font-medium mb-2">
              {activeInstrument === 'salamander'
                ? 'Salamander Features'
                : activeInstrument === 'wurlitzer'
                  ? 'Wurlitzer Features'
                  : activeInstrument === 'longpad'
                    ? 'Long Pad Features'
                    : activeInstrument === 'rhodes'
                      ? 'Rhodes Features'
                      : 'The Saw Features'}
            </h3>
            {activeInstrument === 'salamander' ? (
              <ul className="text-xs space-y-1">
                <li>• 16 velocity layers for dynamic expression</li>
                <li>• Full 88-key range (A0-C8)</li>
                <li>• Sample interpolation for efficiency</li>
                <li>• Progressive velocity layer loading</li>
                <li>• ~10MB per velocity layer</li>
              </ul>
            ) : activeInstrument === 'wurlitzer' ? (
              <ul className="text-xs space-y-1">
                <li>• Variable velocity layers (3-7 per note)</li>
                <li>• Authentic pedal press/release sounds</li>
                <li>• Realistic key press sounds</li>
                <li>• Key release sounds for authenticity</li>
                <li>• Vintage tine response modeling</li>
              </ul>
            ) : activeInstrument === 'rhodes' ? (
              <ul className="text-xs space-y-1">
                <li>• 4 velocity layers (p, mp, mf, f)</li>
                <li>• 64 notes sampled (A0 to C6)</li>
                <li>• Characteristic bell-like tone</li>
                <li>• Progressive velocity layer loading</li>
                <li>• ~15MB per velocity layer</li>
              </ul>
            ) : activeInstrument === 'longpad' ? (
              <ul className="text-xs space-y-1">
                <li>• Single velocity layer with dynamic control</li>
                <li>• Full ADSR envelope adjustment</li>
                <li>• 61 samples from C-1 to C4</li>
                <li>• Warm analog-style pad sounds</li>
                <li>• Suitable for ambient and cinematic music</li>
              </ul>
            ) : (
              <ul className="text-xs space-y-1">
                <li>• JiKay's The Saw sample collection</li>
                <li>• 11 sampled notes with interpolation</li>
                <li>• Resonant 24dB/octave lowpass filter</li>
                <li>• Full filter ADSR envelope control</li>
                <li>• 4 preset sounds: Lead, Bass, Pad, Pluck</li>
                <li>• Velocity-sensitive filter modulation</li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
