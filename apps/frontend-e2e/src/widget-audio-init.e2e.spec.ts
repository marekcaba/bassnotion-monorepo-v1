import { test, expect, Page } from '@playwright/test';

test.describe('Widget Audio Initialization', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.text().includes('Error')) {
        console.log('Console error:', msg.text());
      }
    });
  });

  test('widgets initialize audio context properly', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    
    // Wait for initial load
    await page.waitForLoadState('networkidle');
    
    // Check that Tone.js is loaded
    const toneLoaded = await page.evaluate(() => {
      return typeof (window as any).Tone !== 'undefined';
    });
    expect(toneLoaded).toBe(true);
    
    // Check initial audio context state
    const initialState = await page.evaluate(() => {
      const Tone = (window as any).Tone;
      return {
        contextExists: !!Tone?.context,
        contextState: Tone?.context?.state,
        transportState: Tone?.Transport?.state
      };
    });
    
    expect(initialState.contextExists).toBe(true);
    expect(initialState.contextState).toBe('suspended');
    expect(initialState.transportState).toBe('stopped');
    
    // Click play to start audio context
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(500);
    
    // Check audio context after user gesture
    const activeState = await page.evaluate(() => {
      const Tone = (window as any).Tone;
      return {
        contextState: Tone?.context?.state,
        transportState: Tone?.Transport?.state,
        transportTime: Tone?.Transport?.seconds
      };
    });
    
    expect(activeState.contextState).toBe('running');
    expect(activeState.transportState).toBe('started');
    expect(activeState.transportTime).toBeGreaterThan(0);
  });

  test('widgets share the same Tone instance', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    
    // Get Tone instance details from different contexts
    const toneInstances = await page.evaluate(() => {
      const results: any = {};
      
      // Check global Tone
      const globalTone = (window as any).Tone;
      results.global = {
        exists: !!globalTone,
        contextId: globalTone?.context?._context?.id,
        transportId: globalTone?.Transport?.id
      };
      
      // Check if AudioEngine exists
      const audioEngine = (window as any).AudioEngine;
      if (audioEngine) {
        results.audioEngine = {
          exists: true,
          hasTone: !!audioEngine.tone,
          contextId: audioEngine.tone?.context?._context?.id,
          transportId: audioEngine.tone?.Transport?.id
        };
      }
      
      return results;
    });
    
    // Verify Tone instances
    expect(toneInstances.global.exists).toBe(true);
    if (toneInstances.audioEngine) {
      expect(toneInstances.audioEngine.hasTone).toBe(true);
      // Should be the same instance
      expect(toneInstances.audioEngine.contextId).toBe(toneInstances.global.contextId);
    }
  });

  test('drum widget loads samples correctly', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    
    // Start playback to trigger sample loading
    await page.click('button:has-text("▶️ PLAY")');
    
    // Wait for drum samples to load
    await page.waitForFunction(
      () => {
        const logs = (window as any).__playwrightLogs || [];
        return logs.some((log: string) => log.includes('Drum samples loaded:'));
      },
      { timeout: 10000 }
    );
    
    // Check drum sampler state
    const drumState = await page.evaluate(() => {
      // This would need to be exposed by the widget
      const drumWidget = document.querySelector('[data-testid="drummer-widget"]');
      return drumWidget ? 'found' : 'not-found';
    });
    
    expect(drumState).toBe('found');
  });

  test('harmony widget loads instrument correctly', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    
    // Capture logs
    const logs: string[] = [];
    page.on('console', (msg) => {
      logs.push(msg.text());
    });
    
    // Start playback
    await page.click('button:has-text("▶️ PLAY")');
    
    // Wait for instrument to load
    await page.waitForTimeout(3000);
    
    // Check for successful loading
    const instrumentLoaded = logs.some(log => 
      log.includes('16-velocity Salamander Grand Piano ready!')
    );
    expect(instrumentLoaded).toBe(true);
    
    // Check for sampler creation
    const samplersCreated = logs.filter(log => 
      log.includes('Sampler layer') && log.includes('created')
    );
    expect(samplersCreated.length).toBeGreaterThan(0);
  });

  test('widgets handle transport state changes', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    
    // Monitor transport state changes
    const stateChanges = await page.evaluate(() => {
      const changes: any[] = [];
      const Tone = (window as any).Tone;
      
      // Store initial state
      changes.push({
        time: 'initial',
        state: Tone?.Transport?.state,
        position: Tone?.Transport?.position
      });
      
      return changes;
    });
    
    // Start transport
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(500);
    
    // Get state after play
    const playState = await page.evaluate(() => {
      const Tone = (window as any).Tone;
      return {
        state: Tone?.Transport?.state,
        position: Tone?.Transport?.position,
        seconds: Tone?.Transport?.seconds
      };
    });
    
    expect(playState.state).toBe('started');
    expect(playState.seconds).toBeGreaterThan(0);
    
    // Stop transport
    await page.click('button:has-text("⏹️ STOP")');
    await page.waitForTimeout(500);
    
    // Get state after stop
    const stopState = await page.evaluate(() => {
      const Tone = (window as any).Tone;
      return {
        state: Tone?.Transport?.state,
        position: Tone?.Transport?.position,
        seconds: Tone?.Transport?.seconds
      };
    });
    
    expect(stopState.state).toBe('stopped');
    expect(stopState.position).toBe('0:0:0');
  });

  test('widget sync connection status', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    
    // Capture sync-related logs
    const syncLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('Sync') || msg.text().includes('connection')) {
        syncLogs.push(msg.text());
      }
    });
    
    // Start playback
    await page.click('button:has-text("▶️ PLAY")');
    
    // Wait for potential sync issues
    await page.waitForTimeout(5000);
    
    // Check for sync connection lost messages
    const connectionLostLogs = syncLogs.filter(log => 
      log.includes('Sync connection lost')
    );
    
    // This test will help identify the sync issue
    if (connectionLostLogs.length > 0) {
      console.log('Sync connection issues detected:');
      connectionLostLogs.forEach(log => console.log(log));
    }
    
    // Check widget sync state
    const widgetStates = await page.evaluate(() => {
      const results: any = {};
      
      // Check if widgets are getting sync updates
      const widgets = ['drummer-widget', 'harmony-widget', 'enhanced-metronome-widget'];
      widgets.forEach(widgetId => {
        const widget = document.querySelector(`[data-testid="${widgetId}"]`);
        if (widget) {
          results[widgetId] = {
            found: true,
            // Would need to expose sync state through data attributes
          };
        }
      });
      
      return results;
    });
    
    // Log findings for debugging
    console.log('Widget states:', widgetStates);
  });

  test('transport event propagation timing', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    
    // Set up event timing capture
    await page.evaluate(() => {
      (window as any).__eventTimings = [];
      
      // Override console to capture timings
      const originalLog = console.log;
      console.log = (...args) => {
        const message = args.join(' ');
        if (message.includes('event') || message.includes('Event')) {
          (window as any).__eventTimings.push({
            time: Date.now(),
            message: message
          });
        }
        originalLog.apply(console, args);
      };
    });
    
    // Click play
    const startTime = Date.now();
    await page.click('button:has-text("▶️ PLAY")');
    
    // Wait for events to propagate
    await page.waitForTimeout(1000);
    
    // Get event timings
    const eventTimings = await page.evaluate(() => {
      return (window as any).__eventTimings || [];
    });
    
    // Analyze event propagation delays
    const playEvents = eventTimings.filter((e: any) => 
      e.message.includes('PLAY event')
    );
    
    if (playEvents.length > 1) {
      const firstEvent = playEvents[0].time;
      const lastEvent = playEvents[playEvents.length - 1].time;
      const propagationDelay = lastEvent - firstEvent;
      
      console.log(`Event propagation delay: ${propagationDelay}ms`);
      
      // Should be fast
      expect(propagationDelay).toBeLessThan(100);
    }
  });
});