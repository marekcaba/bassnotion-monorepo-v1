// Legacy widget exports - DEPRECATED
// These are kept temporarily for test pages but will be removed soon
// Please use V2 widgets for all new code
// NOTE: These are commented out as they depend on deleted hooks
// export { MetronomeWidget } from './MetronomeWidget';
// export { DrummerWidget } from './DrummerWidget';
// export { BassLineWidget } from './BassLineWidget';
// export { HarmonyWidget } from './HarmonyWidget';
// export { HarmonyWidgetOptimized } from './HarmonyWidgetOptimized';

// New V2 widgets using Track System and WAM plugins
export { MetronomeWidgetV2 } from './MetronomeWidgetV2';
export { DrummerWidgetV2 } from './DrummerWidgetV2';
export { BassLineWidgetV2 } from './BassLineWidgetV2';
export { HarmonyWidgetV2 } from './HarmonyWidgetV2';
export { FourWidgetsCard } from './FourWidgetsCard';
export { PlaybackControls } from './PlaybackControls';
export { VolumeKnob } from './VolumeKnob';
export { TempoKnob } from './TempoKnob';
// GlobalControls depends on deleted useWidgetSync hook - needs migration
// export { GlobalControls } from './GlobalControls';
// GlobalControlsCard imports GlobalControls
// export { GlobalControlsCard } from './GlobalControlsCard';
export { LoopGridStrip } from './LoopGridStrip';
export { TransportClock } from './TransportClock';
export { TimingDebugWindow } from './TimingDebugWindow';
export type { LoopRegion } from './LoopGridStrip';
