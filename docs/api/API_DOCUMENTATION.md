# BassNotion API Documentation

## Overview

BassNotion provides a RESTful API for managing bass guitar learning resources, exercises, tutorials, and user interactions. The API is built with NestJS and follows OpenAPI 3.0 specification.

## Base URL

- Development: `http://localhost:3000`
- Production: `https://api.bassnotion.com`

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Interactive Documentation

When running in development, interactive Swagger documentation is available at:

```
http://localhost:3000/api/docs
```

The OpenAPI specification can be downloaded from:

```
http://localhost:3000/api/openapi.json
```

## API Endpoints

### Health Check

#### Basic Health Check

```http
GET /api/health
```

Returns basic health status of the API.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-08-30T16:00:00.000Z",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 23
    },
    "api": {
      "status": "healthy"
    },
    "supabase": {
      "status": "healthy",
      "responseTime": 45
    }
  },
  "version": "1.0.0",
  "uptime": 3600
}
```

#### Detailed Health Check

```http
GET /api/health/detailed
```

Returns detailed system metrics including CPU, memory, and load.

#### Liveness Probe

```http
GET /api/health/live
```

Simple check for Kubernetes liveness probe.

#### Readiness Probe

```http
GET /api/health/ready
```

Checks if all dependencies are ready.

#### Performance Metrics

```http
GET /api/health/metrics
```

Returns performance metrics for API endpoints.

### Authentication

#### Login

```http
POST /api/v1/auth/login
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "username": "username"
  }
}
```

#### Register

```http
POST /api/v1/auth/register
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "username": "username"
}
```

#### Refresh Token

```http
POST /api/v1/auth/refresh
```

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Logout

```http
POST /api/v1/auth/logout
```

Requires authentication.

### Exercises

#### Get All Exercises

```http
GET /api/exercises?page=1&limit=10
```

Returns paginated list of exercises.

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**

```json
{
  "exercises": [
    {
      "id": "exercise-id",
      "title": "Basic Blues Scale",
      "description": "Learn the blues scale in E",
      "difficulty": "beginner",
      "duration": 300000,
      "bpm": 120,
      "key": "E",
      "notes": [],
      "is_active": true,
      "created_at": "2025-08-30T16:00:00.000Z",
      "updated_at": "2025-08-30T16:00:00.000Z"
    }
  ],
  "total": 50,
  "cached": false
}
```

#### Search Exercises

```http
GET /api/exercises/search?q=blues
```

Search exercises by title or description.

**Query Parameters:**

- `q`: Search query (required)

#### Get Exercise by ID

```http
GET /api/exercises/:id
```

Returns a specific exercise.

#### Get Exercises by Difficulty

```http
GET /api/exercises/difficulty/:level
```

**Path Parameters:**

- `level`: One of `beginner`, `intermediate`, `advanced`

#### Create Exercise (Authenticated)

```http
POST /api/exercises
```

**Request Body:**

```json
{
  "title": "New Exercise",
  "description": "Exercise description",
  "difficulty": "intermediate",
  "duration": 180000,
  "bpm": 100,
  "key": "A",
  "notes": []
}
```

#### Update Exercise (Authenticated)

```http
PUT /api/exercises/:id
```

Updates an existing exercise.

#### Upload MIDI File (Authenticated)

```http
POST /api/exercises/upload/midi
```

**Request:**

- Content-Type: `multipart/form-data`
- Field: `file` - MIDI file (.mid, .midi)
- Field: `title` - Exercise title
- Field: `description` - Exercise description
- Field: `difficulty` - One of: beginner, intermediate, advanced

**Response:**

```json
{
  "success": true,
  "exercise": {
    "id": "exercise-id",
    "title": "Uploaded Exercise",
    "bpm": 120,
    "key": "C"
  },
  "storageInfo": {
    "filePath": "exercises/midi/file.mid",
    "fileSize": 12345
  }
}
```

#### Upload MusicXML File (Authenticated)

```http
POST /api/exercises/upload/musicxml
```

Similar to MIDI upload but for MusicXML files.

### User Custom Basslines

#### Get My Basslines (Authenticated)

```http
GET /api/exercises/user/my-exercises
```

Returns user's custom basslines.

#### Save Custom Bassline (Authenticated)

```http
POST /api/exercises/user/save-bassline
```

**Request Body:**

```json
{
  "title": "My Custom Bassline",
  "notes": [...],
  "bpm": 120,
  "key": "E"
}
```

#### Update Custom Bassline (Authenticated)

```http
PUT /api/exercises/user/:basslineId
```

#### Delete Custom Bassline (Authenticated)

```http
DELETE /api/exercises/user/:basslineId
```

### Tutorials

#### Get All Tutorials

```http
GET /api/v1/tutorials
```

Returns list of all tutorials.

#### Get Tutorial by ID

```http
GET /api/v1/tutorials/:id
```

#### Get Tutorial by Slug

```http
GET /api/v1/tutorials/slug/:slug
```

### YouTube Integration

#### Get YouTube Channels

```http
GET /api/v1/youtube/channels
```

Returns list of integrated YouTube channels.

#### Process YouTube Channel (Authenticated)

```http
POST /api/v1/youtube/channels
```

**Request Body:**

```json
{
  "channelId": "UC...",
  "channelUrl": "https://youtube.com/c/..."
}
```

#### Get Channel Videos

```http
GET /api/v1/youtube/channels/:channelId/videos
```

### Content Creators

#### Get All Creators

```http
GET /api/v1/creators
```

#### Get Creator by ID

```http
GET /api/v1/creators/:id
```

#### Create Creator (Admin)

```http
POST /api/v1/creators
```

**Request Body:**

```json
{
  "name": "Creator Name",
  "bio": "Creator biography",
  "youtube_channel_id": "UC...",
  "website": "https://creator.com"
}
```

## Error Responses

The API uses standard HTTP status codes and returns errors in the following format:

```json
{
  "statusCode": 400,
  "message": "Validation error message",
  "error": "Bad Request",
  "timestamp": "2025-08-30T16:00:00.000Z",
  "path": "/api/exercises"
}
```

### Common Status Codes

- `200 OK`: Request succeeded
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Access denied
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default limit**: 100 requests per 15 minutes per IP
- **Authenticated users**: 500 requests per 15 minutes
- **File uploads**: 10 requests per hour

When rate limited, the API returns:

```json
{
  "statusCode": 429,
  "message": "Too many requests",
  "retryAfter": 900
}
```

## CORS Configuration

The API allows CORS requests from configured origins:

- Development: `http://localhost:3001`
- Production: Configured via environment variables

Allowed methods: `GET, POST, PUT, DELETE, OPTIONS`

## Security

### Request Sanitization

All requests are automatically sanitized to prevent:

- XSS attacks
- SQL injection
- NoSQL injection

### Headers

The API sets security headers using Helmet:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (in production)

### File Upload Security

- Maximum file size: 10MB
- Allowed MIME types are strictly validated
- Files are scanned for malicious content
- Stored in secure cloud storage

## Pagination

List endpoints support pagination with the following parameters:

- `page`: Page number (starts at 1)
- `limit`: Items per page (max: 100)

Response includes:

```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "limit": 10,
  "totalPages": 15
}
```

## Webhooks (Coming Soon)

The API will support webhooks for:

- New exercise created
- Tutorial published
- User progress milestones

## SDK Support

Official SDKs are planned for:

- JavaScript/TypeScript
- Python
- Go

## API Versioning

The API uses URL versioning:

- Current version: `v1`
- Example: `/api/v1/exercises`

Deprecated endpoints will be marked and maintained for at least 6 months.

## Support

For API support:

- Documentation: https://docs.bassnotion.com/api
- Email: api-support@bassnotion.com
- GitHub Issues: https://github.com/bassnotion/api/issues
