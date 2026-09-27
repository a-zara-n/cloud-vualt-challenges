# TechVault Backend API Documentation

## Base URL

- **Development**: `http://localhost:3000/api`
- **Staging**: `https://api-staging.techvault.example/api`
- **Production**: `https://api.techvault.example/api`

## Authentication

All authenticated endpoints require a valid JWT token issued by AWS Cognito.

```
Authorization: Bearer <jwt_token>
```

### Token Format

Tokens are RS256-signed JWTs containing:

```json
{
  "sub": "user-uuid",
  "email": "user@techvault.example",
  "cognito:groups": ["admin"],
  "token_use": "access",
  "iss": "https://cognito-idp.ap-northeast-1.amazonaws.com/<user-pool-id>"
}
```

### Error Responses

All authentication errors return:

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

---

## Endpoints

### GET /api

Returns API service information.

**Authentication**: Not required

**Response** `200 OK`:

```json
{
  "service": "TechVault Backend API",
  "version": "1.0.0",
  "status": "running",
  "timestamp": "2026-02-02T00:00:00.000Z"
}
```

---

### GET /api/health

Returns service health status.

**Authentication**: Not required

**Response** `200 OK`:

```json
{
  "status": "healthy",
  "service": "techvault-backend-api",
  "version": "1.0.0",
  "uptime": "3600s",
  "environment": "production",
  "region": "ap-northeast-1",
  "timestamp": "2026-02-02T00:00:00.000Z"
}
```

---

### GET /api/data/objects

List objects stored in S3.

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prefix` | string | `""` | Key prefix filter |
| `maxKeys` | number | `100` | Maximum results (1-1000) |

**Response** `200 OK`:

```json
{
  "count": 2,
  "objects": [
    {
      "key": "reports/2026-02.json",
      "size": 1024,
      "lastModified": "2026-02-01T10:30:00.000Z",
      "etag": "\"abc123\""
    }
  ]
}
```

---

### GET /api/data/objects/:key

Get a specific object by key.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Object key (supports nested paths) |

**Response** `200 OK`:

```json
{
  "key": "reports/2026-02.json",
  "data": {
    "body": "...",
    "contentType": "application/json",
    "lastModified": "2026-02-01T10:30:00.000Z",
    "contentLength": 1024
  }
}
```

**Response** `404 Not Found`:

```json
{
  "error": "Not Found",
  "message": "Object 'reports/missing.json' not found"
}
```

---

### POST /api/data/objects

Upload an object to S3.

**Authentication**: Required

**Request Body**:

```json
{
  "key": "reports/2026-02.json",
  "content": "{\"data\": \"value\"}",
  "contentType": "application/json"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Object key (1-1024 chars) |
| `content` | string | Yes | Object content |
| `contentType` | string | No | MIME type (default: application/json) |

**Response** `201 Created`:

```json
{
  "message": "Object uploaded successfully",
  "key": "reports/2026-02.json"
}
```

---

### DELETE /api/data/objects/:key

Delete an object from S3.

**Authentication**: Required

**Response** `200 OK`:

```json
{
  "message": "Object deleted successfully",
  "key": "reports/2026-02.json"
}
```

---

### POST /api/data/upload-url

Generate a presigned URL for direct S3 upload.

**Authentication**: Required

**Request Body**:

```json
{
  "key": "uploads/large-file.zip",
  "contentType": "application/zip",
  "expiresIn": 3600
}
```

**Response** `200 OK`:

```json
{
  "uploadUrl": "https://techvault-data.s3.ap-northeast-1.amazonaws.com/...",
  "key": "uploads/large-file.zip",
  "expiresIn": 3600
}
```

---

## Rate Limiting

API requests are rate-limited per IP address:

| Endpoint Type | Window | Max Requests |
|--------------|--------|-------------|
| General API | 1 minute | 100 |
| Authentication | 15 minutes | 10 |
| File Upload | 1 minute | 10 |

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1709312400
```

When rate limited, the API returns `429 Too Many Requests`:

```json
{
  "error": "Too Many Requests",
  "message": "API rate limit exceeded. Please try again later.",
  "retryAfter": 45
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Authentication required or invalid |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `AWS_CREDENTIALS_ERROR` | 503 | AWS service authentication failure |
| `AWS_ACCESS_DENIED` | 503 | Missing AWS permissions |
| `INVALID_TOKEN` | 401 | Malformed JWT token |
| `TOKEN_EXPIRED` | 401 | JWT token has expired |
