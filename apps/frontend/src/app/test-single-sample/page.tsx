'use client';

import { useEffect, useState } from 'react';
import * as Tone from 'tone';

export default function TestSingleSample() {
  const [status, setStatus] = useState<string[]>([]);

  useEffect(() => {
    const testSampler = async () => {
      const logs: string[] = [];
      
      try {
        // Start Tone context
        await Tone.start();
        logs.push('✅ Tone.js started');
        
        // Test loading a single sample
        const baseUrl = 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/Keyboards/salamander/v8/';
        const urls = { 'C4': 'C4.mp3' };
        
        logs.push(`📦 Creating sampler with baseUrl: ${baseUrl}`);
        logs.push(`📦 URLs: ${JSON.stringify(urls)}`);
        
        const sampler = new Tone.Sampler({
          urls,
          baseUrl,
          onload: () => {
            logs.push('✅ Sampler loaded successfully!');
            setStatus([...logs]);
          },
          onerror: (error) => {
            logs.push(`❌ Sampler error: ${error}`);
            setStatus([...logs]);
          }
        });
        
        logs.push('⏳ Waiting for sampler.loaded...');
        setStatus([...logs]);
        
        // Set a timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 10 seconds')), 10000)
        );
        
        try {
          await Promise.race([sampler.loaded, timeoutPromise]);
          logs.push('✅ sampler.loaded resolved!');
          
          // Check buffers
          if (sampler._buffers) {
            logs.push(`📦 Buffers size: ${sampler._buffers.size}`);
          } else {
            logs.push('❌ No buffers object');
          }
          
        } catch (error) {
          logs.push(`❌ Loading failed: ${error}`);
        }
        
        setStatus([...logs]);
        
      } catch (error) {
        logs.push(`❌ Error: ${error}`);
        setStatus([...logs]);
      }
    };
    
    testSampler();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Testing Single Sample Loading</h1>
      <div className="font-mono text-sm">
        {status.map((s, i) => (
          <div key={i} className={s.startsWith('✅') ? 'text-green-600' : s.startsWith('❌') ? 'text-red-600' : 'text-gray-600'}>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}