import { test, expect } from '@playwright/test';

test.describe('Harmony Schedule Debug', () => {
  test('check what happens in harmony schedule callback', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Capture all logs
    const allLogs: string[] = [];
    page.on('console', (msg) => {
      allLogs.push(msg.text());
    });
    
    // Click play
    console.log('\n=== Starting playback ===');
    await page.click('button:has-text("▶️ PLAY")');
    
    // Wait for execution
    await page.waitForTimeout(5000);
    
    // Filter relevant logs
    const harmonyExecutionLogs = allLogs.filter(log => 
      log.includes('HARMONY TRANSPORT SCHEDULE EXECUTED')
    );
    
    const attemptingToPlayLogs = allLogs.filter(log => 
      log.includes('ATTEMPTING TO PLAY')
    );
    
    const successLogs = allLogs.filter(log => 
      log.includes('SUCCESS: playChord called')
    );
    
    const errorLogs = allLogs.filter(log => 
      log.includes('ERROR playing') ||
      log.includes('error playing') ||
      log.includes('Error playing')
    );
    
    const processorLogs = allLogs.filter(log => 
      log.includes('processor') ||
      log.includes('Processor') ||
      log.includes('ChordInstrumentProcessor')
    );
    
    const firstChordLogs = allLogs.filter(log => 
      log.includes('first chord check') ||
      log.includes('First chord check')
    );
    
    console.log('\n=== Harmony Schedule Execution ===');
    console.log(`Schedule executions: ${harmonyExecutionLogs.length}`);
    if (harmonyExecutionLogs.length > 0) {
      console.log('First few executions:');
      harmonyExecutionLogs.slice(0, 3).forEach(log => console.log(log));
    }
    
    console.log('\n=== Chord Play Attempts ===');
    console.log(`Play attempts: ${attemptingToPlayLogs.length}`);
    console.log(`Successful calls: ${successLogs.length}`);
    console.log(`Errors: ${errorLogs.length}`);
    
    if (attemptingToPlayLogs.length > 0) {
      console.log('\nFirst attempt:');
      console.log(attemptingToPlayLogs[0]);
    }
    
    if (successLogs.length > 0) {
      console.log('\nFirst success:');
      console.log(successLogs[0]);
    }
    
    if (errorLogs.length > 0) {
      console.log('\n❌ Errors found:');
      errorLogs.forEach(log => console.log(log));
    }
    
    console.log('\n=== First Chord Check ===');
    if (firstChordLogs.length > 0) {
      firstChordLogs.forEach(log => console.log(log));
    } else {
      console.log('No first chord check logs found');
    }
    
    console.log('\n=== Processor Logs ===');
    const initLogs = processorLogs.filter(log => 
      log.includes('initialized') ||
      log.includes('ready') ||
      log.includes('Creating')
    );
    
    if (initLogs.length > 0) {
      console.log('Initialization logs:');
      initLogs.forEach(log => console.log(log));
    } else {
      console.log('❌ No processor initialization logs found!');
    }
    
    // Check for loading/sample logs
    const loadingLogs = allLogs.filter(log => 
      log.includes('loading') ||
      log.includes('Loading') ||
      log.includes('loaded') ||
      log.includes('Loaded') ||
      log.includes('sample') ||
      log.includes('Sample')
    );
    
    if (loadingLogs.length > 0) {
      console.log('\n=== Loading/Sample Logs ===');
      loadingLogs.slice(0, 5).forEach(log => console.log(log));
    }
    
    // Check transport state during attempts
    const transportStateLogs = allLogs.filter(log => 
      log.includes('Transport now started')
    );
    
    if (transportStateLogs.length > 0) {
      console.log('\n=== Transport State ===');
      transportStateLogs.forEach(log => console.log(log));
    }
  });
});