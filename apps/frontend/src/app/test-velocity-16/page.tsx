'use client';

import React, { useState, useEffect } from 'react';
import * as Tone from 'tone';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Play, Volume2, Music } from 'lucide-react';
import { SalamanderVelocitySampler } from '@/domains/playback/services/plugins/SalamanderVelocitySampler';

export default function TestVelocity16Page() {
  const [sampler, setSampler] = useState<SalamanderVelocitySampler | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [velocity, setVelocity] = useState(64);
  const [noteLength, setNoteLength] = useState(0.5);
  const [status, setStatus] = useState('Ready to load samples...');
  const [samplerStatus, setSamplerStatus] = useState<any>(null);

  // Velocity layer info
  const getVelocityLayer = (vel: number) => {
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
  };

  const loadSampler = async () => {
    setIsLoading(true);
    setStatus('Loading 16-velocity Salamander Grand Piano...');

    try {
      await Tone.start();

      const newSampler = new SalamanderVelocitySampler();
      await newSampler.initialize();
      newSampler.connect(Tone.Destination);

      setSampler(newSampler);
      setIsInitialized(true);
      setStatus('✅ 16-velocity Salamander Grand Piano loaded!');

      // Update status
      const status = newSampler.getStatus();
      setSamplerStatus(status);
    } catch (error) {
      console.error('Failed to load sampler:', error);
      setStatus(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const playNote = async (note: string) => {
    if (!sampler || !isInitialized) {
      alert('Please load the sampler first!');
      return;
    }

    await sampler.triggerAttackRelease(note, noteLength, undefined, velocity);
  };

  const playScale = async () => {
    if (!sampler || !isInitialized) {
      alert('Please load the sampler first!');
      return;
    }

    const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
    const time = Tone.now();

    for (let i = 0; i < notes.length; i++) {
      await sampler.triggerAttackRelease(
        notes[i],
        '8n',
        time + i * 0.25,
        velocity,
      );
    }
  };

  const playChord = async () => {
    if (!sampler || !isInitialized) {
      alert('Please load the sampler first!');
      return;
    }

    const chord = ['C4', 'E4', 'G4', 'C5'];
    await sampler.triggerAttackRelease(chord, noteLength, undefined, velocity);
  };

  const playVelocityDemo = async () => {
    if (!sampler || !isInitialized) {
      alert('Please load the sampler first!');
      return;
    }

    setStatus('🎵 Playing velocity demonstration...');
    const velocities = [20, 40, 60, 80, 100, 120];
    const time = Tone.now();

    for (let i = 0; i < velocities.length; i++) {
      await sampler.triggerAttackRelease(
        'C4',
        '4n',
        time + i * 0.5,
        velocities[i],
      );
    }

    setTimeout(() => {
      setStatus('✅ Velocity demo complete! Notice how the timbre changes.');
    }, 3000);
  };

  const preloadAllLayers = async () => {
    if (!sampler || !isInitialized) {
      alert('Please load the sampler first!');
      return;
    }

    setIsLoading(true);
    setStatus('Loading all 16 velocity layers...');

    try {
      await sampler.preloadAll();
      setStatus('✅ All 16 velocity layers loaded!');

      // Update status
      const status = sampler.getStatus();
      setSamplerStatus(status);
    } catch (error) {
      setStatus(
        `❌ Error loading all layers: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const velocityInfo = getVelocityLayer(velocity);

  useEffect(() => {
    return () => {
      if (sampler) {
        sampler.dispose();
      }
    };
  }, [sampler]);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">
        🎹 16-Velocity Salamander Grand Piano Test
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controls Card */}
        <Card>
          <CardHeader>
            <CardTitle>Controls</CardTitle>
            <CardDescription>
              Professional piano with 16 velocity layers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Load Button */}
            <div>
              <Button
                onClick={loadSampler}
                disabled={isLoading || isInitialized}
                className="w-full"
              >
                {isLoading
                  ? 'Loading...'
                  : isInitialized
                    ? 'Sampler Loaded'
                    : 'Load Velocity Layers'}
              </Button>
            </div>

            {/* Velocity Control */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Velocity (MIDI 0-127)</Label>
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
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Note Length</Label>
                <span className="text-sm text-muted-foreground">
                  {noteLength}s
                </span>
              </div>
              <input
                type="range"
                value={noteLength}
                onChange={(e) => setNoteLength(Number(e.target.value))}
                min={0.1}
                max={2}
                step={0.1}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
            </div>

            {/* Playback Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => playNote('C4')} disabled={!isInitialized}>
                <Play className="mr-2 h-4 w-4" />
                Play C4
              </Button>
              <Button onClick={playScale} disabled={!isInitialized}>
                <Music className="mr-2 h-4 w-4" />
                Play Scale
              </Button>
              <Button onClick={playChord} disabled={!isInitialized}>
                <Music className="mr-2 h-4 w-4" />
                Play Chord
              </Button>
              <Button onClick={playVelocityDemo} disabled={!isInitialized}>
                <Volume2 className="mr-2 h-4 w-4" />
                Velocity Demo
              </Button>
            </div>

            {/* Preload All Button */}
            <Button
              onClick={preloadAllLayers}
              disabled={!isInitialized || isLoading}
              variant="outline"
              className="w-full"
            >
              {isLoading ? 'Loading...' : 'Preload All 16 Layers'}
            </Button>
          </CardContent>
        </Card>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>
              Sampler information and loading status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Message */}
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-mono text-sm">{status}</p>
            </div>

            {/* Piano Keys */}
            <div className="space-y-2">
              <Label>Piano Keys</Label>
              <div className="grid grid-cols-4 gap-2">
                {['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'].map(
                  (note) => (
                    <Button
                      key={note}
                      onClick={() => playNote(note)}
                      disabled={!isInitialized}
                      variant="outline"
                      size="sm"
                    >
                      {note}
                    </Button>
                  ),
                )}
              </div>
            </div>

            {/* Sampler Status */}
            {samplerStatus && (
              <div className="space-y-2">
                <Label>Sampler Status</Label>
                <div className="p-4 bg-muted rounded-lg space-y-1">
                  <p className="text-sm">
                    <strong>Initialized:</strong>{' '}
                    {samplerStatus.initialized ? 'Yes' : 'No'}
                  </p>
                  <p className="text-sm">
                    <strong>Loaded Layers:</strong>{' '}
                    {samplerStatus.loadedLayers.length} /{' '}
                    {samplerStatus.totalLayers}
                  </p>
                  <p className="text-sm">
                    <strong>Memory Usage:</strong>{' '}
                    {samplerStatus.memoryEstimate}
                  </p>
                  <p className="text-sm">
                    <strong>Active Layers:</strong>{' '}
                    {samplerStatus.loadedLayers.join(', ') || 'None'}
                  </p>
                </div>
              </div>
            )}

            {/* Velocity Visualization */}
            <div className="space-y-2">
              <Label>Velocity Layers</Label>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
