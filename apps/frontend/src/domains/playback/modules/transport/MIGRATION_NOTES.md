# Transport Module Migration Notes

## Current State

- UnifiedTransport is a 3,107-line God Object
- Used as a singleton throughout the codebase
- Tightly integrated with CoreServices
- Has many direct dependencies

## Migration Strategy

### Phase 1: Preparation (Current)

✅ Extract core components (Clock, Timeline, Scheduler)
✅ Create new Transport coordinator
✅ Verify components work with integration tests

### Phase 2: Delegation (Next)

- Create a delegate mode in UnifiedTransport
- UnifiedTransport will forward calls to new Transport module
- Maintain backward compatibility
- Add feature flag for gradual rollout

### Phase 3: Migration

- Update all imports to use new Transport module
- Remove delegation code from UnifiedTransport
- Keep UnifiedTransport as thin wrapper for compatibility

### Phase 4: Deprecation

- Mark UnifiedTransport as deprecated
- Update all consumers
- Remove UnifiedTransport

## Key Integration Points

1. **CoreServices.ts**
   - Creates UnifiedTransport singleton
   - Passes EventBus and AudioEngine

2. **Hooks**
   - useTransport.ts
   - useAudio.ts
   - useCorePlaybackEngine.ts

3. **Other Services**
   - TransportSyncManager
   - MultiTrackTimingSynchronizer
   - OutputLatencyCompensation
   - PatternScheduler

## Risks

1. Breaking existing functionality
2. Timing regression
3. Event handling differences
4. State synchronization issues

## Testing Strategy

1. Run all existing UnifiedTransport tests
2. A/B testing with feature flag
3. Performance benchmarks
4. Integration tests with all consumers
