'use client';

import { useEffect, useState } from 'react';

export default function TestDrumsLoadingPage() {
  const [loadStatus, setLoadStatus] = useState('Checking drum samples...');
  const [samples, setSamples] = useState<string[]>([]);
  
  useEffect(() => {
    // Test loading drum samples from the correct path
    const testDrumSamples = async () => {
      const kitPath = 'drums/hydrogen-kits/mp3/rock/dave-grohl';
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL 
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/audio-samples/${kitPath}/`
        : `/audio-samples/${kitPath}/`;
      
      console.log('🥁 Testing drum samples from:', baseUrl);
      setLoadStatus(`Testing drum samples from: ${baseUrl}`);
      
      // Test specific files based on Hydrogen naming
      const testFiles = [
        'kik.mp3',  // kick
        'sn-01.mp3', // snare 1  
        'sn-02.mp3', // snare 2
        'clap.mp3',  // clap
        'hh-01.mp3', // hihat 1
        'hh-02.mp3', // hihat 2
        'hat-open.mp3', // open hihat
        'ride.mp3',  // ride
        'crash.mp3', // crash
        'tom-01.mp3', // tom 1
        'tom-02.mp3', // tom 2
        'tom-03.mp3', // tom 3
      ];
      
      const results: string[] = [];
      
      for (const file of testFiles) {
        try {
          const url = `${baseUrl}${file}`;
          const response = await fetch(url, { method: 'HEAD' });
          const status = response.ok ? '✅' : '❌';
          const result = `${status} ${file} - ${response.status}`;
          results.push(result);
          console.log(`🥁 ${result}`);
        } catch (error) {
          const result = `❌ ${file} - Error: ${error}`;
          results.push(result);
          console.error(`🥁 ${result}`);
        }
      }
      
      setSamples(results);
      setLoadStatus('Test complete!');
    };
    
    testDrumSamples();
  }, []);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">🥁 Drum Samples Loading Test</h1>
        
        <div className="bg-slate-800/50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Status</h2>
          <p className="text-green-400">{loadStatus}</p>
        </div>
        
        <div className="bg-slate-800/50 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Drum Sample Files</h2>
          <div className="space-y-2">
            {samples.map((sample, index) => (
              <div key={index} className="text-sm font-mono text-white">
                {sample}
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-blue-900/30 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold text-white mb-4">Test Information</h2>
          <p className="text-slate-300">
            This page tests loading drum samples from the Dave Grohl kit at:
          </p>
          <code className="block mt-2 bg-slate-700 px-3 py-2 rounded text-green-400 text-sm">
            drums/hydrogen-kits/mp3/rock/dave-grohl/
          </code>
          <p className="text-slate-300 mt-4">
            Check the browser console for detailed logs (🥁 prefix).
          </p>
        </div>
      </div>
    </div>
  );
}