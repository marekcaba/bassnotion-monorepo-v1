import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

test.describe('Transport Event Propagation Diagnostics', () => {
  let page: Page;
  let eventLog: any[] = [];

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    eventLog = [];

    // Inject event tracking
    await page.addInitScript(() => {
      (window as any).__eventLog = [];
      (window as any).__originalEmit = null;

      // Track all events
      const trackEvent = (source: string, event: any) => {
        (window as any).__eventLog.push({
          timestamp: Date.now(),
          source,
          event: typeof event === 'object' ? JSON.stringify(event) : event,
          stack: new Error().stack,
        });
      };

      // Override console to track events
      const originalLog = console.log;
      console.log = (...args) => {
        const message = args.join(' ');
        if (
          message.includes('event') ||
          message.includes('Event') ||
          message.includes('Sync') ||
          message.includes('Transport')
        ) {
          trackEvent('console', message);
        }
        originalLog.apply(console, args);
      };
    });

    // Capture console
    page.on('console', (msg) => {
      eventLog.push({
        type: msg.type(),
        text: msg.text(),
        time: Date.now(),
      });
    });
  });

  test('diagnose sync connection timeout issue', async () => {
    await page.goto('/test-transport');
    await page.waitForLoadState('networkidle');

    // Get initial widget sync state
    const initialSyncState = await page.evaluate(() => {
      return {
        hasWidgetSyncService: !!(window as any).WidgetSyncService,
        hasEventBus: !!(window as any).__eventBus,
        hasTone: !!(window as any).Tone,
      };
    });

    console.log('Initial sync state:', initialSyncState);

    // Start transport
    await page.click('[data-testid="play-button"]');

    // Monitor for 35 seconds (past the 30s timeout)
    console.log('Monitoring for sync timeout...');
    const startTime = Date.now();

    while (Date.now() - startTime < 35000) {
      await page.waitForTimeout(5000);

      // Check for timeout messages
      const timeoutLogs = eventLog.filter((log) =>
        log.text?.includes('Sync connection lost'),
      );

      if (timeoutLogs.length > 0) {
        console.error('SYNC TIMEOUT DETECTED:');
        timeoutLogs.forEach((log) => {
          console.error(log.text);
          // Extract widget name and timeout duration
          const match = log.text.match(
            /\[([^\]]+)\] Sync connection lost \((\d+)ms/,
          );
          if (match) {
            console.error(`Widget: ${match[1]}, Timeout: ${match[2]}ms`);
          }
        });
        break;
      }
    }

    // Get final state
    const finalState = await page.evaluate(() => {
      const events = (window as any).__eventLog || [];
      return {
        totalEvents: events.length,
        transportState: (window as any).Tone?.Transport?.state,
        contextState: (window as any).Tone?.context?.state,
      };
    });

    console.log('Final state:', finalState);
  });

  test('trace event flow from transport to widgets', async () => {
    await page.goto('/test-transport');
    await page.waitForLoadState('networkidle');

    // Clear event log
    await page.evaluate(() => {
      (window as any).__eventFlow = [];
    });

    // Start tracking event flow
    await page.evaluate(() => {
      const flow = (window as any).__eventFlow;

      // Hook into WidgetSyncService if available
      const checkAndHook = setInterval(() => {
        const syncService = (window as any).WidgetSyncService;
        if (syncService && syncService.getInstance) {
          const instance = syncService.getInstance();
          if (instance && instance.emit && !instance.__hooked) {
            const originalEmit = instance.emit.bind(instance);
            instance.emit = (event: string, data: any) => {
              flow.push({
                time: Date.now(),
                type: 'emit',
                event,
                data: JSON.stringify(data),
              });
              return originalEmit(event, data);
            };
            instance.__hooked = true;
            clearInterval(checkAndHook);
          }
        }
      }, 100);
    });

    await page.waitForTimeout(1000);

    // Click play
    await page.click('[data-testid="play-button"]');
    await page.waitForTimeout(2000);

    // Get event flow
    const eventFlow = await page.evaluate(() => {
      return (window as any).__eventFlow || [];
    });

    console.log('Event flow:', eventFlow);

    // Analyze flow
    const playEvents = eventFlow.filter((e: any) => e.event === 'PLAY');
    if (playEvents.length === 0) {
      console.error('NO PLAY EVENTS DETECTED IN FLOW!');
    }
  });

  test('check widget registration and connection', async () => {
    await page.goto('/test-transport');
    await page.waitForLoadState('networkidle');

    // Wait for widgets to load
    await page.waitForTimeout(2000);

    // Check widget registration
    const widgetInfo = await page.evaluate(() => {
      const results: any = {
        widgets: [],
        syncServiceExists: false,
      };

      // Check if WidgetSyncService exists
      const SyncService = (window as any).WidgetSyncService;
      if (SyncService) {
        results.syncServiceExists = true;

        // Try to get instance
        if (SyncService.getInstance) {
          const instance = SyncService.getInstance();
          if (instance) {
            results.hasInstance = true;
            // Check for registered widgets (this depends on implementation)
            results.instanceInfo = {
              hasEmit: typeof instance.emit === 'function',
              hasOn: typeof instance.on === 'function',
              hasRegisterWidget: typeof instance.registerWidget === 'function',
            };
          }
        }
      }

      // Check for widget elements
      const widgetTypes = [
        'drummer-widget',
        'harmony-widget',
        'enhanced-metronome-widget',
      ];
      widgetTypes.forEach((type) => {
        const element = document.querySelector(`[data-testid="${type}"]`);
        if (element) {
          results.widgets.push({
            type,
            found: true,
          });
        }
      });

      return results;
    });

    console.log('Widget registration info:', widgetInfo);
    expect(widgetInfo.syncServiceExists).toBe(true);
    expect(widgetInfo.widgets.length).toBeGreaterThan(0);
  });

  test('verify transport controller event emission', async () => {
    await page.goto('/test-transport');
    await page.waitForLoadState('networkidle');

    // Hook into transport controller
    await page.evaluate(() => {
      (window as any).__transportEvents = [];

      // Try to find TransportController
      const checkController = setInterval(() => {
        // This depends on how TransportController is exposed
        const controller =
          (window as any).TransportController ||
          (window as any).__transportController;

        if (controller && !controller.__hooked) {
          console.log('Found TransportController, hooking...');

          // Hook into event emission if possible
          if (controller.emit) {
            const originalEmit = controller.emit.bind(controller);
            controller.emit = (event: string, ...args: any[]) => {
              (window as any).__transportEvents.push({
                time: Date.now(),
                event,
                args,
              });
              return originalEmit(event, ...args);
            };
          }

          controller.__hooked = true;
          clearInterval(checkController);
        }
      }, 100);

      setTimeout(() => clearInterval(checkController), 5000);
    });

    await page.waitForTimeout(1000);

    // Start transport
    await page.click('[data-testid="play-button"]');
    await page.waitForTimeout(2000);

    // Get captured events
    const transportEvents = await page.evaluate(() => {
      return (window as any).__transportEvents || [];
    });

    console.log('Transport events:', transportEvents);

    // Stop transport
    await page.click('[data-testid="stop-button"]');
    await page.waitForTimeout(1000);

    // Get final events
    const finalEvents = await page.evaluate(() => {
      return (window as any).__transportEvents || [];
    });

    console.log('Total transport events:', finalEvents.length);
  });

  test('identify sync heartbeat mechanism', async () => {
    await page.goto('/test-transport');
    await page.waitForLoadState('networkidle');

    // Monitor for heartbeat patterns
    const heartbeatLogs: any[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('heartbeat') ||
        text.includes('ping') ||
        text.includes('keepalive') ||
        text.includes('sync check')
      ) {
        heartbeatLogs.push({
          time: Date.now(),
          text,
        });
      }
    });

    // Start playback
    await page.click('[data-testid="play-button"]');

    // Monitor for 10 seconds
    await page.waitForTimeout(10000);

    console.log('Heartbeat logs found:', heartbeatLogs.length);
    heartbeatLogs.forEach((log) => console.log(log));

    // If no heartbeat found, that's likely the issue
    if (heartbeatLogs.length === 0) {
      console.error(
        'NO HEARTBEAT MECHANISM DETECTED - This is likely why sync times out!',
      );
    }
  });

  test('check for widget update loops', async () => {
    await page.goto('/test-transport');
    await page.waitForLoadState('networkidle');

    // Track widget update patterns
    const updatePatterns: any[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('DrummerWidget:') ||
        text.includes('HarmonyWidget:') ||
        text.includes('MetronomeWidget:')
      ) {
        updatePatterns.push({
          time: Date.now(),
          widget: text.split(':')[0],
          message: text,
        });
      }
    });

    // Start playback
    await page.click('[data-testid="play-button"]');

    // Let it run for 5 seconds
    await page.waitForTimeout(5000);

    // Analyze update frequency
    const widgetTypes = ['DrummerWidget', 'HarmonyWidget', 'MetronomeWidget'];
    widgetTypes.forEach((widget) => {
      const updates = updatePatterns.filter((p) => p.widget.includes(widget));
      console.log(`${widget} updates:`, updates.length);

      if (updates.length > 0) {
        const firstUpdate = updates[0].time;
        const lastUpdate = updates[updates.length - 1].time;
        const duration = lastUpdate - firstUpdate;
        const rate = updates.length / (duration / 1000);
        console.log(`${widget} update rate: ${rate.toFixed(2)} updates/second`);
      }
    });
  });
});
