import { test, expect } from '@playwright/test';

test.describe('Widget Schedule Recreation Fix', () => {
  test('verify the !loopRef.current bug prevents audio after stop/play', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Capture all logs
    const logs: string[] = [];
    page.on('console', (msg) => {
      logs.push(msg.text());
    });
    
    // Monitor schedule creation and execution
    await page.evaluate(() => {
      (window as any).__widgetDebug = {
        schedulesCreated: [],
        schedulesExecuted: [],
        audioAttempts: []
      };
      
      // Monitor schedule creation
      const Tone = (window as any).Tone;
      if (Tone) {
        const originalScheduleRepeat = Tone.Transport.scheduleRepeat;
        Tone.Transport.scheduleRepeat = function(...args: any[]) {
          const [callback, interval, startTime] = args;
          console.log(`📅 Widget creating schedule: interval=${interval}, startTime=${startTime}`);
          (window as any).__widgetDebug.schedulesCreated.push({
            interval,
            startTime,
            timestamp: Date.now()
          });
          
          // Wrap callback to monitor execution
          const wrappedCallback = (time: number) => {
            (window as any).__widgetDebug.schedulesExecuted.push({
              time,
              interval,
              timestamp: Date.now()
            });
            return callback(time);
          };
          
          return originalScheduleRepeat.call(this, wrappedCallback, interval, startTime);
        };
        
        // Monitor audio attempts
        if (Tone.MembraneSynth && Tone.MembraneSynth.prototype.triggerAttackRelease) {
          const originalTrigger = Tone.MembraneSynth.prototype.triggerAttackRelease;
          Tone.MembraneSynth.prototype.triggerAttackRelease = function(...args: any[]) {
            console.log('🥁 MembraneSynth (kick) trigger:', args);
            (window as any).__widgetDebug.audioAttempts.push({
              type: 'MembraneSynth',
              args,
              timestamp: Date.now()
            });
            return originalTrigger.apply(this, args);
          };
        }
      }
    });
    
    console.log('\n=== FIRST PLAY CYCLE ===');
    
    // First play
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(3000);
    
    // Get first play stats
    const firstPlayStats = await page.evaluate(() => {
      const debug = (window as any).__widgetDebug;
      return {
        schedulesCreated: debug.schedulesCreated.length,
        schedulesExecuted: debug.schedulesExecuted.length,
        audioAttempts: debug.audioAttempts.length,
        scheduleIntervals: [...new Set(debug.schedulesCreated.map((s: any) => s.interval))]
      };
    });
    
    console.log('First play stats:', firstPlayStats);
    
    // Check logs for drum loop creation
    const firstPlayDrumLogs = logs.filter(log => 
      log.includes('creating drum loop') || 
      log.includes('Creating drum loop')
    );
    console.log('Drum loop creation logs:', firstPlayDrumLogs.length);
    
    // Clear tracking
    await page.evaluate(() => {
      (window as any).__widgetDebug.schedulesCreated = [];
      (window as any).__widgetDebug.schedulesExecuted = [];
      (window as any).__widgetDebug.audioAttempts = [];
    });
    logs.length = 0;
    
    console.log('\n=== STOPPING ===');
    
    // Stop
    await page.click('button:has-text("⏹️ STOP")');
    await page.waitForTimeout(1000);
    
    console.log('\n=== SECOND PLAY CYCLE (BUG OCCURS HERE) ===');
    
    // Second play
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(3000);
    
    // Get second play stats
    const secondPlayStats = await page.evaluate(() => {
      const debug = (window as any).__widgetDebug;
      return {
        schedulesCreated: debug.schedulesCreated.length,
        schedulesExecuted: debug.schedulesExecuted.length,
        audioAttempts: debug.audioAttempts.length,
        scheduleIntervals: [...new Set(debug.schedulesCreated.map((s: any) => s.interval))]
      };
    });
    
    console.log('Second play stats:', secondPlayStats);
    
    // Check logs for drum loop creation attempt
    const secondPlayDrumLogs = logs.filter(log => 
      log.includes('creating drum loop') || 
      log.includes('Creating drum loop') ||
      log.includes('Cannot create drum loop yet')
    );
    console.log('Drum loop creation logs:', secondPlayDrumLogs);
    
    // Check for the specific bug pattern
    const bugLogs = logs.filter(log => 
      log.includes('syncIsPlaying=true') &&
      !log.includes('creating drum loop')
    );
    
    console.log('\n=== BUG ANALYSIS ===');
    if (secondPlayStats.schedulesCreated === 0 && firstPlayStats.schedulesCreated > 0) {
      console.log('❌ BUG CONFIRMED: No schedules created on second play!');
      console.log('This is caused by the !loopRef.current check preventing recreation.');
    }
    
    if (secondPlayStats.audioAttempts === 0 && firstPlayStats.audioAttempts > 0) {
      console.log('❌ IMPACT CONFIRMED: No audio played on second play!');
    }
    
    // Look for the specific condition check
    const conditionLogs = logs.filter(log => 
      log.includes('Samples loaded and syncIsPlaying=true')
    );
    
    if (conditionLogs.length > 0 && secondPlayStats.schedulesCreated === 0) {
      console.log('❌ The condition to create drum loop was met, but loopRef.current blocked it!');
    }
    
    // Verify the bug
    expect(secondPlayStats.schedulesCreated).toBe(0); // Bug: no new schedules
    expect(secondPlayStats.audioAttempts).toBe(0); // Impact: no audio
  });
});