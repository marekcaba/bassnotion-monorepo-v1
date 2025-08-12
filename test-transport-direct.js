/**
 * Direct test of Tone.js Transport.scheduleRepeat
 * Run with: node test-transport-direct.js
 */

import * as Tone from 'tone';

async function testTransportScheduling() {
  console.log('Testing Tone.js Transport.scheduleRepeat...');
  console.log('Tone.js version:', Tone.version);

  // Initialize audio context
  await Tone.start();
  
  // Configure Transport
  Tone.Transport.bpm.value = 120;
  Tone.Transport.position = 0;
  
  let callbackCount = 0;
  const callbacks = [];
  
  // Create schedule
  const scheduleId = Tone.Transport.scheduleRepeat((time) => {
    callbackCount++;
    callbacks.push({
      count: callbackCount,
      time: time,
      position: Tone.Transport.position.toString(),
      state: Tone.Transport.state
    });
    console.log(`Callback ${callbackCount}: time=${time.toFixed(3)}, position=${Tone.Transport.position}`);
  }, '8n', 0);
  
  console.log('Starting Transport with +0.1 delay (like in the app)...');
  Tone.Transport.start('+0.1');
  
  // Check Transport state
  setTimeout(() => {
    console.log('After 150ms - Transport state:', Tone.Transport.state);
  }, 150);
  
  // Monitor for 3 seconds
  await new Promise(resolve => {
    setTimeout(() => {
      console.log('\nStopping Transport...');
      Tone.Transport.clear(scheduleId);
      Tone.Transport.stop();
      resolve();
    }, 3000);
  });
  
  console.log('\nTest Results:');
  console.log('Total callbacks:', callbackCount);
  console.log('Expected callbacks (3 seconds at 120 BPM, 8n):', Math.floor(3 * 2 * 2)); // ~12
  
  if (callbackCount <= 1) {
    console.log('\n❌ ISSUE REPRODUCED: Only got', callbackCount, 'callback(s)');
    console.log('This matches the issue from the app!');
  } else {
    console.log('\n✅ Transport.scheduleRepeat is working correctly');
  }
  
  console.log('\nFirst 5 callbacks:', callbacks.slice(0, 5));
  
  // Test immediate start (no delay)
  console.log('\n\nTesting immediate start (no +0.1 delay)...');
  callbackCount = 0;
  
  const scheduleId2 = Tone.Transport.scheduleRepeat((time) => {
    callbackCount++;
    console.log(`Immediate start - Callback ${callbackCount}: time=${time.toFixed(3)}`);
  }, '8n', 0);
  
  Tone.Transport.start(); // No delay
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  Tone.Transport.clear(scheduleId2);
  Tone.Transport.stop();
  
  console.log('Immediate start callbacks:', callbackCount);
  
  process.exit(0);
}

testTransportScheduling().catch(console.error);