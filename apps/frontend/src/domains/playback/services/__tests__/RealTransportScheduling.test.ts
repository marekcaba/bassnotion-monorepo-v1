/**
 * REAL Transport Tests - NO MOCKS
 * This test uses actual Tone.js to verify real behavior
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Skip the test setup that includes mocks
// @vitest-environment node

describe('REAL Transport Scheduling Tests', () => {
  let Tone: any;
  let scheduleId: number | null = null;

  beforeEach(async () => {
    // Dynamically import Tone.js to avoid any mocks
    const ToneModule = await import('tone');
    Tone = ToneModule.default || ToneModule;
    
    // Initialize audio context
    await Tone.start();
    
    // Reset transport
    if (Tone.Transport.state === 'started') {
      Tone.Transport.stop();
    }
    Tone.Transport.cancel();
  });

  afterEach(() => {
    // Clean up
    if (scheduleId !== null && Tone) {
      Tone.Transport.clear(scheduleId);
    }
    if (Tone && Tone.Transport.state === 'started') {
      Tone.Transport.stop();
    }
  });

  it('scheduleRepeat should fire multiple callbacks', async () => {
    const callbacks: number[] = [];
    
    scheduleId = Tone.Transport.scheduleRepeat((time: number) => {
      callbacks.push(time);
    }, '8n', 0);
    
    Tone.Transport.start();
    
    // Wait for callbacks
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Should have multiple callbacks
    expect(callbacks.length).toBeGreaterThan(5);
    console.log(`Got ${callbacks.length} callbacks in 2 seconds`);
  });

  it('schedule should persist when other code runs', async () => {
    const callbacks: number[] = [];
    
    scheduleId = Tone.Transport.scheduleRepeat((time: number) => {
      callbacks.push(time);
    }, '8n', 0);
    
    Tone.Transport.start();
    
    // Wait for first callback
    await new Promise(resolve => setTimeout(resolve, 300));
    const firstCount = callbacks.length;
    expect(firstCount).toBeGreaterThan(0);
    
    // Simulate other code running (like React re-renders)
    const someArray = new Array(1000).fill(0).map((_, i) => i * 2);
    const result = someArray.reduce((a, b) => a + b, 0);
    
    // Wait for more callbacks
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Should continue getting callbacks
    expect(callbacks.length).toBeGreaterThan(firstCount);
    console.log(`Callbacks continued: ${firstCount} -> ${callbacks.length}`);
  });

  it('multiple schedules should work independently', async () => {
    const schedule1: number[] = [];
    const schedule2: number[] = [];
    
    const id1 = Tone.Transport.scheduleRepeat((time: number) => {
      schedule1.push(time);
    }, '8n', 0);
    
    const id2 = Tone.Transport.scheduleRepeat((time: number) => {
      schedule2.push(time);
    }, '4n', 0);
    
    Tone.Transport.start();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    Tone.Transport.clear(id1);
    Tone.Transport.clear(id2);
    
    // Both should have callbacks
    expect(schedule1.length).toBeGreaterThan(2);
    expect(schedule2.length).toBeGreaterThan(1);
    
    // Schedule 1 (8n) should have ~2x callbacks as schedule 2 (4n)
    const ratio = schedule1.length / schedule2.length;
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(2.5);
  });

  it('clearing and recreating schedule should work', async () => {
    const callbacks: number[] = [];
    
    scheduleId = Tone.Transport.scheduleRepeat((time: number) => {
      callbacks.push(time);
    }, '8n', 0);
    
    Tone.Transport.start();
    
    // Get some callbacks
    await new Promise(resolve => setTimeout(resolve, 500));
    const count1 = callbacks.length;
    
    // Clear schedule
    Tone.Transport.clear(scheduleId);
    
    // Create new schedule
    scheduleId = Tone.Transport.scheduleRepeat((time: number) => {
      callbacks.push(time);
    }, '8n', 0);
    
    // Get more callbacks
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Should have more callbacks
    expect(callbacks.length).toBeGreaterThan(count1);
  });
});