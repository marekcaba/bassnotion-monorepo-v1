# Widget Synchronization System Extraction Plan

## Overview

The TransportSyncManager provides critical widget synchronization features that are NOT present in the new transport module. This needs to be carefully extracted to maintain functionality.

## Current System Analysis

### TransportSyncManager Features:

1. **Widget Registration System**
   - `registerClient(clientId)` - Register widgets for sync
   - `unregisterClient(clientId)` - Clean unregistration
   - Client tracking with connection state

2. **Heartbeat Monitoring**
   - Health checks every 1 second
   - Dead client detection (3 missed heartbeats)
   - Automatic reconnection attempts
   - Latency measurement

3. **State Broadcasting**
   - Transport state changes (play, stop, pause, seek)
   - Position updates (throttled to 60fps)
   - Tempo and time signature changes
   - Batch updates for efficiency

4. **Event System**
   - EventEmitter based
   - Client-specific events: `client:${widgetId}:EVENT_TYPE`
   - Throttling and batching for performance

5. **Integration Points**
   - Hooks into UnifiedTransport via EventBus
   - Used by useTransportSync hook
   - Used by SyncProvider component

## Extraction Strategy

### Option 1: Add to Transport Module (Recommended)

Create a new sync layer within the transport module:

```
modules/transport/
├── core/
│   ├── Transport.ts
│   ├── Clock.ts
│   ├── Timeline.ts
│   ├── Scheduler.ts
│   └── TransportWithEventBus.ts
├── sync/                          # NEW
│   ├── WidgetSyncManager.ts      # Core sync functionality
│   ├── HeartbeatMonitor.ts       # Health monitoring
│   ├── BroadcastManager.ts       # State broadcasting
│   └── types.ts                  # Sync-specific types
└── index.ts
```

### Option 2: Create Separate Sync Module

```
modules/sync/
├── core/
│   ├── SyncManager.ts
│   ├── ClientRegistry.ts
│   └── HeartbeatMonitor.ts
├── transport/
│   ├── TransportSync.ts
│   └── StatebroadCaster.ts
├── types/
└── index.ts
```

## Implementation Steps

### Phase 1: Create Core Sync Infrastructure

1. Create WidgetSyncManager class in modules/transport/sync/
2. Extract client registration logic
3. Extract heartbeat monitoring
4. Maintain EventEmitter pattern for compatibility

### Phase 2: Integrate with Transport

1. Connect to new Transport via EventBus
2. Map transport events to sync events
3. Implement throttling and batching

### Phase 3: Update Hook and Components

1. Update useTransportSync to use new location
2. Update SyncProvider component
3. Ensure backward compatibility

### Phase 4: Testing

1. Create unit tests for sync manager
2. Test widget registration/unregistration
3. Test heartbeat and reconnection
4. Test event broadcasting

## Code Migration Example

```typescript
// modules/transport/sync/WidgetSyncManager.ts
import { EventEmitter } from 'events';
import type { Transport } from '../core/Transport';
import type { EventBus } from '../../../services/core/EventBus';

export class WidgetSyncManager extends EventEmitter {
  private clients = new Map<string, SyncClient>();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(
    private transport: Transport,
    private eventBus: EventBus,
  ) {
    super();
    this.setupTransportListeners();
  }

  registerClient(clientId: string): void {
    // Existing logic preserved
  }

  // ... rest of the implementation
}
```

## Risks and Mitigations

### Risk 1: Breaking Widget Synchronization

- **Mitigation**: Maintain exact same event names and signatures
- **Mitigation**: Keep EventEmitter pattern for compatibility

### Risk 2: Performance Regression

- **Mitigation**: Preserve throttling and batching logic
- **Mitigation**: Maintain same timing constants

### Risk 3: Lost Features

- **Mitigation**: Line-by-line comparison during extraction
- **Mitigation**: Comprehensive test coverage

## Success Criteria

1. All widgets continue to sync properly
2. No performance degradation
3. Heartbeat monitoring works as before
4. Reconnection logic preserved
5. All tests pass
