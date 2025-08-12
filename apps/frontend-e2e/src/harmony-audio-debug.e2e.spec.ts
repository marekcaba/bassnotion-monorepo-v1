import { test, expect } from '@playwright/test';

test.describe('Harmony Audio Debug', () => {
  test('check if Salamander piano is loading and playing', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Capture all logs
    const logs: string[] = [];
    page.on('console', (msg) => {
      logs.push(msg.text());
    });
    
    // Monitor Sampler creation and chord playback
    await page.evaluate(() => {
      (window as any).__harmonyDebug = {
        samplerCreations: [],
        chordPlaybacks: [],
        errors: []
      };
      
      const Tone = (window as any).Tone;
      if (!Tone) return;
      
      // Monitor Sampler creation
      if (Tone.Sampler) {
        const originalSampler = Tone.Sampler;
        Tone.Sampler = function(...args: any[]) {
          const samplerInfo = {
            urls: args[0]?.urls || args[0],
            baseUrl: args[0]?.baseUrl,
            timestamp: Date.now()
          };
          (window as any).__harmonyDebug.samplerCreations.push(samplerInfo);
          console.log('🎹 Creating Sampler:', samplerInfo);
          
          const sampler = new originalSampler(...args);
          
          // Monitor loading
          if (sampler.loaded) {
            console.log('🎹 Sampler already loaded!');
          } else {
            sampler.onstop = () => {
              console.log('🎹 Sampler finished loading');
            };
          }
          
          // Monitor triggerAttackRelease
          const originalTrigger = sampler.triggerAttackRelease;
          sampler.triggerAttackRelease = function(...triggerArgs: any[]) {
            const [note, duration, time, velocity] = triggerArgs;
            const playback = {
              note,
              duration,
              time,
              velocity,
              loaded: this.loaded,
              timestamp: Date.now()
            };
            (window as any).__harmonyDebug.chordPlaybacks.push(playback);
            console.log('🎹 Sampler.triggerAttackRelease:', playback);
            
            if (!this.loaded) {
              console.error('🎹 ERROR: Sampler not loaded when trying to play!');
              (window as any).__harmonyDebug.errors.push('Sampler not loaded');
            }
            
            return originalTrigger.apply(this, triggerArgs);
          };
          
          return sampler;
        };
      }
    });
    
    // Click play
    console.log('\n=== Starting playback ===');
    await page.click('button:has-text("▶️ PLAY")');
    
    // Wait for potential chord playback
    await page.waitForTimeout(5000);
    
    // Get results
    const results = await page.evaluate(() => {
      return (window as any).__harmonyDebug || {};
    });
    
    // Analyze logs
    const harmonyLogs = logs.filter(log => 
      log.includes('HarmonyWidget') ||
      log.includes('chord') ||
      log.includes('Chord') ||
      log.includes('Sampler') ||
      log.includes('Salamander')
    );
    
    const errorLogs = logs.filter(log => 
      log.includes('Error') ||
      log.includes('error') ||
      log.includes('failed') ||
      log.includes('Failed')
    );
    
    console.log('\n=== Sampler Creation ===');
    if (results.samplerCreations?.length > 0) {
      console.log(`Created ${results.samplerCreations.length} samplers`);
      results.samplerCreations.forEach((sampler: any, i: number) => {
        console.log(`Sampler ${i + 1}:`, sampler);
      });
    } else {
      console.log('❌ No samplers created!');
    }
    
    console.log('\n=== Chord Playback Attempts ===');
    if (results.chordPlaybacks?.length > 0) {
      console.log(`${results.chordPlaybacks.length} chord playback attempts`);
      const loaded = results.chordPlaybacks.filter((p: any) => p.loaded).length;
      const notLoaded = results.chordPlaybacks.filter((p: any) => !p.loaded).length;
      console.log(`  - Loaded: ${loaded}`);
      console.log(`  - Not loaded: ${notLoaded}`);
      
      if (results.chordPlaybacks.length > 0) {
        console.log('First playback:', results.chordPlaybacks[0]);
      }
    } else {
      console.log('❌ No chord playback attempts!');
    }
    
    console.log('\n=== Harmony Logs ===');
    const scheduleExecutedLogs = harmonyLogs.filter(log => 
      log.includes('HARMONY TRANSPORT SCHEDULE EXECUTED')
    );
    const playingChordLogs = harmonyLogs.filter(log => 
      log.includes('ATTEMPTING TO PLAY')
    );
    const successLogs = harmonyLogs.filter(log => 
      log.includes('SUCCESS: playChord called')
    );
    
    console.log(`Schedule executions: ${scheduleExecutedLogs.length}`);
    console.log(`Play attempts: ${playingChordLogs.length}`);
    console.log(`Successful calls: ${successLogs.length}`);
    
    if (playingChordLogs.length > 0) {
      console.log('\nSample play attempts:');
      playingChordLogs.slice(0, 3).forEach(log => console.log(log));
    }
    
    // Check for initialization logs
    const initLogs = harmonyLogs.filter(log => 
      log.includes('processor initialized') ||
      log.includes('processor ready')
    );
    
    if (initLogs.length > 0) {
      console.log('\n=== Initialization ===');
      initLogs.forEach(log => console.log(log));
    }
    
    // Check for errors
    if (errorLogs.length > 0) {
      console.log('\n=== Errors ===');
      errorLogs.slice(0, 5).forEach(log => console.log(log));
    }
    
    // Check if using fallback synth
    const synthLogs = logs.filter(log => 
      log.includes('fallback') ||
      log.includes('Fallback') ||
      log.includes('synth mode') ||
      log.includes('synthesis mode')
    );
    
    if (synthLogs.length > 0) {
      console.log('\n⚠️ Using fallback synthesis mode:');
      synthLogs.forEach(log => console.log(log));
    }
  });
});