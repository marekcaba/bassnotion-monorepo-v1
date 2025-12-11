import { test, expect } from '@playwright/test';

test.describe('Widget Schedule Recreation Bug', () => {
  test('widgets fail to recreate schedules after stop/play cycle', async ({
    page,
  }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Capture console logs
    const logs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('schedule') ||
        text.includes('Schedule') ||
        text.includes('DRUM TRANSPORT SCHEDULE EXECUTED') ||
        text.includes('ATTEMPTING TO PLAY') ||
        text.includes('Loop callback fired')
      ) {
        logs.push(text);
        console.log(`[Log] ${text}`);
      }
    });

    // FIRST PLAY - This should work
    console.log('\n=== FIRST PLAY ===');
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(3000);

    // Count schedule executions in first play
    const firstPlayScheduleLogs = logs.filter(
      (log) =>
        log.includes('DRUM TRANSPORT SCHEDULE EXECUTED') ||
        log.includes('ATTEMPTING TO PLAY') ||
        log.includes('Loop callback fired'),
    );

    console.log(
      `First play: ${firstPlayScheduleLogs.length} schedule executions`,
    );
    expect(firstPlayScheduleLogs.length).toBeGreaterThan(0);

    // STOP
    console.log('\n=== STOPPING ===');
    logs.length = 0; // Clear logs
    await page.click('button:has-text("⏹️ STOP")');
    await page.waitForTimeout(1000);

    // Check for schedule clearing logs
    const clearLogs = logs.filter(
      (log) => log.includes('clearing') || log.includes('Clear'),
    );
    console.log(`Stop: ${clearLogs.length} clear logs`);

    // SECOND PLAY - This is where the bug happens
    console.log('\n=== SECOND PLAY (BUG HAPPENS HERE) ===');
    logs.length = 0; // Clear logs
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(3000);

    // Count schedule executions in second play
    const secondPlayScheduleLogs = logs.filter(
      (log) =>
        log.includes('DRUM TRANSPORT SCHEDULE EXECUTED') ||
        log.includes('ATTEMPTING TO PLAY') ||
        log.includes('Loop callback fired'),
    );

    console.log(
      `Second play: ${secondPlayScheduleLogs.length} schedule executions`,
    );

    // Check for "creating" logs that indicate schedule recreation
    const recreationLogs = logs.filter(
      (log) =>
        log.includes('creating drum loop') ||
        log.includes('Creating drum loop') ||
        log.includes('Transport schedule created'),
    );
    console.log(
      `Second play: ${recreationLogs.length} schedule recreation attempts`,
    );

    // THE BUG: Second play should have schedule executions but doesn't
    if (secondPlayScheduleLogs.length === 0) {
      console.log(
        '\n❌ BUG CONFIRMED: Widgets are not recreating schedules after stop!',
      );
      console.log(
        'The drum/harmony widgets check for !loopRef.current which prevents recreation',
      );
    }

    // This test SHOULD fail, demonstrating the bug
    expect(secondPlayScheduleLogs.length).toBeGreaterThan(0);
  });

  test('verify the schedule recreation prevention condition', async ({
    page,
  }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Inject logging to track the exact condition
    await page.evaluate(() => {
      (window as any).__widgetScheduleChecks = [];

      // Override console.log to capture specific patterns
      const originalLog = console.log;
      console.log = (...args) => {
        const message = args.join(' ');

        // Look for the specific condition check
        if (
          message.includes('Samples loaded and syncIsPlaying=true') ||
          message.includes('Cannot create drum loop yet')
        ) {
          (window as any).__widgetScheduleChecks.push({
            time: Date.now(),
            message,
            phase: (window as any).__currentPhase || 'unknown',
          });
        }

        originalLog.apply(console, args);
      };
    });

    // First play
    await page.evaluate(() => {
      (window as any).__currentPhase = 'first-play';
    });
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(1000);

    // Stop
    await page.evaluate(() => {
      (window as any).__currentPhase = 'stop';
    });
    await page.click('button:has-text("⏹️ STOP")');
    await page.waitForTimeout(1000);

    // Second play
    await page.evaluate(() => {
      (window as any).__currentPhase = 'second-play';
    });
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(1000);

    // Get the checks
    const checks = await page.evaluate(
      () => (window as any).__widgetScheduleChecks,
    );

    console.log('\n=== Schedule Creation Checks ===');
    checks.forEach((check: any) => {
      console.log(`[${check.phase}] ${check.message}`);
    });

    // Find checks for each phase
    const firstPlayChecks = checks.filter((c: any) => c.phase === 'first-play');
    const secondPlayChecks = checks.filter(
      (c: any) => c.phase === 'second-play',
    );

    console.log(
      `\nFirst play: ${firstPlayChecks.length} schedule creation checks`,
    );
    console.log(
      `Second play: ${secondPlayChecks.length} schedule creation checks`,
    );

    // The bug: second play should also attempt to create schedules
    expect(secondPlayChecks.length).toBeGreaterThan(0);
  });
});
