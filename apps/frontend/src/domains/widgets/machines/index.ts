/**
 * Widget Machines - XState state machines for widgets domain
 *
 * Phase 5: DevTools integration for visual debugging
 */

// Page Initialization Machine
export {
  pageInitializationMachine,
  type PageInitContext,
  type PageInitEvent,
  type PageInitInput,
  type TutorialData,
  type ExerciseData,
  type InitializationError,
  type PageInitMachine,
  type PageInitMachineState,
} from './pageInitializationMachine.js';

// React Hook
export {
  usePageInitialization,
  getLoadingProgressProps,
  useShadowInitComparison,
  type UsePageInitializationOptions,
  type UsePageInitializationReturn,
  type LoadingProgressProps,
} from './usePageInitialization.js';
