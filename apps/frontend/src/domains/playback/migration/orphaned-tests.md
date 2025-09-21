# Orphaned Test Files

These test files reference components that no longer exist or have been moved/refactored.

## Tests for Removed Components

### 1. SyncProcessor.behavior.test.ts
- **Original Component**: `SyncProcessor`
- **Status**: Component removed/not found
- **Action**: Delete test file or update to test new sync functionality in transport modules

### 2. N8nAssetPipelineProcessor.behavior.test.ts
- **Original Component**: `N8nAssetPipelineProcessor`
- **Status**: Component removed/not found
- **Action**: Delete test file

### 3. PerformanceTunerOptimizer.behavior.test.ts
- **Original Component**: `PerformanceTunerOptimizer`
- **Status**: Component removed/not found
- **Action**: Check if functionality moved to `modules/optimization/PerformanceOptimizer.ts`

### 4. TrackManagerProcessor.behavior.test.ts
- **Original Component**: `TrackManagerProcessor`
- **Status**: Component removed/not found
- **Action**: Check if functionality moved to `modules/tracks/core/TrackManager.ts`

### 5. AnalyticsEngine.test.ts
- **Original Component**: `AnalyticsEngine`
- **Status**: Component removed/not found
- **Action**: Check if functionality moved to monitoring or analytics modules

### 6. N8nPayloadProcessor.behavior.test.ts
- **Original Component**: `N8nPayloadProcessor`
- **Status**: Component removed/not found
- **Action**: Delete test file

## Tests That Need Path Updates

These tests have been updated but may still have issues:

### Fixed Imports
- MetronomeInstrumentProcessor tests - ✅ Updated
- MidiParserProcessor tests - ✅ Updated
- GlobalSampleCache tests - ✅ Updated
- AudioEngine tests - ✅ Updated
- SupabaseAssetClient tests - ✅ Updated to use facade
- MusicalContextAnalyzer tests - ✅ Updated
- InstrumentLifecycleManager tests - ✅ Updated
- InstrumentAssetOptimizer tests - ✅ Updated

## Recommendations

1. **Delete orphaned tests** for components that were intentionally removed
2. **Update tests** for components that were moved or refactored
3. **Create new tests** for new modular components if test coverage is missing
4. **Run test suite** after cleanup to ensure all remaining tests pass