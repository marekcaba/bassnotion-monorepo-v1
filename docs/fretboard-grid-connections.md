# Fretboard Grid System & Connection Types

## Overview

The Fretboard Card component features a comprehensive grid system that visualizes connections between bass guitar positions. The grid consists of **static white lines** that serve as visual guides, with **thick green highlighted lines** appearing only when dots are actually connected, providing immediate visual feedback for bass playing patterns.

## Grid Structure

### Basic Layout
- **Strings**: 4-string (G, D, A, E) or 5-string (G, D, A, E, B) bass configurations
- **Frets**: 12 frets plus open strings
- **Spacing**: 42px between strings vertically, 38px between frets horizontally
- **Dot Size**: 26px diameter circles for frets, 26px squares for open strings

### Visual Elements
- **Static White Grid Lines**: Thin white lines (1px) with 10-20% opacity - purely visual guides
- **Highlighted Connections**: Thick green lines (2px) at 100% opacity with rounded corners - only when connected
- **3D Perspective**: Adjustable tilt (unlimited range) with 35° default for realistic viewing angle
- **Counter-rotation**: Dots use counter-rotation to maintain proper mouse events with 3D tilt

## White Grid System Principle

### Static Visual Guide Philosophy
The white grid lines follow a **strict static principle**:
- **Purpose**: Visual guides to show potential connection paths
- **Behavior**: Never change based on connection logic
- **Appearance**: Always the same thin white lines with low opacity
- **Interaction**: `pointer-events-none` - completely non-interactive

### Highlighted Connection System
Green highlighted lines follow a **dynamic highlighting principle**:
- **Purpose**: Show actual connections between selected dots
- **Behavior**: Only appear when dots are actually connected
- **Appearance**: Thick green lines (2px) with 100% opacity and rounded corners
- **Layer**: Higher z-index (15) above static grid (1) but below dots (20)

### Implementation Rule
**CRITICAL**: All diagonal connection types must follow this pattern:
```tsx
// ✅ CORRECT - Only show when highlighted
{condition && isHighlighted && (
  <div className="bg-green-500 opacity-100" />
)}

// ❌ WRONG - Shows white grid that changes
{condition && (
  <div className={isHighlighted ? 'bg-green-500' : 'bg-white'} />
)}
```

## Connection Types

Based on the `areDotsConnected()` function, the following 11 connection patterns are supported:

### 1. Horizontal Connections (Same String)
**Pattern**: Any two positions on the same string
- **Condition**: `pos1.stringIndex === pos2.stringIndex`
- **Visual**: Horizontal line segments connecting selected dots
- **Musical Use**: Scales, chromatic runs, string-specific patterns
- **Examples**:
  - G string 2nd fret to G string 5th fret
  - Open G to G string 7th fret
  - E open to E string 12th fret

### 2. Vertical Connections (Same Fret)
**Pattern**: Any two positions on the same fret
- **Condition**: `fret1 === fret2` (open strings treated as fret 0)
- **Visual**: Vertical line segments connecting selected dots
- **Musical Use**: Chord positions, octave patterns
- **Examples**:
  - All strings at 3rd fret
  - All open strings (G, D, A, E for 4-string)
  - Mixed: G open to D string 0th fret (same as open)

### 3. Adjacent Diagonal Connections (1 String, 1 Fret)
**Pattern**: 1 string difference, 1 fret difference
- **Condition**: `stringDiff === 1 && fretDiff === 1`
- **Visual**: Short diagonal lines in all four directions
- **Musical Use**: Basic fingering patterns, chord transitions
- **Examples**:
  - G string 2nd fret to D string 3rd fret
  - G open to D string 1st fret
  - D string 5th fret to A string 4th fret

### 4. Long Diagonal Connections (1 String, 2 Frets)
**Pattern**: 1 string difference, 2 fret difference
- **Condition**: `stringDiff === 1 && fretDiff === 2`
- **Visual**: Medium diagonal lines with precise angle calculations
- **Musical Use**: Extended fingering patterns, arpeggios
- **Examples**:
  - G string 1st fret to D string 3rd fret
  - G open to D string 2nd fret
  - D string 4th fret to A string 6th fret

### 5. Vertical Long Diagonal Connections (2 Strings, 1 Fret)
**Pattern**: 2 string difference, 1 fret difference
- **Condition**: `stringDiff === 2 && fretDiff === 1`
- **Visual**: Steep diagonal lines spanning 2 strings
- **Musical Use**: Wide interval patterns, octave shapes
- **Examples**:
  - G string 2nd fret to A string 3rd fret
  - G open to A string 1st fret
  - D string 3rd fret to E string 4th fret

### 6. Square Diagonal Connections (2 Strings, 2 Frets)
**Pattern**: 2 string difference, 2 fret difference
- **Condition**: `stringDiff === 2 && fretDiff === 2`
- **Visual**: Medium-steep diagonal lines forming square patterns
- **Musical Use**: Box patterns, pentatonic shapes
- **Examples**:
  - G string 1st fret to A string 3rd fret
  - G open to A string 2nd fret
  - D string 3rd fret to E string 5th fret

### 7. Extra Long Diagonal Connections (1 String, 3 Frets)
**Pattern**: 1 string difference, 3 fret difference
- **Condition**: `stringDiff === 1 && fretDiff === 3`
- **Visual**: Long diagonal lines with 3-fret span
- **Musical Use**: Extended scales, wide fingering patterns
- **Examples**:
  - G string 1st fret to D string 4th fret
  - G open to D string 3rd fret
  - D string 2nd fret to A string 5th fret

### 8. Three-String Diagonal Connections (3 Strings, 1 Fret)
**Pattern**: 3 string difference, 1 fret difference
- **Condition**: `stringDiff === 3 && fretDiff === 1`
- **Visual**: Very steep diagonal lines spanning 3 strings
- **Musical Use**: Wide chord voicings, bass-to-treble patterns
- **Examples**:
  - G string 2nd fret to E string 3rd fret (4-string)
  - G open to E string 1st fret (4-string)
  - D string 3rd fret to B string 4th fret (5-string)

### 9. Three-by-Three Diagonal Connections (3 Strings, 3 Frets)
**Pattern**: 3 string difference, 3 fret difference
- **Condition**: `stringDiff === 3 && fretDiff === 3`
- **Visual**: Long diagonal lines across fretboard
- **Musical Use**: Wide interval patterns, extended chord voicings
- **Recent Fix**: Fixed `fretIndex >= 2` condition to allow connections from 3rd fret to open strings
- **Examples**:
  - G string 1st fret to E string 4th fret (4-string)
  - G open to E string 3rd fret (4-string)
  - D string 2nd fret to B string 5th fret (5-string)

### 10. Three-by-Two Diagonal Connections (3 Strings, 2 Frets)
**Pattern**: 3 string difference, 2 fret difference
- **Condition**: `stringDiff === 3 && fretDiff === 2`
- **Visual**: Cross-fretboard diagonal lines
- **Musical Use**: Wide interval patterns, advanced fingering techniques
- **Examples**:
  - G string 3rd fret to E string 5th fret (4-string)
  - G open to E string 2nd fret (4-string)
  - D string 1st fret to B string 3rd fret (5-string)

### 11. Four-by-Two Diagonal Connections (2 Strings, 4 Frets)
**Pattern**: 2 string difference, 4 fret difference
- **Condition**: `stringDiff === 2 && fretDiff === 4`
- **Visual**: Long diagonal lines spanning 2 strings and 4 frets
- **Musical Use**: Extended scale patterns, wide interval jumps, advanced fingering techniques
- **Distance**: √((42×2)² + (38×4)²) ≈ 173.6px
- **Examples**:
  - G string 1st fret to A string 5th fret
  - G open to A string 4th fret
  - D string 2nd fret to E string 6th fret
  - D string 3rd fret to E string 7th fret

## Grid Line Rendering System

### Horizontal Lines
- **Default**: Full-width thin white lines on each string
- **Highlighted**: Green segments only between connected selected dots
- **Segmentation**: Uses `getHorizontalSegments()` for precise positioning
- **Z-Index**: 1 (default), 15 (highlighted), 20 (dots on top)

### Vertical Lines
- **Default**: Full-height thin white lines at each fret position
- **Highlighted**: Green segments only between connected selected dots
- **Segmentation**: Uses `getVerticalSegments()` for precise positioning
- **Open String Support**: Fret 0 represents open strings in calculations

### Diagonal Lines
- **Mathematical Precision**: Uses Pythagorean theorem for distances
- **Angle Calculation**: `Math.atan2(vertical, horizontal) * (180 / Math.PI)`
- **Directional Rendering**: All four directions (up-right, up-left, down-right, down-left)
- **Conditional Rendering**: Lines only appear when valid connections exist

#### Diagonal Line Types Implemented:

1. **Basic Diagonal Lines** (1 string, 1 fret)
   - From both open strings and fret positions
   - All four directions supported

2. **Long Diagonal Lines** (1 string, 2 frets)
   - Separate functions for each direction
   - Open string variants included

3. **Vertical Long Diagonal Lines** (2 strings, 1 fret)
   - Complex directional logic for proper rendering
   - Handles both up and down directions

4. **Square Diagonal Lines** (2 strings, 2 frets)
   - Up and down diagonal functions
   - Proper positioning from both open strings and frets

5. **Extra Long Diagonal Lines** (1 string, 3 frets)
   - Four-directional support
   - Special handling for open string connections

6. **Three-String Diagonal Lines** (3 strings, 1 fret)
   - Steep diagonal lines for wide intervals
   - Conditional rendering based on string count

7. **Three-by-Three Diagonal Lines** (3 strings, 3 frets)
   - **Recent Fix**: Changed condition from `fretIndex >= 3` to `fretIndex >= 2`
   - **Bidirectional Support**: Both up-left and down-left directions fixed
   - Cross-fretboard connections now work properly

8. **Three-by-Two Diagonal Lines** (3 strings, 2 frets)
   - Uses `shouldHighlightBasicCrossFretboardDiagonalAnyFret()`
   - Forward and backward direction support

9. **Four-by-Two Diagonal Lines** (2 strings, 4 frets)
   - Uses `shouldHighlight4x2Diagonal()` helper function
   - Four-directional support (down-right, down-left, up-right, up-left)
   - Bidirectional logic with open string handling
   - Distance calculation: √((42×2)² + (38×4)²) ≈ 173.6px

## Connection Detection Algorithm

### Core Function: `areDotsConnected()`
```typescript
// Checks if two positions are connected by any valid pattern
// Returns true for any of the 11 connection types
// Open strings are treated as fret 0 for calculations
// Uses absolute differences for bidirectional support
```

### Selection and Highlighting System
1. **Selection Tracking**: `Map<string, number>` stores selected dots with order
2. **Connection Analysis**: `getAllConnections()` finds consecutive valid connections
3. **Visual Feedback**: Highlights grid lines between connected dots
4. **Multi-Connection**: Supports multiple simultaneous connections
5. **Order-Based**: Only connects consecutive selections in order

### Recent Fixes Applied
1. **Three-by-Three Diagonal Issue**: Fixed `fretIndex >= 3` to `fretIndex >= 2`
2. **Bidirectional Support**: Added both up-left and down-left Three-by-Three diagonals
3. **Open String Integration**: All diagonal patterns work from/to open strings

## Interactive Features

### Selection System
- **Click to Select**: Dots turn green and show order numbers (1, 2, 3...)
- **Toggle Selection**: Click again to deselect and auto-reorder remaining
- **Visual Feedback**: Selected dots show numbers, unselected show string names (open) or empty (frets)
- **Reset Function**: Clear all selections and reset order counter

### Drag and Drop System
- **Drag Selected Only**: Only selected dots are draggable
- **Visual Feedback**: Semi-transparent during drag with counter-rotation
- **Drop Zones**: Any valid fretboard position
- **Drag Indicators**: Visual feedback for drag over/enter/leave states

### Tilt Controls
- **Manual Adjustment**: Up/down arrows for 5° increments
- **Default View**: 35° dramatic perspective
- **Flat View**: 0° top-down view
- **Unlimited Range**: No tilt angle restrictions
- **Tooltips**: Show current angle in button tooltips

### String Configuration
- **4-String Bass**: G, D, A, E (default)
- **5-String Bass**: G, D, A, E, B
- **Dynamic Rendering**: All grid lines adapt to string count
- **Button Picker**: Toggle between 4 and 5 strings

## Technical Implementation

### Grid Calculations
- **String Spacing**: 42px vertical intervals
- **Fret Spacing**: 38px horizontal intervals (26px dot + 12px gap)
- **Diagonal Distances**: `√(vertical² + horizontal²)`
- **Rotation Angles**: `Math.atan2(vertical, horizontal) * (180 / Math.PI)`

### Performance Optimizations
- **Conditional Rendering**: Lines only render when connections exist
- **Z-Index Layering**: Proper stacking order (1: default, 15: highlighted, 20: dots)
- **Hover Fix**: Counter-rotation technique for 3D perspective mouse events
- **Segment Highlighting**: Only highlight line segments between connected dots

### Connection Validation
- **Pattern Matching**: Each connection type has specific mathematical criteria
- **Distance Calculation**: Precise relationships using absolute differences
- **Bidirectional Support**: All connections work in both directions
- **Open String Handling**: Open strings converted to fret 0 for calculations

## Recent Bug Fixes

### Static White Grid Line System (Latest)
**Problem**: Multiple diagonal connection types were showing dynamic white grid lines that appeared/disappeared based on connection logic, violating the static grid principle
**Affected Types**: 
- Square Diagonal Connections (2 strings, 2 frets) - all four directions
- Three-by-Two Diagonal Connections (3 strings, 2 frets) - forward directions
**Root Cause**: Using conditional styling `isHighlighted ? 'green' : 'white'` instead of conditional rendering
**Solution**: Changed to conditional rendering - lines only appear when actually highlighted
**Result**: White grid is now truly static, only green highlighted lines appear when connections exist

### Three-by-Two Diagonal White Grid Fix
**Problem**: Forward direction Three-by-Two diagonals showed white grid lines by default
**Solution**: Changed from conditional styling to conditional rendering:
- **Before**: Always rendered with white/green conditional styling
- **After**: Only renders when `shouldHighlightBasicCrossFretboardDiagonalAnyFret()` returns true
**Impact**: Eliminated spurious white grid lines while maintaining correct green highlighting

### Square Diagonal White Grid Fix  
**Problem**: All four directions (up-right, up-left, down-right, down-left) showed white grid lines by default
**Solution**: Applied conditional rendering pattern to all square diagonal directions
**Impact**: Consistent static white grid behavior across all square diagonal connection types

### Three-by-Three Diagonal Connection Issue
**Problem**: Connections from fret positions to open strings not highlighting in certain directions
**Root Cause**: `fretIndex >= 3` condition excluded 3rd fret connections
**Solution**: Changed to `fretIndex >= 2` for both up-left and down-left directions
**Impact**: Fixed bidirectional highlighting for G open ↔ E string 3rd fret connections

### Hover Effects with 3D Tilt
**Problem**: Mouse events not working on bottom strings with 35° tilt
**Solution**: Counter-rotation technique with `transform: 'rotateX(0deg)'` on individual dots
**Result**: Maintained dramatic 3D perspective while preserving interactivity

### White Flash on Selection
**Problem**: Brief white flash when clicking dots before numbers appeared
**Solution**: Removed `transition-colors` and used specific background transition
**Result**: Instant text color change with smooth background transition

## Musical Applications

### Practice Patterns
- **Scales**: Horizontal and diagonal connections
- **Arpeggios**: Long diagonal patterns
- **Chord Progressions**: Vertical and mixed connections
- **Fingering Exercises**: Adjacent and extended diagonal patterns

### Advanced Techniques
- **Cross-String Patterns**: Three-string diagonal connections
- **Wide Intervals**: Three-by-three patterns
- **Extended Voicings**: Cross-fretboard diagonal connections
- **Octave Patterns**: Square diagonal connections

### Visual Learning
- **Pattern Recognition**: Immediate visual feedback for connections
- **Muscle Memory**: Visual reinforcement of fingering patterns
- **Theory Application**: Connect music theory to fretboard positions
- **Order Tracking**: Numbered sequence for practice routines

## Future Enhancements

### Potential Additions
- **Color Coding**: Different colors for different connection types
- **Pattern Templates**: Pre-defined scale and chord patterns
- **Audio Feedback**: Play notes when selecting positions
- **Export Function**: Save patterns as images or data

### Advanced Features
- **Multiple Instruments**: Guitar, ukulele, mandolin support
- **Custom Tunings**: Alternative string configurations
- **Pattern Library**: Save and load custom patterns
- **Collaborative Features**: Share patterns with other users

---

*This document describes the fretboard grid system as implemented in the BassNotion FretboardCard component. The system provides comprehensive visual feedback for bass guitar playing patterns and educational purposes. Last updated to reflect the current codebase state including the new Four-by-Two diagonal connection type (MVP completion) and recent bug fixes for Three-by-Three diagonal connections.* 