/**
 * DAW Integration E2E Tests
 * Story 3.22: Professional DAW Sequencer
 * 
 * Tests the complete DAW flow in a real browser environment
 */

import { test, expect } from '@playwright/test';

test.describe('DAW Integration E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the DAW test page that uses track system
    await page.goto('http://localhost:3001/test-daw-integration');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Click somewhere to ensure user gesture for audio context
    await page.click('body');
  });

  test('should load DAW test page', async ({ page }) => {
    // Check page loaded with correct title
    await expect(page.locator('h1')).toContainText('DAW System Integration Test');
    
    // Check System Status card exists
    await expect(page.locator('h2:has-text("System Status")')).toBeVisible();
    
    // Check Test Controls card exists
    await expect(page.locator('h2:has-text("Test Controls")')).toBeVisible();
    
    // Check Event Log exists
    await expect(page.locator('h2:has-text("Event Log")')).toBeVisible();
  });

  test('should initialize DAW components after clicking play', async ({ page }) => {
    // Wait for initial load
    await page.waitForTimeout(1000);
    
    // Click the Play button to trigger initialization
    await page.click('button:has-text("Play")');
    
    // Wait for initialization
    await page.waitForTimeout(3000);
    
    // Check Transport badge - should change from "Not Initialized" to "Initialized"
    const transportBadge = page.locator('div:has(> h3:has-text("Transport"))').locator('span').first();
    await expect(transportBadge).toContainText('Initialized');
    
    // Transport state should be playing
    await expect(page.locator('text=State: playing')).toBeVisible();
  });

  test('should create and play test patterns', async ({ page }) => {
    // Wait for initialization
    await page.waitForTimeout(2000);
    
    // Create test patterns
    await page.click('button:has-text("Create Test Patterns")');
    
    // Wait for patterns to be created
    await page.waitForTimeout(500);
    
    // Check that regions were created
    const activeRegionsText = await page.locator('text=Active Regions:').first();
    await expect(activeRegionsText).toContainText('2');
    
    // Start playback
    await page.click('button:has-text("Play")');
    
    // Wait a moment
    await page.waitForTimeout(1000);
    
    // Check transport state
    const transportState = await page.locator('text=State:').first();
    await expect(transportState).toContainText('playing');
    
    // Check that position is updating
    const initialPosition = await page.locator('.font-mono.text-2xl').textContent();
    await page.waitForTimeout(1000);
    const updatedPosition = await page.locator('.font-mono.text-2xl').textContent();
    expect(initialPosition).not.toBe(updatedPosition);
    
    // Check that events are being triggered
    const triggeredEvents = await page.locator('text=Triggered:').first();
    const triggeredCount = await triggeredEvents.textContent();
    expect(parseInt(triggeredCount?.split(':')[1] || '0')).toBeGreaterThan(0);
    
    // Stop playback
    await page.click('button:has-text("Stop")');
    
    // Verify stopped
    await expect(transportState).toContainText('stopped');
  });

  test('should handle transport controls correctly', async ({ page }) => {
    // Wait for initialization
    await page.waitForTimeout(2000);
    
    // Create patterns first
    await page.click('button:has-text("Create Test Patterns")');
    await page.waitForTimeout(500);
    
    // Test Play
    await page.click('button:has-text("Play")');
    await expect(page.locator('text=Playing: ▶️ Yes')).toBeVisible();
    
    // Test Pause
    await page.click('button:has-text("Pause")');
    await expect(page.locator('text=Playing: ⏸️ No')).toBeVisible();
    
    // Resume from pause
    await page.click('button:has-text("Play")');
    await expect(page.locator('text=Playing: ▶️ Yes')).toBeVisible();
    
    // Test Stop
    await page.click('button:has-text("Stop")');
    await expect(page.locator('text=Playing: ⏸️ No')).toBeVisible();
    
    // Verify position reset to 0:0:0
    const position = await page.locator('.font-mono.text-2xl').textContent();
    expect(position).toBe('0:0:0');
  });

  test('should log events to event log', async ({ page }) => {
    // Wait for initialization
    await page.waitForTimeout(2000);
    
    // Clear console messages
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('DAW Test:')) {
        consoleLogs.push(msg.text());
      }
    });
    
    // Create patterns
    await page.click('button:has-text("Create Test Patterns")');
    
    // Check event log shows pattern creation
    const eventLog = page.locator('.space-y-1').last();
    await expect(eventLog).toContainText('Created metronome region');
    await expect(eventLog).toContainText('Created drum region');
    
    // Start playback
    await page.click('button:has-text("Play")');
    await page.waitForTimeout(1000);
    
    // Check that trigger events are logged
    await expect(eventLog).toContainText('metronome-trigger');
    await expect(eventLog).toContainText('drum-trigger');
    
    // Stop playback
    await page.click('button:has-text("Stop")');
    await expect(eventLog).toContainText('Transport stopped');
  });

  test('should test audio output', async ({ page }) => {
    // Wait for initialization
    await page.waitForTimeout(2000);
    
    // Test audio output button should be enabled
    const audioTestButton = page.locator('button:has-text("Test Audio Output")');
    await expect(audioTestButton).toBeEnabled();
    
    // Click test audio
    await audioTestButton.click();
    
    // Check event log for audio test
    const eventLog = page.locator('.space-y-1').last();
    await expect(eventLog).toContainText('Testing audio output');
    
    // Wait for test to complete
    await page.waitForTimeout(600);
    await expect(eventLog).toContainText('Audio test completed');
  });

  test('should display track information', async ({ page }) => {
    // Wait for initialization
    await page.waitForTimeout(2000);
    
    // Check metronome track
    const metronomeSection = page.locator('h3:has-text("Metronome Track")').locator('..');
    await expect(metronomeSection).toContainText('ID: test-metronome');
    await expect(metronomeSection).toContainText('Initialized: ✅');
    
    // Check drum track
    const drumSection = page.locator('h3:has-text("Drum Track")').locator('..');
    await expect(drumSection).toContainText('ID: test-drums');
    await expect(drumSection).toContainText('Initialized: ✅');
    
    // Create patterns to add regions
    await page.click('button:has-text("Create Test Patterns")');
    await page.waitForTimeout(500);
    
    // Check regions were added
    await expect(metronomeSection).toContainText('Regions: 1');
    await expect(drumSection).toContainText('Regions: 1');
  });

  test('should handle rapid transport state changes', async ({ page }) => {
    // Wait for initialization
    await page.waitForTimeout(2000);
    
    // Create patterns
    await page.click('button:has-text("Create Test Patterns")');
    await page.waitForTimeout(500);
    
    // Rapid play/pause/stop sequence
    await page.click('button:has-text("Play")');
    await page.waitForTimeout(100);
    await page.click('button:has-text("Pause")');
    await page.waitForTimeout(100);
    await page.click('button:has-text("Play")');
    await page.waitForTimeout(100);
    await page.click('button:has-text("Stop")');
    
    // System should be in stopped state
    const transportState = await page.locator('text=State:').first();
    await expect(transportState).toContainText('stopped');
    
    // Should be able to play again
    await page.click('button:has-text("Play")');
    await expect(transportState).toContainText('playing');
    
    await page.click('button:has-text("Stop")');
  });

  test('should maintain sync between multiple tracks', async ({ page }) => {
    // Wait for initialization
    await page.waitForTimeout(2000);
    
    // Create patterns
    await page.click('button:has-text("Create Test Patterns")');
    await page.waitForTimeout(500);
    
    // Start playback
    await page.click('button:has-text("Play")');
    
    // Let it play for a bit
    await page.waitForTimeout(2000);
    
    // Both metronome and drum events should be triggering
    const eventLog = page.locator('.space-y-1').last();
    const logContent = await eventLog.textContent();
    
    expect(logContent).toContain('metronome-trigger');
    expect(logContent).toContain('drum-trigger');
    
    // Stop playback
    await page.click('button:has-text("Stop")');
  });

  test('should recover from errors gracefully', async ({ page }) => {
    // Wait for initialization
    await page.waitForTimeout(2000);
    
    // Try to play without patterns (should not crash)
    await page.click('button:has-text("Play")');
    await page.waitForTimeout(500);
    
    // Should still be able to stop
    await page.click('button:has-text("Stop")');
    
    // Should still be able to create patterns
    await page.click('button:has-text("Create Test Patterns")');
    await page.waitForTimeout(500);
    
    // And play normally
    await page.click('button:has-text("Play")');
    const transportState = await page.locator('text=State:').first();
    await expect(transportState).toContainText('playing');
    
    await page.click('button:has-text("Stop")');
  });
});