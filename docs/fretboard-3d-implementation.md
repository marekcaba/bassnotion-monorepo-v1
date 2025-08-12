# Fretboard 3D - Generation 2 Implementation

## Overview

This document outlines the implementation of a fully 3D fretboard component for the **widgets domain** that builds upon the existing 3D fretboard infrastructure in the **playback domain**. Instead of starting from scratch, we'll leverage and extend the existing components to create an interactive 3D fretboard with connection logic for the YouTube widget.

## Existing 3D Infrastructure Analysis

### Current Playback Domain Components

✅ **Already Available:**

```
apps/frontend/src/domains/playback/components/FretboardVisualizer/
├── FretboardVisualizer.tsx       # Main wrapper component
├── components/
│   ├── Fretboard3D.tsx          # Basic 3D fretboard with dots
│   ├── NoteRenderer.tsx         # Note visualization system
│   └── TechniqueRenderer.tsx    # Technique rendering system
├── hooks/
│   ├── useFretboardState.ts     # State management
│   └── useThreeJSOptimization.ts # Performance optimization
└── types/
    └── fretboard.ts             # Comprehensive type definitions
```

### Current Capabilities

- ✅ **3D Dot Rendering**: Cylinders/circles for frets, squares for open strings
- ✅ **Camera System**: Three.js camera with perspective controls
- ✅ **Performance Optimization**: FPS monitoring and optimization hooks
- ✅ **Type Safety**: Comprehensive TypeScript interfaces
- ✅ **Note Visualization**: ExerciseNote rendering system
- ✅ **Technique Support**: Modular technique rendering (hammer-ons, slides, etc.)

### Missing for Widgets Domain

- ❌ **Interactive Selection**: Click to select dots
- ❌ **Connection Logic**: Highlighting connections between selected dots
- ❌ **Drag & Drop**: Moving selected dots
- ❌ **Connection Lines**: 3D lines showing relationships
- ❌ **Widget-Specific State**: Selection order, connection patterns

## Revised Implementation Strategy

### Approach: Extend, Don't Rebuild

Instead of creating a completely new 3D system, we'll:

1. **Extend Existing Components**: Build upon `Fretboard3D.tsx`
2. **Add Widget Features**: Interactive selection, connections, drag & drop
3. **Reuse Infrastructure**: Leverage existing hooks, types, and optimizations
4. **Create Widget Variant**: `FretboardWidget3D.tsx` in widgets domain

### Component Architecture

```
apps/frontend/src/domains/widgets/components/FretboardWidget3D/
├── FretboardWidget3D.tsx        # Main interactive 3D fretboard
├── components/
│   ├── InteractiveDot3D.tsx    # Clickable/draggable dots (extends playback)
│   ├── Connection3D.tsx        # 3D connection lines
│   ├── SelectionOverlay3D.tsx  # Selection UI in 3D space
│   └── ConnectionGrid3D.tsx    # Grid system for connections
├── hooks/
│   ├── useWidgetSelection.ts   # Selection state management
│   ├── useConnectionLogic.ts   # Connection detection (port from 2D)
│   ├── use3DInteraction.ts     # 3D click/drag handling
│   └── useConnectionLines.ts   # 3D line rendering
└── types/
    └── widget-fretboard.ts     # Widget-specific types
```
