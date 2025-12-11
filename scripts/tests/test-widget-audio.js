// Test script to verify widget audio production
// Run this in the browser console on http://localhost:3001/test-transport

async function testWidgetAudio() {
  console.log('🎵 Testing Widget Audio Production...');

  // Wait for page to load
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Check if CoreServices is available
  const coreServices = window.__coreServices;
  if (!coreServices) {
    console.error('❌ CoreServices not available');
    return;
  }

  // Get transport controller
  const transportController = coreServices.getTransportController();
  const audioEngine = coreServices.getAudioEngine();

  console.log('📊 AudioContext state:', audioEngine.getContext()?.state);
  console.log('🎹 Tone.js state:', audioEngine.getTone().Transport.state);

  // Start transport
  console.log('▶️ Starting transport...');
  await transportController.start();

  // Wait a bit
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Check transport state
  console.log('🔍 Transport state:', transportController.getState());
  console.log(
    '🔍 Tone.Transport.state:',
    audioEngine.getTone().Transport.state,
  );
  console.log(
    '🔍 Transport position:',
    audioEngine.getTone().Transport.position,
  );
  console.log('🔍 Transport seconds:', audioEngine.getTone().Transport.seconds);

  // Check if any loops are scheduled
  const tone = audioEngine.getTone();
  console.log('🔍 Transport events:', tone.Transport._timeline._events);

  // Stop after 5 seconds
  setTimeout(async () => {
    console.log('⏹️ Stopping transport...');
    await transportController.stop();
    console.log('✅ Test complete');
  }, 5000);
}

// Instructions
console.log(`
=== Widget Audio Test Instructions ===
1. Open http://localhost:3001/test-transport in your browser
2. Open the browser console (F12)
3. Copy and paste this entire script
4. Run: testWidgetAudio()
5. You should hear audio from the widgets if everything is working
`);
