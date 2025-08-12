import { test, expect } from '@playwright/test';

test.describe('Transport Full Duration Playback', () => {
  test('transport plays for full exercise duration (8 seconds)', async ({ page }) => {
    // Navigate to test page
    await page.goto('http://localhost:3001/test-transport');
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Global Transport")', { timeout: 10000 });
    await page.waitForTimeout(2000); // Allow Tone.js to initialize
    
    // Set up console logging to capture events
    const logs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      logs.push(text);
      if (text.includes('Transport') || text.includes('PLAY') || text.includes('STOP')) {
        console.log('[Console]', text);
      }
    });
    
    // Monitor transport state changes
    const transportStates = await page.evaluateHandle(() => {
      const states: Array<{ time: number; state: string; position: number }> = [];
      const startTime = Date.now();
      
      // Create interval to monitor transport state
      const interval = setInterval(() => {
        const Tone = (window as any).Tone;
        if (Tone?.Transport) {
          states.push({
            time: Date.now() - startTime,
            state: Tone.Transport.state,
            position: Tone.Transport.seconds
          });
        }
      }, 100); // Check every 100ms
      
      // Store interval ID and states array for later access
      (window as any).__transportMonitor = { interval, states, startTime };
      
      return states;
    });
    
    // Click play button
    console.log('Clicking play button...');
    await page.click('button:has-text("▶️ PLAY")');
    
    // Wait for 10 seconds (longer than the 8-second exercise)
    console.log('Waiting for playback to complete...');
    await page.waitForTimeout(10000);
    
    // Stop monitoring and get results
    const playbackData = await page.evaluate(() => {
      const monitor = (window as any).__transportMonitor;
      if (monitor) {
        clearInterval(monitor.interval);
        return {
          states: monitor.states,
          totalDuration: Date.now() - monitor.startTime
        };
      }
      return null;
    });
    
    // Analyze the results
    console.log('Analyzing playback data...');
    
    if (!playbackData) {
      throw new Error('No playback data collected');
    }
    
    // Find when transport started and stopped
    const startedStates = playbackData.states.filter(s => s.state === 'started');
    const stoppedStates = playbackData.states.filter(s => s.state === 'stopped');
    
    console.log(`Transport was in 'started' state ${startedStates.length} times`);
    console.log(`Transport was in 'stopped' state ${stoppedStates.length} times`);
    
    if (startedStates.length > 0) {
      const firstStarted = startedStates[0];
      const lastStarted = startedStates[startedStates.length - 1];
      const playbackDuration = lastStarted.time - firstStarted.time;
      
      console.log(`First 'started' at: ${firstStarted.time}ms, position: ${firstStarted.position}s`);
      console.log(`Last 'started' at: ${lastStarted.time}ms, position: ${lastStarted.position}s`);
      console.log(`Playback duration: ${playbackDuration}ms`);
      console.log(`Final position reached: ${lastStarted.position}s`);
      
      // The exercise should play for 8 seconds (8000ms)
      // If it only plays for ~1 second, this test will fail
      expect(playbackDuration).toBeGreaterThan(7000); // Allow some tolerance
      expect(lastStarted.position).toBeGreaterThan(7.0); // Should reach at least 7 seconds
    } else {
      throw new Error('Transport never entered started state');
    }
    
    // Check for sync timeout logs
    const syncTimeoutLogs = logs.filter(log => 
      log.includes('Sync connection lost') || 
      log.includes('timeout') ||
      log.includes('Transport scheduled stop')
    );
    
    if (syncTimeoutLogs.length > 0) {
      console.log('⚠️ Sync timeout detected:');
      syncTimeoutLogs.forEach(log => console.log('  ', log));
    }
    
    // Check heartbeat logs
    const heartbeatLogs = logs.filter(log => log.includes('heartbeat') || log.includes('💓'));
    console.log(`Heartbeat logs found: ${heartbeatLogs.length}`);
    
    // Get final transport state
    const finalState = await page.evaluate(() => {
      const Tone = (window as any).Tone;
      return {
        state: Tone?.Transport?.state,
        position: Tone?.Transport?.seconds,
        exerciseDuration: 8 // Walking Bass Line in C is 8 seconds
      };
    });
    
    console.log('Final transport state:', finalState);
    
    // Additional check: Click stop and verify transport stops
    await page.click('button:has-text("⏹️ STOP")');
    await page.waitForTimeout(500);
    
    const stoppedState = await page.evaluate(() => {
      const Tone = (window as any).Tone;
      return {
        state: Tone?.Transport?.state,
        position: Tone?.Transport?.position
      };
    });
    
    expect(stoppedState.state).toBe('stopped');
    expect(stoppedState.position).toBe('0:0:0');
  });
  
  test('widget sync heartbeat prevents timeout during playback', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForSelector('h1:has-text("Global Transport")', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Capture heartbeat events
    const heartbeatEvents: Array<{ time: number; message: string }> = [];
    const startTime = Date.now();
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('heartbeat') || text.includes('💓') || text.includes('HEARTBEAT')) {
        heartbeatEvents.push({
          time: Date.now() - startTime,
          message: text
        });
      }
    });
    
    // Start playback
    await page.click('button:has-text("▶️ PLAY")');
    
    // Wait for 10 seconds
    await page.waitForTimeout(10000);
    
    // Verify heartbeats were sent
    console.log(`Captured ${heartbeatEvents.length} heartbeat events`);
    
    if (heartbeatEvents.length > 0) {
      // Calculate heartbeat intervals
      const intervals: number[] = [];
      for (let i = 1; i < heartbeatEvents.length; i++) {
        intervals.push(heartbeatEvents[i].time - heartbeatEvents[i - 1].time);
      }
      
      if (intervals.length > 0) {
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        console.log(`Average heartbeat interval: ${avgInterval}ms`);
        
        // Heartbeats should be sent every 5 seconds (5000ms)
        expect(avgInterval).toBeGreaterThan(4000);
        expect(avgInterval).toBeLessThan(6000);
      }
    } else {
      console.warn('No heartbeat events captured - sync timeout prevention may not be working');
    }
    
    // Stop playback
    await page.click('button:has-text("⏹️ STOP")');
  });
  
  test('transport continues playing without interruption', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForSelector('h1:has-text("Global Transport")', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Start monitoring before clicking play
    const monitorPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const Tone = (window as any).Tone;
        const samples: Array<{ time: number; position: number; state: string }> = [];
        let startTime: number | null = null;
        let interrupted = false;
        
        // Sample transport state frequently
        const interval = setInterval(() => {
          if (!Tone?.Transport) return;
          
          const currentState = Tone.Transport.state;
          const currentPosition = Tone.Transport.seconds;
          
          if (currentState === 'started' && startTime === null) {
            startTime = Date.now();
          }
          
          if (startTime !== null) {
            samples.push({
              time: Date.now() - startTime,
              position: currentPosition,
              state: currentState
            });
            
            // Check for interruptions (position going backwards or stopping early)
            if (samples.length > 1) {
              const lastSample = samples[samples.length - 2];
              const currentSample = samples[samples.length - 1];
              
              // Position should always increase (allow small tolerance for timing)
              if (currentSample.position < lastSample.position - 0.1) {
                interrupted = true;
                console.error(`Position went backwards: ${lastSample.position} -> ${currentSample.position}`);
              }
              
              // State should not change to stopped before 8 seconds
              if (currentSample.state === 'stopped' && currentSample.time < 7500) {
                interrupted = true;
                console.error(`Transport stopped early at ${currentSample.time}ms`);
              }
            }
            
            // Stop monitoring after 10 seconds
            if (Date.now() - startTime > 10000) {
              clearInterval(interval);
              resolve({ samples, interrupted });
            }
          }
        }, 50); // Sample every 50ms
      });
    });
    
    // Click play
    await page.click('button:has-text("▶️ PLAY")');
    
    // Wait for monitoring to complete
    const result = await monitorPromise as { samples: any[], interrupted: boolean };
    
    console.log(`Collected ${result.samples.length} samples over playback`);
    
    // Verify no interruptions
    expect(result.interrupted).toBe(false);
    
    // Verify continuous playback
    if (result.samples.length > 0) {
      const playingSamples = result.samples.filter(s => s.state === 'started');
      const firstPlaying = playingSamples[0];
      const lastPlaying = playingSamples[playingSamples.length - 1];
      
      console.log(`Playback duration: ${lastPlaying.time}ms`);
      console.log(`Position reached: ${lastPlaying.position}s`);
      
      // Should play for at least 7.5 seconds
      expect(lastPlaying.time).toBeGreaterThan(7500);
      expect(lastPlaying.position).toBeGreaterThan(7.5);
      
      // Check for smooth position progression
      let maxGap = 0;
      for (let i = 1; i < playingSamples.length; i++) {
        const gap = playingSamples[i].position - playingSamples[i - 1].position;
        maxGap = Math.max(maxGap, gap);
      }
      
      console.log(`Maximum position gap: ${maxGap}s`);
      // Position should increment smoothly (no large jumps)
      expect(maxGap).toBeLessThan(0.2); // 200ms max gap
    }
  });
});