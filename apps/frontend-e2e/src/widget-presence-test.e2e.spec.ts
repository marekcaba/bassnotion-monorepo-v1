import { test, expect } from '@playwright/test';

test.describe('Widget Presence Test', () => {
  test('check if widgets are actually rendered and creating schedules', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Capture console logs
    const logs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('Widget') || text.includes('widget') || text.includes('🥁') || text.includes('🎵')) {
        logs.push(text);
      }
    });
    
    // Check for widget elements
    const widgetInfo = await page.evaluate(() => {
      const drummer = document.querySelector('[data-testid="drummer-widget"]');
      const harmony = document.querySelector('[data-testid="harmony-widget"]');
      const metronome = document.querySelector('[data-testid="metronome-widget"]');
      const enhancedMetronome = document.querySelector('[data-testid="enhanced-metronome-widget"]');
      
      // Check if widgets are visible
      const drummerVisible = drummer ? window.getComputedStyle(drummer).display !== 'none' : false;
      const harmonyVisible = harmony ? window.getComputedStyle(harmony).display !== 'none' : false;
      
      return {
        drummer: { exists: !!drummer, visible: drummerVisible },
        harmony: { exists: !!harmony, visible: harmonyVisible },
        metronome: { exists: !!metronome },
        enhancedMetronome: { exists: !!enhancedMetronome }
      };
    });
    
    console.log('\n=== Widget Presence ===');
    console.log('Drummer widget:', widgetInfo.drummer);
    console.log('Harmony widget:', widgetInfo.harmony);
    console.log('Metronome widget:', widgetInfo.metronome);
    console.log('Enhanced Metronome widget:', widgetInfo.enhancedMetronome);
    
    // Check if "Show Widgets" button exists
    const showWidgetsButton = await page.$('button:has-text("Show Widgets")');
    if (showWidgetsButton) {
      console.log('\n⚠️ Widgets are hidden! Clicking "Show Widgets" button...');
      await showWidgetsButton.click();
      await page.waitForTimeout(1000);
      
      // Re-check widget presence
      const afterShow = await page.evaluate(() => {
        const drummer = document.querySelector('[data-testid="drummer-widget"]');
        const harmony = document.querySelector('[data-testid="harmony-widget"]');
        return {
          drummer: !!drummer,
          harmony: !!harmony
        };
      });
      console.log('After showing widgets:', afterShow);
    }
    
    // Now click play
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(3000);
    
    // Check logs for widget initialization
    const initLogs = logs.filter(log => 
      log.includes('Creating drum loop') ||
      log.includes('Transport schedule created') ||
      log.includes('Samples loaded') ||
      log.includes('initialized')
    );
    
    console.log('\n=== Widget Initialization Logs ===');
    if (initLogs.length === 0) {
      console.log('❌ NO WIDGET INITIALIZATION LOGS!');
    } else {
      initLogs.forEach(log => console.log(log));
    }
    
    // Check for schedule creation
    const scheduleLogs = logs.filter(log => 
      log.includes('schedule') && log.includes('created')
    );
    
    console.log('\n=== Schedule Creation Logs ===');
    if (scheduleLogs.length === 0) {
      console.log('❌ NO SCHEDULE CREATION LOGS!');
    } else {
      scheduleLogs.forEach(log => console.log(log));
    }
    
    // Check for any widget errors
    const errorLogs = logs.filter(log => 
      log.includes('Error') || log.includes('error') || log.includes('failed')
    );
    
    if (errorLogs.length > 0) {
      console.log('\n=== Widget Errors ===');
      errorLogs.forEach(log => console.log(log));
    }
  });
});