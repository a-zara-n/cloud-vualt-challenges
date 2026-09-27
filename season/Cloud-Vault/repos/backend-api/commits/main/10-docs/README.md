# TechVault Backend API

Internal data processing service for the TechVault platform.

## Overview

This service provides REST API endpoints for customer vault metadata, user authentication, and document access. It runs on AWS Lambda behind API Gateway and uses Cognito for authentication.

## Tech Stack

- **Runtime**: Node.js 20.x
- **Framework**: Express.js
- **Authentication**: AWS Cognito (JWT/JWKs)
- **Storage**: Amazon S3
- **Database**: Amazon DynamoDB
- **Deployment**: Serverless Framework + AWS Lambda

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- AWS CLI configured with appropriate credentials
- Access to the TechVault AWS account

### Installation

```bash
npm install
```

### Local Development

```bash
npm run dev
```

The API will be available at `http://localhost:3000`.

### Running Tests

```bash
npm test
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api` | No | API info |
| GET | `/api/health` | No | Health check |
| GET | `/api/health/detailed` | No | Detailed health |
| GET | `/api/data/objects` | Yes | List objects |
| GET | `/api/data/objects/:key` | Yes | Get object |
| POST | `/api/data/objects` | Yes | Upload object |
| DELETE | `/api/data/objects/:key` | Yes | Delete object |
| POST | `/api/data/upload-url` | Yes | Get presigned URL |

See [docs/api.md](docs/api.md) for detailed API documentation.

## Authentication

All authenticated endpoints require a valid JWT token from Cognito:

```
Authorization: Bearer <jwt_token>
```

Tokens are verified against the Cognito User Pool's JWKs endpoint.

## Deployment

Deployments are handled via GitHub Actions. Pushing to `main` triggers a deployment to the dev environment.

```bash
# Manual deployment
npx serverless deploy --stage dev
npx serverless deploy --stage staging
npx serverless deploy --stage prod
```

## Auth Migration

The legacy JWT auth path was replaced by Cognito on 2026-02-01. Migration work must be reviewed with all branches included because the old branch carried temporary import code.

## Project Structure

```
src/
├── index.js              # Express app entry point
├── lambda.js             # Lambda handler wrapper
├── routes/
│   ├── index.js          # Route definitions
│   ├── data.js           # Data processing routes
│   └── health.js         # Health check routes
├── middleware/
│   ├── auth.js           # JWT authentication
│   ├── validation.js     # Request validation
│   ├── errorHandler.js   # Error handling
│   └── rateLimit.js      # Rate limiting
└── services/
    ├── cognito.js        # Cognito operations
    └── s3.js             # S3 operations
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment name | No |
| `AWS_REGION` | AWS region (default: ap-northeast-1) | No |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID | Yes |
| `S3_BUCKET_NAME` | S3 bucket for data storage | Yes |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | No |

## Team

- **Suzuki Yuki** - Lead Developer
- **Sato Hiroshi** - Backend Developer
- **Yamamoto Rina** - Infrastructure

## License

UNLICENSED - Internal use only.
