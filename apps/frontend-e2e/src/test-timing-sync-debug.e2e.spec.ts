import { test, expect } from '@playwright/test';

test.describe('Timing Sync Debug', () => {
  test('should log initial sync calculation', async ({ page }) => {
    // Capture console messages
    const syncLogs: string[] = [];
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Initial sync calculated') || 
          text.includes('AudioWorklet') || 
          text.includes('timing started')) {
        console.log(`Browser: ${text}`);
        syncLogs.push(text);
      }
    });

    // Navigate to test page
    await page.goto('http://localhost:3001/test-unified-transport');
    
    // Wait for page to load
    await page.waitForSelector('text=UnifiedTransport Test', { timeout: 10000 });
    
    // Start playback
    console.log('Starting playback...');
    const playButton = await page.locator('button:has-text("Play")').first();
    await playButton.click();
    
    // Wait for initial sync to happen
    await page.waitForTimeout(3000);
    
    // Stop playback
    const stopButton = await page.locator('button:has-text("Stop")').first();
    await stopButton.click();
    
    // Check if initial sync was calculated
    const initialSyncLog = syncLogs.find(log => log.includes('Initial sync calculated'));
    console.log('Initial sync log:', initialSyncLog);
    
    // Extract offset value if found
    if (initialSyncLog) {
      const offsetMatch = initialSyncLog.match(/Offset=([\d.-]+)s/);
      if (offsetMatch) {
        const offset = parseFloat(offsetMatch[1]);
        console.log(`Calculated offset: ${offset}s (${(offset * 1000).toFixed(0)}ms)`);
        
        // The offset should be small (less than 50ms ideally)
        expect(Math.abs(offset)).toBeLessThan(0.05);
      }
    }
    
    console.log('All sync logs:', syncLogs);
  });
});