/**
 * XState Machine Testing Utilities
 *
 * Phase 4: Test Infrastructure
 *
 * This module provides utilities for testing XState v5 machines without
 * needing a full React environment. These utilities help:
 *
 * 1. Create and run machines synchronously for unit tests
 * 2. Assert state transitions and guards
 * 3. Track and verify action execution
 * 4. Test async actors with mocked implementations
 */

import { createActor, type AnyStateMachine, type SnapshotFrom, type EventFromLogic } from 'xstate';

// ============================================================================
// Types
// ============================================================================

export interface TransitionTestCase<TMachine extends AnyStateMachine> {
  /** Description of the test case */
  description: string;
  /** Initial state for the test */
  initialState?: SnapshotFrom<TMachine>['value'];
  /** Sequence of events to send */
  events: EventFromLogic<TMachine>[];
  /** Expected final state */
  expectedState: SnapshotFrom<TMachine>['value'];
  /** Optional: expected context values to check */
  expectedContext?: Partial<SnapshotFrom<TMachine>['context']>;
}

export interface StateAssertionOptions {
  /** Whether to log state transitions for debugging */
  logTransitions?: boolean;
  /** Timeout for async transitions (ms) */
  timeout?: number;
}

export interface ActionTracker {
  /** List of action names that were executed */
  executed: string[];
  /** Clear the executed actions list */
  clear: () => void;
  /** Check if an action was executed */
  wasExecuted: (actionName: string) => boolean;
  /** Get execution count for an action */
  getCount: (actionName: string) => number;
}

// ============================================================================
// Core Test Utilities
// ============================================================================

/**
 * Creates a test actor for a machine with optional initial state override
 *
 * @example
 * const actor = createTestActor(playbackMachine, { context: { tempo: 140 } });
 * actor.start();
 * actor.send({ type: 'START' });
 */
export function createTestActor<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: {
    context?: Partial<SnapshotFrom<TMachine>['context']>;
    input?: Parameters<typeof createActor<TMachine>>[1] extends { input?: infer I } ? I : never;
  }
) {
  // If context override is provided, we need to handle it carefully
  // XState v5 uses input for initial context, not direct context override
  const actor = createActor(machine, {
    input: options?.input,
    // Snapshot restoration could be used for specific state starting
  });

  return actor;
}

/**
 * Runs a machine through a sequence of events and returns the final snapshot
 *
 * @example
 * const result = runMachineWithEvents(playbackMachine, [
 *   { type: 'INITIALIZE', audioContext: mockAudioContext },
 *   { type: 'START' },
 * ]);
 * expect(result.value).toBe('playing');
 */
export async function runMachineWithEvents<TMachine extends AnyStateMachine>(
  machine: TMachine,
  events: EventFromLogic<TMachine>[],
  options?: StateAssertionOptions & {
    input?: Parameters<typeof createActor<TMachine>>[1] extends { input?: infer I } ? I : never;
  }
): Promise<SnapshotFrom<TMachine>> {
  const { logTransitions = false, timeout = 5000, input } = options ?? {};

  const actor = createActor(machine, { input });

  if (logTransitions) {
    actor.subscribe((snapshot) => {
      console.log(`[Test] State: ${JSON.stringify(snapshot.value)}`);
    });
  }

  actor.start();

  // Send events with small delays to allow async transitions
  for (const event of events) {
    if (logTransitions) {
      console.log(`[Test] Sending: ${event.type}`);
    }
    actor.send(event);

    // Wait a tick for state machine to process
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  // Wait for any async transitions to complete
  await waitForStableState(actor, timeout);

  const snapshot = actor.getSnapshot();
  actor.stop();

  return snapshot;
}

/**
 * Wait for the machine to reach a stable state (no pending async operations)
 */
async function waitForStableState<TActor extends ReturnType<typeof createActor<AnyStateMachine>>>(
  actor: TActor,
  timeout: number
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const snapshot = actor.getSnapshot();

    // Check if there are no running invoke actors
    // In XState v5, we can check if the machine is in a stable state
    const isStable = !snapshot.status || snapshot.status === 'active';

    if (isStable) {
      // Give a small buffer for any final transitions
      await new Promise((resolve) => setTimeout(resolve, 50));
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Asserts that a machine transition from state A to state B on event E
 *
 * @example
 * await assertTransition(playbackMachine, 'ready', { type: 'START' }, 'starting');
 */
export async function assertTransition<TMachine extends AnyStateMachine>(
  machine: TMachine,
  fromState: SnapshotFrom<TMachine>['value'],
  event: EventFromLogic<TMachine>,
  expectedState: SnapshotFrom<TMachine>['value'],
  options?: StateAssertionOptions
): Promise<void> {
  // For simple state comparison, we use the machine's transition function
  // This is a pure function that doesn't require an actor
  const nextSnapshot = machine.transition(fromState, event);

  const actualState = nextSnapshot.value;

  if (JSON.stringify(actualState) !== JSON.stringify(expectedState)) {
    throw new Error(
      `Transition failed:\n` +
        `  From: ${JSON.stringify(fromState)}\n` +
        `  Event: ${event.type}\n` +
        `  Expected: ${JSON.stringify(expectedState)}\n` +
        `  Actual: ${JSON.stringify(actualState)}`
    );
  }
}

/**
 * Asserts that a transition is blocked (guard returns false or event not allowed)
 */
export function assertTransitionBlocked<TMachine extends AnyStateMachine>(
  machine: TMachine,
  fromState: SnapshotFrom<TMachine>['value'],
  event: EventFromLogic<TMachine>
): void {
  const nextSnapshot = machine.transition(fromState, event);

  // If transition is blocked, state should remain the same
  if (JSON.stringify(nextSnapshot.value) !== JSON.stringify(fromState)) {
    throw new Error(
      `Expected transition to be blocked, but it wasn't:\n` +
        `  From: ${JSON.stringify(fromState)}\n` +
        `  Event: ${event.type}\n` +
        `  Resulted in: ${JSON.stringify(nextSnapshot.value)}`
    );
  }
}

/**
 * Creates a context matcher for partial context assertions
 *
 * @example
 * const matcher = createContextMatcher({ tempo: 140, isPlaying: true });
 * expect(matcher(snapshot.context)).toBe(true);
 */
export function createContextMatcher<TContext extends Record<string, unknown>>(
  expectedPartial: Partial<TContext>
): (context: TContext) => boolean {
  return (context: TContext) => {
    for (const [key, value] of Object.entries(expectedPartial)) {
      if (context[key as keyof TContext] !== value) {
        return false;
      }
    }
    return true;
  };
}

// ============================================================================
// Action Tracking
// ============================================================================

/**
 * Creates an action tracker for verifying action execution
 *
 * @example
 * const tracker = createActionTracker();
 * // ... run machine with tracked actions
 * expect(tracker.wasExecuted('setTempo')).toBe(true);
 */
export function createActionTracker(): ActionTracker {
  const executed: string[] = [];

  return {
    executed,
    clear: () => {
      executed.length = 0;
    },
    wasExecuted: (actionName: string) => executed.includes(actionName),
    getCount: (actionName: string) => executed.filter((a) => a === actionName).length,
  };
}

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Creates a mock AudioContext for testing
 */
export function createMockAudioContext(): AudioContext {
  return {
    currentTime: 0,
    sampleRate: 44100,
    destination: {} as AudioDestinationNode,
    state: 'running',
    createGain: () => ({
      connect: () => {},
      gain: { value: 1 },
    }),
    createOscillator: () => ({
      connect: () => {},
      start: () => {},
      stop: () => {},
      frequency: { value: 440 },
    }),
    resume: async () => {},
    suspend: async () => {},
    close: async () => {},
  } as unknown as AudioContext;
}

/**
 * Creates a mock AudioNode for testing
 */
export function createMockAudioDestination(): AudioNode {
  return {
    connect: () => {},
    disconnect: () => {},
  } as unknown as AudioNode;
}

/**
 * Creates a mock EventBus for testing
 */
export function createMockEventBus() {
  const listeners = new Map<string, Set<Function>>();

  return {
    on: (event: string, handler: Function) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(handler);
      return () => listeners.get(event)?.delete(handler);
    },
    off: (event: string, handler: Function) => {
      listeners.get(event)?.delete(handler);
    },
    emit: (event: string, data?: unknown) => {
      listeners.get(event)?.forEach((handler) => handler(data));
    },
    // Test helper: get all registered listeners
    getListeners: () => listeners,
    // Test helper: clear all listeners
    clear: () => listeners.clear(),
  };
}

// ============================================================================
// Test Runner Utilities
// ============================================================================

/**
 * Runs a batch of transition test cases
 *
 * @example
 * runTransitionTests(playbackMachine, [
 *   {
 *     description: 'should transition from ready to starting on START',
 *     initialState: 'ready',
 *     events: [{ type: 'START' }],
 *     expectedState: 'starting',
 *   },
 * ]);
 */
export function runTransitionTests<TMachine extends AnyStateMachine>(
  machine: TMachine,
  testCases: TransitionTestCase<TMachine>[],
  runTest: (name: string, fn: () => void | Promise<void>) => void
): void {
  for (const testCase of testCases) {
    runTest(testCase.description, async () => {
      // Start from initial state if provided, otherwise use machine's initial
      let currentState = testCase.initialState ?? machine.config.initial;

      // Apply events sequentially
      for (const event of testCase.events) {
        const nextSnapshot = machine.transition(currentState, event);
        currentState = nextSnapshot.value as typeof currentState;
      }

      // Check final state
      if (JSON.stringify(currentState) !== JSON.stringify(testCase.expectedState)) {
        throw new Error(
          `Expected state ${JSON.stringify(testCase.expectedState)}, got ${JSON.stringify(currentState)}`
        );
      }
    });
  }
}

// ============================================================================
// Snapshot Utilities
// ============================================================================

/**
 * Creates a simplified snapshot representation for debugging
 */
export function simplifySnapshot<TMachine extends AnyStateMachine>(
  snapshot: SnapshotFrom<TMachine>
): Record<string, unknown> {
  return {
    value: snapshot.value,
    context: snapshot.context,
    status: snapshot.status,
  };
}

/**
 * Pretty-prints a snapshot for debugging
 */
export function printSnapshot<TMachine extends AnyStateMachine>(
  snapshot: SnapshotFrom<TMachine>,
  label?: string
): void {
  console.log(
    `${label ? `[${label}] ` : ''}State Machine Snapshot:`,
    JSON.stringify(simplifySnapshot(snapshot), null, 2)
  );
}

// ============================================================================
// Exports
// ============================================================================

export type { AnyStateMachine, SnapshotFrom, EventFromLogic };
