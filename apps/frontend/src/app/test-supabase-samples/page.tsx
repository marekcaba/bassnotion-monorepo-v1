'use client';

import { useEffect, useState } from 'react';

export default function TestSupabaseSamples() {
  const [status, setStatus] = useState<string[]>([]);

  useEffect(() => {
    const testSupabaseUrls = async () => {
      const baseUrl = 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/Keyboards/salamander';
      const testNotes = ['C4', 'E4', 'G4'];
      const testLayers = ['v8', 'v10'];
      
      const results: string[] = [];
      
      for (const layer of testLayers) {
        for (const note of testNotes) {
          const url = `${baseUrl}/${layer}/${note}.mp3`;
          try {
            const response = await fetch(url, { method: 'HEAD' });
            if (response.ok) {
              results.push(`✅ ${layer}/${note}.mp3 - OK`);
            } else {
              results.push(`❌ ${layer}/${note}.mp3 - ${response.status} ${response.statusText}`);
            }
          } catch (error) {
            results.push(`❌ ${layer}/${note}.mp3 - ${error}`);
          }
        }
      }
      
      setStatus(results);
    };
    
    testSupabaseUrls();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Testing Supabase Sample URLs</h1>
      <div className="font-mono text-sm">
        {status.length === 0 ? (
          <p>Testing URLs...</p>
        ) : (
          status.map((s, i) => (
            <div key={i} className={s.startsWith('✅') ? 'text-green-600' : 'text-red-600'}>
              {s}
            </div>
          ))
        )}
      </div>
    </div>
  );
}