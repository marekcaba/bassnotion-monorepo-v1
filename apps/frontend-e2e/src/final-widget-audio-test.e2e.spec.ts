import { test, expect } from '@playwright/test';

test.describe('Final Widget Audio Test', () => {
  test('verify widgets now play audio with +0.1 start time fix', async ({ page }) => {
    // Wait for server to fully start
    await page.waitForTimeout(5000);
    
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Capture all logs
    const logs: string[] = [];
    page.on('console', (msg) => {
      logs.push(msg.text());
    });
    
    // Monitor audio playback
    await page.evaluate(() => {
      (window as any).__audioTest = {
        scheduleExecutions: [],
        audioTriggers: []
      };
      
      const Tone = (window as any).Tone;
      if (Tone) {
        // Monitor MembraneSynth (kick drum)
        if (Tone.MembraneSynth && Tone.MembraneSynth.prototype.triggerAttackRelease) {
          const originalTrigger = Tone.MembraneSynth.prototype.triggerAttackRelease;
          Tone.MembraneSynth.prototype.triggerAttackRelease = function(...args: any[]) {
            console.log('🥁 KICK DRUM TRIGGERED!', args);
            (window as any).__audioTest.audioTriggers.push({
              type: 'kick',
              args,
              timestamp: Date.now()
            });
            return originalTrigger.apply(this, args);
          };
        }
        
        // Monitor NoiseSynth (snare)
        if (Tone.NoiseSynth && Tone.NoiseSynth.prototype.triggerAttackRelease) {
          const originalTrigger = Tone.NoiseSynth.prototype.triggerAttackRelease;
          Tone.NoiseSynth.prototype.triggerAttackRelease = function(...args: any[]) {
            console.log('🥁 SNARE TRIGGERED!', args);
            (window as any).__audioTest.audioTriggers.push({
              type: 'snare',
              args,
              timestamp: Date.now()
            });
            return originalTrigger.apply(this, args);
          };
        }
        
        // Monitor MetalSynth (hihat)
        if (Tone.MetalSynth && Tone.MetalSynth.prototype.triggerAttackRelease) {
          const originalTrigger = Tone.MetalSynth.prototype.triggerAttackRelease;
          Tone.MetalSynth.prototype.triggerAttackRelease = function(...args: any[]) {
            console.log('🥁 HIHAT TRIGGERED!', args);
            (window as any).__audioTest.audioTriggers.push({
              type: 'hihat',
              args,
              timestamp: Date.now()
            });
            return originalTrigger.apply(this, args);
          };
        }
      }
    });
    
    // Click play
    console.log('\n=== Starting playback ===');
    await page.click('button:has-text("▶️ PLAY")');
    
    // Wait for audio to play
    await page.waitForTimeout(5000);
    
    // Get results
    const results = await page.evaluate(() => {
      return (window as any).__audioTest;
    });
    
    // Check for drum schedule execution logs
    const drumExecutionLogs = logs.filter(log => 
      log.includes('DRUM TRANSPORT SCHEDULE EXECUTED')
    );
    const harmonyExecutionLogs = logs.filter(log => 
      log.includes('HARMONY TRANSPORT SCHEDULE EXECUTED')
    );
    const triggerLogs = logs.filter(log => 
      log.includes('Triggering') && log.includes('at subdivision')
    );
    
    console.log('\n=== RESULTS ===');
    console.log(`Drum schedule executions: ${drumExecutionLogs.length}`);
    console.log(`Harmony schedule executions: ${harmonyExecutionLogs.length}`);
    console.log(`Drum trigger attempts: ${triggerLogs.length}`);
    console.log(`Actual audio triggers: ${results.audioTriggers.length}`);
    
    if (drumExecutionLogs.length > 0) {
      console.log('\n✅ DRUM SCHEDULES ARE EXECUTING!');
      console.log('Sample logs:', drumExecutionLogs.slice(0, 3));
    }
    
    if (results.audioTriggers.length > 0) {
      console.log('\n✅ AUDIO IS PLAYING!');
      const kickCount = results.audioTriggers.filter((t: any) => t.type === 'kick').length;
      const snareCount = results.audioTriggers.filter((t: any) => t.type === 'snare').length;
      const hihatCount = results.audioTriggers.filter((t: any) => t.type === 'hihat').length;
      console.log(`Kicks: ${kickCount}, Snares: ${snareCount}, Hihats: ${hihatCount}`);
    }
    
    // Check pattern info
    const patternLogs = logs.filter(log => 
      log.includes('First 3 drum events:') ||
      log.includes('Drum check:')
    );
    
    if (patternLogs.length > 0) {
      console.log('\n=== Pattern Info ===');
      patternLogs.slice(0, 3).forEach(log => console.log(log));
    }
    
    // Verify the fix worked
    expect(drumExecutionLogs.length).toBeGreaterThan(0);
    expect(results.audioTriggers.length).toBeGreaterThan(0);
    
    // Check transport state
    const finalState = await page.evaluate(() => {
      const Tone = (window as any).Tone;
      return {
        transportState: Tone?.Transport?.state,
        transportSeconds: Tone?.Transport?.seconds,
        contextState: Tone?.context?.state
      };
    });
    
    console.log('\n=== Final State ===');
    console.log(finalState);
    
    expect(finalState.transportState).toBe('started');
    expect(finalState.transportSeconds).toBeGreaterThan(4);
  });
});