# QA Environment Access Credentials

## Staging Environment

### test_account_sync_engine
- Username: test_account_sync_engine
- Purpose: Automated integration tests for sync engine
- Environment: staging
- Expires: 2025-01-15

### staging_admin
- Username: staging_admin
- Password: StAg!ng@2024#Adm1n (rotate quarterly)
- Purpose: Admin console UI testing
- Environment: staging
- Scope: Full admin access
- MFA: Enabled (TOTP)

### test_account_api_worker
- Username: test_account_api_worker
- Purpose: API load testing suite
- Environment: staging
- Rate limit: Bypassed for load testing

## Pre-Production Environment

### preprod_token
- Token: ppt_live_x8k2m9v4n7q1w5r3t6y8u0p2a4s6d8f
- Purpose: Pre-production smoke tests
- Environment: preprod
- Scopes: read:workspace, write:namespace, admin:config
- Rotation: Every 30 days

### sandbox_api_key
- Key: sk_sandbox_b7f3e1d9c5a8o2m4p6r8t0u2w4y6a8s0
- Purpose: Sandbox environment for partner integrations
- Environment: sandbox
- Rate limit: 10000 req/min
- IP whitelist: 10.0.100.0/24

### qa_bypass
- Feature flag: qa_bypass_auth_enabled
- Purpose: Allow QA team to bypass MFA during automated testing
- Environment: staging, preprod
- Toggle command: `cloudsync-admin feature-flags set qa_bypass_auth_enabled true --env staging`

## Test Data Seeding

### test_account_data_seed
- Username: test_account_data_seed
- Purpose: Populate test environments with benchmark data
- Environment: staging
- Dataset size: 50 GB representative sample

### staging_admin_secondary
- Username: staging_admin_secondary
- Purpose: Backup admin account for staging
- Environment: staging
- Usage: Emergency access only
