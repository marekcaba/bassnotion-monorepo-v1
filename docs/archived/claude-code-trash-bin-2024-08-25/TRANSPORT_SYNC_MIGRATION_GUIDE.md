# Transport Sync Migration Guide - FAANG Best Practices

## Overview

This guide describes how to migrate from the current widget sync implementation (which times out after 30 seconds) to a robust, FAANG-style transport synchronization system.

## Architecture

### Current Issues

- ❌ No heartbeat mechanism - widgets timeout after 30s
- ❌ No latency compensation
- ❌ No automatic reconnection
- ❌ No performance monitoring
- ❌ No error recovery

### New Architecture

- ✅ Heartbeat-based connection monitoring
- ✅ Latency-compensated synchronization
- ✅ Automatic reconnection with exponential backoff
- ✅ Comprehensive metrics and monitoring
- ✅ Graceful degradation and error recovery

## Implementation Steps

### 1. Deploy TransportSyncManager (Backend)

```typescript
// In your transport initialization code
import { TransportSyncManager } from '@/domains/playback/services/core/TransportSyncManager';

// Initialize the sync manager
const syncManager = TransportSyncManager.getInstance();

// The manager automatically hooks into Tone.Transport
```

### 2. Update Widgets to Use New Hook

Replace the current `useWidgetSync` with `useTransportSync`:

```typescript
// Old implementation
const { isPlaying, position } = useWidgetSync({
  widgetId: 'drummer-widget',
  onPlay: () => startDrumLoop(),
  onStop: () => stopDrumLoop(),
});

// New implementation
const {
  isConnected,
  isPlaying,
  position,
  tempo,
  latency,
  forceSync,
  getPerformanceMetrics,
} = useTransportSync({
  widgetId: 'drummer-widget',
  onPlay: (time) => startDrumLoop(time),
  onStop: (time) => stopDrumLoop(time),
  onPositionUpdate: (pos) => updatePosition(pos),
  enableLatencyCompensation: true,
});
```

### 3. Add Monitoring (Optional but Recommended)

Add the transport sync monitor to your layout:

```tsx
import { TransportSyncMonitor } from '@/domains/playback/components/TransportSyncMonitor';

// In your layout or debug panel
{
  process.env.NODE_ENV === 'development' && <TransportSyncMonitor />;
}
```

### 4. Update Widget Implementation

Example for DrummerWidget:

```typescript
export function DrummerWidget({ pattern }: DrummerWidgetProps) {
  const drumLoop = useRef<Tone.Loop | null>(null);

  const {
    isConnected,
    isPlaying,
    tempo,
    forceSync
  } = useTransportSync({
    widgetId: 'drummer-widget',
    onPlay: (time) => {
      // Start with latency compensation
      if (drumLoop.current) {
        drumLoop.current.start(time || '+0.1');
      }
    },
    onStop: () => {
      if (drumLoop.current) {
        drumLoop.current.stop();
      }
    },
    onTempoChange: (newTempo) => {
      // Tempo is automatically synced
      console.log('Tempo changed to:', newTempo);
    }
  });

  // Show connection status
  if (!isConnected) {
    return <div>Connecting...</div>;
  }

  // Rest of widget implementation
}
```

## Performance Optimizations

### 1. Event Batching

The system automatically batches rapid updates:

```typescript
// Multiple position updates within 16ms are batched
// This reduces React re-renders and improves performance
```

### 2. Throttling

Position updates are throttled to 60fps by default:

```typescript
// Configure throttling
TransportSyncManager.getInstance().updateConfig({
  throttleMs: 33, // 30fps for lower-end devices
});
```

### 3. Latency Compensation

Enable for tighter synchronization:

```typescript
useTransportSync({
  widgetId: 'my-widget',
  enableLatencyCompensation: true, // Enabled by default
  // ...
});
```

## Monitoring and Debugging

### Check Sync Health

```typescript
const { getPerformanceMetrics } = useTransportSync({ ... });

// In a useEffect or event handler
const metrics = getPerformanceMetrics();
console.log('Sync metrics:', {
  avgLatency: metrics.avgLatency,
  missedUpdates: metrics.missedUpdates,
  reconnections: metrics.reconnections
});
```

### Force Reconnection

```typescript
const { forceSync, isReconnecting } = useTransportSync({ ... });

// If sync is lost
if (!isConnected && !isReconnecting) {
  forceSync(); // Force reconnection
}
```

## Configuration Options

### Global Configuration

```typescript
// Configure the sync manager globally
TransportSyncManager.getInstance().updateConfig({
  heartbeatInterval: 1000, // 1 second heartbeats
  syncInterval: 50, // 50ms position updates
  reconnectDelay: 1000, // 1 second before reconnect
  maxReconnectAttempts: 5, // Max reconnection attempts
  batchSize: 10, // Event batch size
  throttleMs: 16, // ~60fps throttling
});
```

### Per-Widget Configuration

```typescript
useTransportSync({
  widgetId: 'my-widget',
  reconnectAttempts: 10, // Override global setting
  enableLatencyCompensation: false, // Disable for this widget
  // ...
});
```

## Error Handling

The system provides automatic error recovery:

1. **Missed Heartbeats**: Automatic reconnection attempt
2. **Network Issues**: Exponential backoff retry
3. **Client Errors**: Isolated per widget
4. **Transport Errors**: Graceful degradation

## Testing

### Unit Tests

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useTransportSync } from '@/domains/widgets/hooks/useTransportSync';

test('widget syncs with transport', async () => {
  const { result } = renderHook(() =>
    useTransportSync({
      widgetId: 'test-widget',
      onPlay: vi.fn(),
    }),
  );

  expect(result.current.isConnected).toBe(true);
  // ... more tests
});
```

### Integration Tests

Use the provided integration tests to verify the system:

```bash
pnpm test TransportSyncManager.test.ts
pnpm test TransportWidgetEventFlow.integration.test.ts
```

## Migration Checklist

- [ ] Deploy `TransportSyncManager` to your codebase
- [ ] Update all widgets to use `useTransportSync`
- [ ] Add monitoring dashboard (for development)
- [ ] Test with multiple widgets simultaneously
- [ ] Monitor performance metrics
- [ ] Configure based on your needs
- [ ] Remove old `useWidgetSync` implementation

## Benefits

1. **Reliability**: No more 30-second timeouts
2. **Performance**: Optimized event handling and batching
3. **Observability**: Real-time metrics and monitoring
4. **Scalability**: Handles hundreds of widgets
5. **Maintainability**: Clean, testable architecture

## Support

For issues or questions:

1. Check the monitoring dashboard for sync health
2. Review performance metrics
3. Enable debug logging: `localStorage.setItem('DEBUG_TRANSPORT_SYNC', 'true')`
4. Check the integration tests for examples
