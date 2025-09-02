# BassNotion API Quick Start Guide

## Getting Started

This guide will help you get up and running with the BassNotion API in 5 minutes.

## Step 1: Access the API

### Development
```
Base URL: http://localhost:3000
Swagger Docs: http://localhost:3000/api/docs
```

### Production
```
Base URL: https://api.bassnotion.com
```

## Step 2: Register an Account

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "securepassword123",
    "username": "yourusername"
  }'
```

## Step 3: Login to Get Access Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "securepassword123"
  }'
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-123",
    "email": "your@email.com"
  }
}
```

Save the `accessToken` for authenticated requests.

## Step 4: Make Your First API Call

### Get All Exercises
```bash
curl http://localhost:3000/api/exercises \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Search for Exercises
```bash
curl "http://localhost:3000/api/exercises/search?q=blues" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Common Use Cases

### 1. Fetch Beginner Exercises

```javascript
// JavaScript/Node.js example
const response = await fetch('http://localhost:3000/api/exercises/difficulty/beginner', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const data = await response.json();
console.log(data.exercises);
```

### 2. Upload a MIDI File

```javascript
const formData = new FormData();
formData.append('file', midiFile);
formData.append('title', 'My Bass Exercise');
formData.append('difficulty', 'intermediate');

const response = await fetch('http://localhost:3000/api/exercises/upload/midi', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  body: formData
});
```

### 3. Save a Custom Bassline

```javascript
const response = await fetch('http://localhost:3000/api/exercises/user/save-bassline', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'My Cool Bassline',
    notes: [
      { string: 4, fret: 0, duration: 0.25 },
      { string: 4, fret: 3, duration: 0.25 },
      { string: 3, fret: 2, duration: 0.25 },
      { string: 3, fret: 0, duration: 0.25 }
    ],
    bpm: 120,
    key: 'E'
  })
});
```

## Using with Different Languages

### Python
```python
import requests

# Login
login_response = requests.post(
    'http://localhost:3000/api/v1/auth/login',
    json={'email': 'your@email.com', 'password': 'password123'}
)
token = login_response.json()['accessToken']

# Get exercises
headers = {'Authorization': f'Bearer {token}'}
exercises = requests.get(
    'http://localhost:3000/api/exercises',
    headers=headers
).json()
```

### cURL
```bash
# Set your token as environment variable
export TOKEN="your-access-token"

# Get exercises
curl http://localhost:3000/api/exercises \
  -H "Authorization: Bearer $TOKEN"

# Create exercise
curl -X POST http://localhost:3000/api/exercises \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Exercise",
    "difficulty": "beginner",
    "bpm": 100
  }'
```

### Go
```go
package main

import (
    "net/http"
    "encoding/json"
)

func getExercises(token string) {
    client := &http.Client{}
    req, _ := http.NewRequest("GET", "http://localhost:3000/api/exercises", nil)
    req.Header.Add("Authorization", "Bearer " + token)
    
    resp, _ := client.Do(req)
    defer resp.Body.Close()
    
    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
}
```

## Handling Errors

Always check for error responses:

```javascript
const response = await fetch('http://localhost:3000/api/exercises/invalid-id');

if (!response.ok) {
  const error = await response.json();
  console.error('API Error:', error.message);
  // Handle error appropriately
}
```

## Rate Limiting

Be aware of rate limits:
- 100 requests per 15 minutes for anonymous users
- 500 requests per 15 minutes for authenticated users

Check response headers:
```
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 499
X-RateLimit-Reset: 1693497600
```

## Best Practices

1. **Always use HTTPS in production**
2. **Store tokens securely** (never in client-side code)
3. **Handle token expiration** by using the refresh token
4. **Implement retry logic** for network failures
5. **Cache responses** when appropriate
6. **Use pagination** for large datasets

## Next Steps

1. Explore the full [API Documentation](./API_DOCUMENTATION.md)
2. Try the interactive [Swagger documentation](http://localhost:3000/api/docs)
3. Check out example projects in our [GitHub repository](https://github.com/bassnotion/api-examples)
4. Join our [Discord community](https://discord.gg/bassnotion) for support

## Need Help?

- 📚 [Full API Documentation](./API_DOCUMENTATION.md)
- 💬 [Discord Community](https://discord.gg/bassnotion)
- 📧 Email: api-support@bassnotion.com
- 🐛 [Report Issues](https://github.com/bassnotion/api/issues)