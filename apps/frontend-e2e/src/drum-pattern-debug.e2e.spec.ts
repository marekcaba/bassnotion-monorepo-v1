import { test, expect } from '@playwright/test';

test.describe('Drum Pattern Debug', () => {
  test('check if drum pattern has events and why no sounds are triggered', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Capture detailed logs
    const detailedLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('drum') || text.includes('Drum') || text.includes('🥁')) {
        detailedLogs.push(text);
      }
    });
    
    // Inject deep debugging
    await page.evaluate(() => {
      (window as any).__drumDebug = {
        patternInfo: null,
        eventsProcessed: [],
        triggersAttempted: []
      };
      
      // Monitor the pattern data
      const checkPattern = setInterval(() => {
        const patternElements = document.querySelectorAll('[data-pattern]');
        if (patternElements.length > 0) {
          console.log('🥁 Found pattern elements:', patternElements.length);
        }
      }, 1000);
      
      (window as any).__patternChecker = checkPattern;
    });
    
    // Click play
    await page.click('button:has-text("▶️ PLAY")');
    
    // Wait for drum events to be logged
    await page.waitForTimeout(4000);
    
    // Extract pattern information from logs
    const patternLogs = detailedLogs.filter(log => 
      log.includes('First 3 drum events:') ||
      log.includes('pattern=') ||
      log.includes('events=') ||
      log.includes('Triggering')
    );
    
    console.log('\n=== Pattern Information ===');
    patternLogs.forEach(log => console.log(log));
    
    // Check for specific event processing
    const eventLogs = detailedLogs.filter(log => 
      log.includes('eventSubdivision') ||
      log.includes('currentSubdivision') ||
      log.includes('Triggering')
    );
    
    console.log('\n=== Event Processing ===');
    if (eventLogs.length === 0) {
      console.log('❌ NO EVENTS BEING PROCESSED!');
    } else {
      eventLogs.slice(0, 10).forEach(log => console.log(log));
    }
    
    // Check for sampler state
    const samplerLogs = detailedLogs.filter(log => 
      log.includes('samplers=') ||
      log.includes('Sampler') ||
      log.includes('synth')
    );
    
    console.log('\n=== Sampler State ===');
    samplerLogs.slice(0, 5).forEach(log => console.log(log));
    
    // Check for the drum check log
    const drumCheckLogs = detailedLogs.filter(log => 
      log.includes('Drum check:')
    );
    
    console.log('\n=== Drum Check (from schedule callback) ===');
    if (drumCheckLogs.length === 0) {
      console.log('❌ NO DRUM CHECK LOGS - Schedule might not be running!');
    } else {
      drumCheckLogs.forEach(log => console.log(log));
    }
    
    // Look for any errors
    const errorLogs = detailedLogs.filter(log => 
      log.includes('Error') ||
      log.includes('error') ||
      log.includes('failed') ||
      log.includes('Failed')
    );
    
    if (errorLogs.length > 0) {
      console.log('\n=== Errors Found ===');
      errorLogs.forEach(log => console.log(log));
    }
    
    // Get widget state directly
    const widgetState = await page.evaluate(() => {
      const drummerWidget = document.querySelector('[data-testid="drummer-widget"]');
      if (!drummerWidget) {
        return { found: false };
      }
      
      // Try to get pattern info from widget
      const patternInfo = {
        found: true,
        hasWidget: true,
        // Would need to expose pattern data through data attributes
      };
      
      return patternInfo;
    });
    
    console.log('\n=== Widget State ===');
    console.log('Drummer widget:', widgetState);
    
    // Check for the specific subdivision matching
    const subdivisionLogs = detailedLogs.filter(log => 
      log.includes('subdivision') ||
      log.includes('Subdivision')
    );
    
    console.log('\n=== Subdivision Processing ===');
    if (subdivisionLogs.length === 0) {
      console.log('❌ NO SUBDIVISION LOGS - Pattern events might not be matching!');
    } else {
      subdivisionLogs.slice(0, 10).forEach(log => console.log(log));
    }
    
    // Cleanup
    await page.evaluate(() => {
      clearInterval((window as any).__patternChecker);
    });
  });
});