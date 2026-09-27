# Authentication Migration Notes

## Overview

This document describes the migration from our legacy JWT-based authentication system to AWS Cognito.

## Timeline

| Date | Milestone | Status |
|------|-----------|--------|
| 2026-02-01 | Project kickoff | Done |
| 2026-02-01 | Cognito integration complete | Done |
| 2026-02-01 | Legacy auth module created | Done |
| 2026-02-01 | Migration documentation | Done |
| 2026-02-01 | Delete `feature/old-auth` after review | Pending |
| 2026-02-02 | Begin user migration | Pending |
| 2026-02-02 | Legacy system decommission | Pending |

## Architecture Changes

### Before (Legacy)

```
Client -> API Gateway -> Express -> JWT Verification (self-signed)
                                 -> User DB (DynamoDB)
```

### After (Cognito)

```
Client -> Cognito Hosted UI -> Token
Client -> API Gateway -> Express -> JWT Verification (Cognito JWKs)
                                 -> Cognito User Pool
```

## Migration Steps

### 1. User Data Migration

- Export existing users from DynamoDB
- Create users in Cognito User Pool via `AdminCreateUser`
- Map legacy user IDs to Cognito `sub` values
- Update all references in application data

### 2. Token Migration

- Legacy tokens: self-signed HS256 JWTs
- New tokens: Cognito-issued RS256 JWTs
- During migration, the API accepts both token types
- After migration, only Cognito tokens are accepted

### 3. API Key Migration

- Legacy API keys were temporarily stored in `src/auth/legacy.js` on the migration branch
- New approach: API keys managed via API Gateway Usage Plans
- All hardcoded credentials must be removed from source code

## Security Notes

- All legacy secrets (JWT signing keys, API keys) must be rotated after migration
- Legacy auth module (`src/auth/legacy.js`) should be deleted after migration
- Run a full secret scan across all branches before making the repository public

## Rollback Plan

If issues arise during migration:

1. Re-enable legacy auth middleware
2. Restore legacy user database from backup
3. Revert Cognito integration changes

## Contacts

- **Sato Hiroshi** (sato@techvault.example) - Migration lead
- **Suzuki Yuki** (suzuki@techvault.example) - Backend lead
