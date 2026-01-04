/**
 * Playback Machines - XState state machines for playback domain
 *
 * Phase 5: DevTools integration for visual debugging
 */

// Playback Engine Machine
export {
  playbackMachine,
  type PlaybackMachineContext,
  type PlaybackMachineEvent,
  type PlaybackMachineInput,
  type PlaybackStateValue,
  type MachineTrack,
  type MachineRegion,
  type MachinePatternEvent,
  type PlaybackMachine,
  type PlaybackMachineState,
} from './playbackMachine.js';

// React Hook
export {
  usePlaybackMachine,
  useShadowComparison,
  type UsePlaybackMachineOptions,
  type UsePlaybackMachineReturn,
} from './usePlaybackMachine.js';

// DevTools
export {
  initXStateDevTools,
  getInspector,
  isDevToolsInitialized,
  getDevToolsConfig,
  createStateLogger,
  createStateHistoryTracker,
  createTransitionTimer,
  registerActor,
  unregisterActor,
  getRegisteredActors,
  type DevToolsConfig,
  type StateHistoryEntry,
  type StateHistoryTracker,
  type TransitionMetric,
} from './devtools.js';

// DevTools Provider & Components
export {
  XStateDevToolsProvider,
  useXStateDevTools,
  useXStateDevToolsRequired,
  type XStateDevToolsContextValue,
  type XStateDevToolsProviderProps,
} from './XStateDevToolsProvider.js';

export {
  XStateDebugPanel,
  type XStateDebugPanelProps,
} from './XStateDebugPanel.js';

// Test Utilities (for testing XState machines)
export {
  createTestActor,
  runMachineWithEvents,
  assertTransition,
  assertTransitionBlocked,
  createContextMatcher,
  createActionTracker,
  createMockAudioContext,
  createMockAudioDestination,
  createMockEventBus,
  runTransitionTests,
  simplifySnapshot,
  printSnapshot,
  type TransitionTestCase,
  type StateAssertionOptions,
  type ActionTracker,
} from './__tests__/testUtils.js';
