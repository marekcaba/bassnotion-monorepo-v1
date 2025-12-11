# Tutorials & Exercises API Endpoints

## Overview

This document describes the API endpoints required for the Admin Tutorial & Exercise Creation System (Story 4.2).

## Base URL

All endpoints are prefixed with `/api/v1`

## Authentication

All write operations require admin authentication via Bearer token in the Authorization header.

## Tutorials Endpoints

### GET /api/v1/tutorials

Fetch all tutorials with optional pagination.

**Query Parameters:**

- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)

**Response:**

```json
{
  "items": [Tutorial],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

### GET /api/v1/tutorials/:id

Fetch a single tutorial by ID.

**Response:**

```json
{
  "id": "uuid",
  "title": "Tutorial Title",
  "slug": "tutorial-title",
  "description": "Description",
  "youtube_id": "videoId",
  "duration": 300,
  "author_name": "Author",
  "thumbnail_url": "url",
  "level": "beginner",
  "tags": ["tag1", "tag2"],
  "is_active": true,
  "published_at": "2024-01-01T00:00:00Z",
  "view_count": 100,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### GET /api/v1/tutorials/slug/:slug

Fetch a tutorial by its slug.

**Response:** Same as GET /tutorials/:id

### POST /api/v1/tutorials

Create a new tutorial.

**Request Body:**

```json
{
  "title": "Tutorial Title",
  "description": "Description",
  "youtube_id": "videoId",
  "duration": 300,
  "author_name": "Author",
  "level": "beginner",
  "tags": ["tag1", "tag2"]
}
```

**Response:** Created tutorial object

### PUT /api/v1/tutorials/:id

Update an existing tutorial.

**Request Body:** Same as POST

**Response:** Updated tutorial object

### DELETE /api/v1/tutorials/:id

Delete a tutorial.

**Response:** 204 No Content

### GET /api/v1/tutorials/published

Fetch only published tutorials.

**Query Parameters:** Same as GET /tutorials

**Response:** Paginated list of published tutorials

### GET /api/v1/tutorials/:id/related

Fetch related tutorials.

**Query Parameters:**

- `limit` (number): Maximum number of results (default: 5)

**Response:** Array of related tutorials

## Exercises Endpoints

### GET /api/v1/exercises

Fetch all exercises with optional pagination.

**Query Parameters:**

- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)

**Response:**

```json
{
  "items": [Exercise],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

### GET /api/v1/exercises/:id

Fetch a single exercise by ID.

**Response:**

```json
{
  "id": "uuid",
  "tutorial_id": "uuid",
  "title": "Exercise Title",
  "description": "Description",
  "bpm": 120,
  "duration": 60,
  "duration_measures": 4,
  "duration_beats": 0,
  "time_signature": { "numerator": 4, "denominator": 4 },
  "difficulty": "beginner",
  "key": "C",
  "notes": [],
  "tags": ["tag1"],
  "order_index": 1,
  "is_active": true,
  "has_metronome_midi": false,
  "has_drums_midi": false,
  "has_bass_midi": false,
  "has_harmony_midi": false,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### GET /api/v1/exercises/tutorial/:tutorialId

Fetch all exercises for a specific tutorial.

**Response:** Array of exercises

### POST /api/v1/exercises

Create a new exercise.

**Request Body:**

```json
{
  "tutorial_id": "uuid",
  "title": "Exercise Title",
  "description": "Description",
  "bpm": 120,
  "duration": 60,
  "duration_measures": 4,
  "duration_beats": 0,
  "time_signature": { "numerator": 4, "denominator": 4 },
  "difficulty": "beginner",
  "key": "C",
  "tags": ["tag1"],
  "order_index": 1
}
```

**Response:** Created exercise object

### PUT /api/v1/exercises/:id

Update an existing exercise.

**Request Body:** Same as POST (without tutorial_id)

**Response:** Updated exercise object

### DELETE /api/v1/exercises/:id

Delete an exercise.

**Response:** 204 No Content

### PATCH /api/v1/exercises/:id/midi-status

Update MIDI file status for an exercise.

**Request Body:**

```json
{
  "has_metronome_midi": true,
  "has_drums_midi": false,
  "has_bass_midi": true,
  "has_harmony_midi": false
}
```

**Response:** Updated exercise object

## Storage Endpoints

### POST /api/v1/storage/exercise-files/upload

Upload a MIDI file for an exercise (handled via Supabase Storage directly).

**Request:** Multipart form data with file

**Response:**

```json
{
  "url": "https://storage.url/path/to/file.mid",
  "path": "midi/exercise-id/track.mid"
}
```

## Batch Operations

### POST /api/v1/tutorials/batch

Fetch multiple tutorials by IDs.

**Request Body:**

```json
{
  "ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:** Array of tutorials

### POST /api/v1/exercises/batch

Fetch multiple exercises by IDs.

**Request Body:**

```json
{
  "ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:** Array of exercises

## Search Endpoints

### GET /api/v1/tutorials/search

Search tutorials.

**Query Parameters:**

- `q` (string): Search query
- `level` (string): Filter by difficulty level
- `tags` (string): Comma-separated tags
- `active` (boolean): Filter by active status
- `published` (boolean): Filter by published status
- `author` (string): Filter by author name
- `durationMin` (number): Minimum duration in seconds
- `durationMax` (number): Maximum duration in seconds

**Response:** Array of matching tutorials

### GET /api/v1/exercises/search

Search exercises.

**Query Parameters:**

- `q` (string): Search query
- `difficulty` (string): Filter by difficulty
- `tags` (string): Comma-separated tags
- `active` (boolean): Filter by active status
- `bpmMin` (number): Minimum BPM
- `bpmMax` (number): Maximum BPM

**Response:** Array of matching exercises

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

**Common Error Codes:**

- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: User lacks required permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid input data
- `INTERNAL_ERROR`: Server error

## Implementation Notes

1. All endpoints should validate admin role for write operations
2. Use database transactions for operations affecting multiple tables
3. Implement proper error handling and logging
4. Use correlation IDs for request tracing
5. Validate MIDI file uploads before storing
6. Ensure cascade deletion for exercises when tutorial is deleted
7. Update view counts asynchronously to avoid blocking requests
