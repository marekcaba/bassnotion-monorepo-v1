'use client';

import { useEffect, useState } from 'react';
import * as Tone from 'tone';

export default function TestDrumLoading() {
  const [status, setStatus] = useState<string[]>([]);
  const [samplers, setSamplers] = useState<any>({});

  useEffect(() => {
    const testDrumLoading = async () => {
      const logs: string[] = [];
      
      try {
        // Start Tone context
        await Tone.start();
        logs.push('✅ Tone.js started');
        
        // Test loading drum samples from Supabase
        const baseUrl = 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/curated/rock-kit/';
        
        // Simple test - try to load one sample for each drum
        const drumSamples = {
          kick: 'kick.mp3',
          snare: 'snare.mp3', 
          hihat: 'hihat.mp3'
        };
        
        const loadedSamplers: any = {};
        
        for (const [drum, filename] of Object.entries(drumSamples)) {
          const url = `${baseUrl}${filename}`;
          logs.push(`\n📦 Loading ${drum} from: ${url}`);
          
          try {
            // First check if URL is accessible
            const response = await fetch(url, { method: 'HEAD' });
            if (!response.ok) {
              logs.push(`❌ ${drum} URL not accessible: ${response.status}`);
              continue;
            }
            logs.push(`✅ ${drum} URL is accessible`);
            
            // Create sampler
            const sampler = new Tone.Sampler({
              urls: { C1: url },
              onload: () => {
                logs.push(`✅ ${drum} sampler loaded successfully!`);
                setStatus([...logs]);
              },
              onerror: (error) => {
                logs.push(`❌ ${drum} sampler error: ${error}`);
                setStatus([...logs]);
              }
            }).toDestination();
            
            // Set timeout for loading
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Timeout loading ${drum}`)), 5000)
            );
            
            await Promise.race([sampler.loaded, timeoutPromise]);
            logs.push(`✅ ${drum} loaded promise resolved!`);
            
            loadedSamplers[drum] = sampler;
            
          } catch (error: any) {
            logs.push(`❌ Failed to load ${drum}: ${error.message}`);
          }
        }
        
        setSamplers(loadedSamplers);
        setStatus([...logs]);
        
        // If we have loaded samplers, add play buttons
        if (Object.keys(loadedSamplers).length > 0) {
          logs.push('\n🎵 Samples loaded! Click buttons below to test.');
          setStatus([...logs]);
        }
        
      } catch (error: any) {
        logs.push(`❌ Error: ${error.message}`);
        setStatus([...logs]);
      }
    };
    
    testDrumLoading();
  }, []);
  
  const playDrum = (drum: string) => {
    if (samplers[drum]) {
      samplers[drum].triggerAttackRelease('C1', '8n');
      setStatus(prev => [...prev, `🥁 Playing ${drum}!`]);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Testing Drum Sample Loading from Supabase</h1>
      <div className="font-mono text-sm mb-4">
        {status.map((s, i) => (
          <div key={i} className={s.startsWith('✅') ? 'text-green-600' : s.startsWith('❌') ? 'text-red-600' : 'text-gray-600'}>
            {s}
          </div>
        ))}
      </div>
      
      {Object.keys(samplers).length > 0 && (
        <div className="mt-4 flex gap-4">
          {Object.keys(samplers).map(drum => (
            <button
              key={drum}
              onClick={() => playDrum(drum)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Play {drum}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}