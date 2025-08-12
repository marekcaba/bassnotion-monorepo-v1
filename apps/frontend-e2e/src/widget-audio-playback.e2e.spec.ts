import { test, expect } from '@playwright/test';

test.describe('Widget Audio Playback Investigation', () => {
  test('check if widgets are attempting to play sounds', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Capture console logs
    const logs: string[] = [];
    page.on('console', (msg) => {
      logs.push(msg.text());
    });
    
    // Monitor triggerAttackRelease calls
    await page.evaluate(() => {
      (window as any).__audioPlaybackAttempts = [];
      
      // Wait for Tone to be available
      const checkAndPatch = () => {
        const Tone = (window as any).Tone;
        if (!Tone) {
          setTimeout(checkAndPatch, 100);
          return;
        }
        
        console.log('🔊 Monitoring audio playback attempts...');
        
        // Patch Sampler prototype
        if (Tone.Sampler) {
          const originalTriggerAttackRelease = Tone.Sampler.prototype.triggerAttackRelease;
          Tone.Sampler.prototype.triggerAttackRelease = function(...args: any[]) {
            const [note, duration, time, velocity] = args;
            console.log(`🎵 Sampler.triggerAttackRelease called: note=${note}, duration=${duration}, time=${time}, velocity=${velocity}`);
            (window as any).__audioPlaybackAttempts.push({
              type: 'Sampler',
              note,
              duration,
              time,
              velocity,
              timestamp: Date.now(),
              loaded: this.loaded
            });
            return originalTriggerAttackRelease.apply(this, args);
          };
        }
        
        // Also monitor Oscillator for metronome
        if (Tone.Oscillator) {
          const originalStart = Tone.Oscillator.prototype.start;
          Tone.Oscillator.prototype.start = function(...args: any[]) {
            console.log(`🔊 Oscillator.start called: time=${args[0]}`);
            (window as any).__audioPlaybackAttempts.push({
              type: 'Oscillator',
              frequency: this.frequency.value,
              time: args[0],
              timestamp: Date.now()
            });
            return originalStart.apply(this, args);
          };
        }
      };
      
      checkAndPatch();
    });
    
    // Click play to start everything
    await page.click('button:has-text("▶️ PLAY")');
    
    // Wait for audio to potentially play
    await page.waitForTimeout(5000);
    
    // Get playback attempts
    const playbackAttempts = await page.evaluate(() => {
      return (window as any).__audioPlaybackAttempts || [];
    });
    
    console.log('\n=== Audio Playback Attempts ===');
    console.log(`Total attempts: ${playbackAttempts.length}`);
    
    // Group by type
    const byType: Record<string, any[]> = {};
    playbackAttempts.forEach((attempt: any) => {
      if (!byType[attempt.type]) {
        byType[attempt.type] = [];
      }
      byType[attempt.type].push(attempt);
    });
    
    Object.entries(byType).forEach(([type, attempts]) => {
      console.log(`\n${type}: ${attempts.length} attempts`);
      if (attempts.length > 0) {
        console.log('First few attempts:', attempts.slice(0, 3));
      }
    });
    
    // Check for specific widget logs
    const widgetLogs = logs.filter(log => 
      log.includes('DRUM TRANSPORT SCHEDULE EXECUTED') ||
      log.includes('ATTEMPTING TO PLAY') ||
      log.includes('triggering chord') ||
      log.includes('Beat:') ||
      log.includes('samples loaded')
    );
    
    console.log('\n=== Widget Execution Logs ===');
    widgetLogs.forEach(log => console.log(log));
    
    // Check sample loading
    const sampleLogs = logs.filter(log => 
      log.includes('loaded') ||
      log.includes('Sampler') ||
      log.includes('ready')
    );
    
    console.log('\n=== Sample Loading Logs ===');
    sampleLogs.slice(0, 10).forEach(log => console.log(log));
    
    if (playbackAttempts.length === 0) {
      console.log('\n❌ NO AUDIO PLAYBACK ATTEMPTS DETECTED!');
      console.log('Widgets are not calling triggerAttackRelease or start methods.');
    } else {
      console.log('\n✅ Audio playback attempts detected.');
      
      // Check if samplers are loaded
      const samplerAttempts = playbackAttempts.filter((a: any) => a.type === 'Sampler');
      const unloadedSamplers = samplerAttempts.filter((a: any) => !a.loaded);
      
      if (unloadedSamplers.length > 0) {
        console.log(`\n⚠️ WARNING: ${unloadedSamplers.length} attempts on unloaded samplers!`);
      }
    }
  });
  
  test('verify widget schedules are executing their callbacks', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Inject callback monitoring
    await page.evaluate(() => {
      (window as any).__scheduleCallbacks = [];
      
      // Monitor schedule callback execution
      const Tone = (window as any).Tone;
      if (Tone) {
        const originalScheduleRepeat = Tone.Transport.scheduleRepeat;
        Tone.Transport.scheduleRepeat = function(callback: any, interval: any, startTime: any) {
          // Wrap the callback to monitor execution
          const wrappedCallback = (time: number) => {
            console.log(`📅 Schedule callback executing at time: ${time}`);
            (window as any).__scheduleCallbacks.push({
              time,
              interval,
              startTime,
              timestamp: Date.now()
            });
            return callback(time);
          };
          
          return originalScheduleRepeat.call(this, wrappedCallback, interval, startTime);
        };
      }
    });
    
    // Click play
    await page.click('button:has-text("▶️ PLAY")');
    
    // Wait for callbacks
    await page.waitForTimeout(3000);
    
    // Get callback executions
    const callbacks = await page.evaluate(() => {
      return (window as any).__scheduleCallbacks || [];
    });
    
    console.log('\n=== Schedule Callback Executions ===');
    console.log(`Total callbacks: ${callbacks.length}`);
    
    if (callbacks.length > 0) {
      console.log('First few callbacks:', callbacks.slice(0, 5));
      
      // Check intervals
      const intervals = new Set(callbacks.map((c: any) => c.interval));
      console.log('\nUnique intervals:', Array.from(intervals));
    } else {
      console.log('\n❌ NO SCHEDULE CALLBACKS EXECUTED!');
    }
  });
});