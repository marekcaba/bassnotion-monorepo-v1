import { test, expect } from '@playwright/test';

test.describe('Debug Buffer Check', () => {
  test('check why no audio is produced', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Capture all logs
    const logs: string[] = [];
    page.on('console', (msg) => {
      logs.push(msg.text());
    });
    
    // Click play
    console.log('\n=== Starting playback ===');
    await page.click('button:has-text("▶️ PLAY")');
    
    // Wait for a bit
    await page.waitForTimeout(3000);
    
    // Filter relevant logs
    const harmonyLogs = logs.filter(log => 
      log.includes('HarmonyWidget') ||
      log.includes('🎹') ||
      log.includes('🎵')
    );
    
    const errorLogs = logs.filter(log => 
      log.includes('error') ||
      log.includes('Error') ||
      log.includes('failed') ||
      log.includes('Failed')
    );
    
    const bufferLogs = logs.filter(log => 
      log.includes('buffer') ||
      log.includes('Buffer') ||
      log.includes('loaded') ||
      log.includes('Loaded')
    );
    
    const samplerLogs = logs.filter(log => 
      log.includes('Sampler') ||
      log.includes('sampler') ||
      log.includes('layer')
    );
    
    console.log('\n=== Harmony Widget Logs ===');
    harmonyLogs.slice(0, 10).forEach(log => console.log(log));
    
    console.log('\n=== Sampler/Buffer Logs ===');
    samplerLogs.slice(0, 10).forEach(log => console.log(log));
    
    console.log('\n=== Buffer Related Logs ===');
    bufferLogs.slice(0, 10).forEach(log => console.log(log));
    
    console.log('\n=== Errors ===');
    errorLogs.slice(0, 10).forEach(log => console.log(log));
    
    // Check for specific issues
    const notLoadedLogs = logs.filter(log => 
      log.includes('not loaded') ||
      log.includes('not available')
    );
    
    if (notLoadedLogs.length > 0) {
      console.log('\n=== Not Loaded Issues ===');
      notLoadedLogs.forEach(log => console.log(log));
    }
    
    const fallbackLogs = logs.filter(log => 
      log.includes('fallback') ||
      log.includes('Fallback')
    );
    
    if (fallbackLogs.length > 0) {
      console.log('\n=== Fallback Attempts ===');
      fallbackLogs.forEach(log => console.log(log));
    }
  });
});