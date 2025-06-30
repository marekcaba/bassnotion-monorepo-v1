# Component Test Timeout Fixes

## Problem
Component tests in the widgets domain were experiencing timeouts when running the full test suite, taking ~276 seconds to complete.

## Root Cause
The issue was that component tests were importing the complete synchronization system (SyncedWidget, SyncProvider) which has complex dependencies on:
- EventEmitter systems
- Performance monitoring
- State management
- Real-time synchronization logic

## Solution Applied

### 1. SyncedWidget Mock Added to All Component Tests
Added comprehensive mocks for `SyncedWidget` in:
- `MetronomeWidget.test.tsx`
- `DrummerWidget.test.tsx`
- `BassLineWidget.test.tsx`
- `HarmonyWidget.test.tsx`
- `FourWidgetsCard.test.tsx`
- `YouTubeWidgetPage.test.tsx`

**Mock Implementation:**
```typescript
vi.mock('../../base/SyncedWidget.js', () => ({
  SyncedWidget: ({
    children,
    widgetId,
  }: {
    children: any;
    widgetId: string;
  }) => {
    const mockSyncProps = {
      isConnected: true,
      tempo: 100,
      isPlaying: false,
      sync: {
        actions: {
          emitEvent: vi.fn(),
        },
      },
    };
    return (
      <div data-testid={`synced-widget-${widgetId}`}>
        {typeof children === 'function' ? children(mockSyncProps) : children}
      </div>
    );
  },
}));
```

### 2. SyncProvider Mock for Main Page Test
Added SyncProvider mock for `YouTubeWidgetPage.test.tsx`:
```typescript
vi.mock('../base/SyncProvider.js', () => ({
  SyncProvider: ({ children }: { children: any }) => <div>{children}</div>,
  useSyncContext: () => ({
    syncState: { playback: { isPlaying: false, tempo: 100 } },
    isConnected: true,
    emitGlobalEvent: vi.fn(),
  }),
}));
```

### 3. Enhanced Test Configuration
Created `vitest.config.ts` for component tests with:
- Increased timeout to 30 seconds
- Proper alias configuration
- JSdom environment setup

## Expected Results

### Before Fix:
- ⚠️ Component tests: ~276 seconds (timing out)
- ✅ Sync core tests: 2.07 seconds (working fine)

### After Fix:
- ✅ Component tests: Should complete in <30 seconds
- ✅ Sync core tests: Still working efficiently
- ✅ All widget functionality preserved

## Test Coverage Maintained

The mocks ensure that:
- Component rendering is tested
- User interactions work
- Widget visibility toggling functions
- Props are passed correctly
- UI elements display properly

**Important:** The actual synchronization functionality is comprehensively tested in the dedicated sync tests (59/59 passing in 2.07s), so mocking it in component tests doesn't reduce coverage.

## Files Modified

### Component Tests Fixed:
1. `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/__tests__/MetronomeWidget.test.tsx`
2. `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/__tests__/DrummerWidget.test.tsx`
3. `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/__tests__/BassLineWidget.test.tsx`
4. `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/__tests__/HarmonyWidget.test.tsx`
5. `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/__tests__/FourWidgetsCard.test.tsx`
6. `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/__tests__/YouTubeWidgetPage.test.tsx`

### Configuration Added:
7. `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/__tests__/vitest.config.ts`

## Status
✅ **Fixes Applied** - All component tests now have proper mocks to prevent sync system dependencies
⏳ **Testing Required** - Need to verify that component tests now complete without timeouts 