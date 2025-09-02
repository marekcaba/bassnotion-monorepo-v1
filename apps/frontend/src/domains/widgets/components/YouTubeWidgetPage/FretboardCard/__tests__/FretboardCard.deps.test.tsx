import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';

// Test to analyze the actual FretboardCard component for dependency issues
describe('FretboardCard Dependency Analysis', () => {
  it('should identify problematic useCallback dependencies', async () => {
    // Read the actual FretboardCard file
    const fs = await import('fs');
    const path = await import('path');

    const filePath = path.join(
      process.cwd(),
      'apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/FretboardCard.tsx',
    );

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Find all useCallback instances
      const useCallbackRegex =
        /useCallback\s*\(\s*(?:async\s*)?\([^)]*\)\s*=>\s*{[\s\S]*?\},\s*\[([\s\S]*?)\]\)/g;
      const matches = [...fileContent.matchAll(useCallbackRegex)];

      console.log(`Found ${matches.length} useCallback instances`);

      // Check each for problematic dependencies
      matches.forEach((match, index) => {
        const deps = match[1];
        console.log(`\nCallback ${index + 1} dependencies:`, deps);

        // Check for syncProps.sync.actions
        if (deps.includes('syncProps.sync.actions')) {
          console.error(
            `❌ PROBLEM FOUND: Callback ${index + 1} includes syncProps.sync.actions in dependencies!`,
          );
          console.error('This will cause infinite re-renders!');

          // Find the line number
          const linesBefore = fileContent
            .substring(0, match.index)
            .split('\n').length;
          console.error(`Location: Around line ${linesBefore}`);
        }

        // Check for other potential issues
        if (
          deps.includes('syncProps.sync') &&
          !deps.includes('syncProps.sync.')
        ) {
          console.warn(
            `⚠️ Warning: Callback ${index + 1} includes entire syncProps.sync object`,
          );
        }
      });

      // Find all useEffect instances
      const useEffectRegex =
        /useEffect\s*\(\s*(?:async\s*)?\(\)\s*=>\s*{[\s\S]*?\},\s*\[([\s\S]*?)\]\)/g;
      const effectMatches = [...fileContent.matchAll(useEffectRegex)];

      console.log(`\n\nFound ${effectMatches.length} useEffect instances`);

      effectMatches.forEach((match, index) => {
        const deps = match[1];
        console.log(`\nEffect ${index + 1} dependencies:`, deps);

        // Check for state setters
        if (deps.match(/set[A-Z]\w*/)) {
          console.warn(
            `⚠️ Warning: Effect ${index + 1} might include state setters in dependencies`,
          );
        }
      });
    } catch (error) {
      console.error('Failed to read FretboardCard.tsx:', error);
    }
  });

  it('should test the actual handleExerciseSelect callback', () => {
    // Simulate the problematic callback
    const mockSyncProps = {
      sync: {
        actions: {
          emitEvent: () => console.log('Event emitted'),
        },
      },
      selectedExercise: { id: '1' },
    };

    let callbackVersion = 0;

    // Simulate React re-rendering
    const simulateRender = () => {
      // syncProps.sync.actions gets recreated each render
      mockSyncProps.sync.actions = {
        emitEvent: () =>
          console.log('Event emitted - version ' + callbackVersion),
      };

      // This simulates the problematic callback
      const handleExerciseSelect = React.useCallback(() => {
        console.log('Callback created version:', ++callbackVersion);
      }, [mockSyncProps.sync.actions]); // PROBLEM: This dependency changes every render!

      return handleExerciseSelect;
    };

    // Test multiple renders
    const callbacks = [];
    for (let i = 0; i < 5; i++) {
      callbacks.push(simulateRender());
    }

    // Check if callbacks are different (they should be the same ideally)
    const allSame = callbacks.every((cb) => cb === callbacks[0]);

    console.log('Callbacks are stable?', allSame);
    console.log('Total callback versions created:', callbackVersion);

    expect(allSame).toBe(false); // This demonstrates the problem
    expect(callbackVersion).toBe(5); // New callback each render
  });

  it('should demonstrate the fix using ref', () => {
    const mockSyncProps = {
      sync: {
        actions: {
          emitEvent: () => console.log('Event emitted'),
        },
      },
      selectedExercise: { id: '1' },
    };

    let callbackVersion = 0;
    const syncActionsRef = { current: mockSyncProps.sync.actions };

    // Simulate React re-rendering with fix
    const simulateRenderFixed = () => {
      // Update ref without triggering callback recreation
      syncActionsRef.current = mockSyncProps.sync.actions;

      // Fixed callback using ref
      const handleExerciseSelect = React.useCallback(() => {
        console.log('Fixed callback created version:', ++callbackVersion);
        // Access via ref
        if (syncActionsRef.current?.emitEvent) {
          syncActionsRef.current.emitEvent();
        }
      }, []); // No problematic dependencies!

      return handleExerciseSelect;
    };

    // Test multiple renders
    const callbacks = [];
    for (let i = 0; i < 5; i++) {
      callbacks.push(simulateRenderFixed());
    }

    // Check if callbacks are the same (they should be with the fix)
    const allSame = callbacks.every((cb) => cb === callbacks[0]);

    console.log('Fixed callbacks are stable?', allSame);
    console.log('Total callback versions created:', callbackVersion);

    expect(allSame).toBe(true); // Fixed!
    expect(callbackVersion).toBe(1); // Only one callback created
  });
});
