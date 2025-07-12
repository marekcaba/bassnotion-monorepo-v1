# Exercise Types Guide

This document explains the different exercise-related types in the contracts library to prevent confusion and naming conflicts.

## Exercise Type Hierarchy

### 1. ContentExercise (from `content.ts`)

**Purpose**: High-level content metadata for listings and catalogs
**Use cases**:

- Exercise library listings
- Search and filtering operations
- Content categorization
- API responses for exercise metadata

```typescript
interface ContentExercise extends Content {
  type: 'youtube' | 'midi' | 'audio';
  difficulty: 'beginner' | 'intermediate' | 'advanced'; // Note: No 'expert' level
  tempo: number;
  duration: number;
  tags: string[];
}
```

**Key characteristics**:

- Lightweight metadata only
- No musical content (notes, timing)
- Extends base Content interface
- Used for performance-optimized listings

### 2. MusicalExercise (from `exercise.ts`)

**Purpose**: Complete musical exercise data with notes and timing
**Use cases**:

- File upload processing (MusicXML, MIDI)
- Exercise creation and editing
- Musical playback and analysis
- Database storage of complete exercises

```typescript
interface MusicalExercise {
  id: string;
  title: string;
  description?: string;
  difficulty: ExerciseDifficulty; // Includes 'expert' level
  duration: number;
  bpm: number;
  key: string;
  timeSignature: TimeSignature;
  notes: ExerciseNote[]; // Contains actual musical content
  // ... additional musical properties
}
```

**Key characteristics**:

- Complete musical data
- Contains note arrays with fret positions, techniques
- Musical timing and analysis capabilities
- Used for detailed operations

## When to Use Which Type

| Operation              | Use ContentExercise | Use MusicalExercise |
| ---------------------- | ------------------- | ------------------- |
| Exercise listings      | ✅                  | ❌ (too heavy)      |
| Search/filtering       | ✅                  | ❌                  |
| File upload processing | ❌                  | ✅                  |
| Musical playback       | ❌                  | ✅                  |
| Difficulty calculation | ❌                  | ✅                  |
| Database storage       | ❌ (metadata only)  | ✅ (full data)      |

## Import Guidelines

```typescript
// For content management and listings
import { ContentExercise } from '@bassnotion/contracts';

// For musical operations and file processing
import { MusicalExercise } from '@bassnotion/contracts';
```

## Anti-Patterns to Avoid

❌ **Don't** use MusicalExercise for simple listings (performance impact)
❌ **Don't** use ContentExercise for musical operations (missing data)
❌ **Don't** import both types in the same file unless absolutely necessary
❌ **Don't** create new "Exercise" interfaces - use these established types

## Migration Notes

If you see `DatabaseExercise` in legacy code, it should be replaced with `MusicalExercise`.
