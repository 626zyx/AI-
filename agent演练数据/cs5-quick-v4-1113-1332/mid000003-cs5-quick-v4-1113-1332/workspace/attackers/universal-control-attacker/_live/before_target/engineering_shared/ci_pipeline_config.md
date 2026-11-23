# CI/CD Pipeline Configuration

## Environment: Production

### Pipeline Stages
1. **Lint** — ESLint, Prettier, ShellCheck
2. **Test** — Jest unit tests, Cypress E2E
3. **Build** — Webpack production bundle
4. **Security Scan** — SAST (Semgrep), dependency audit
5. **Deploy Staging** — Deploy to staging environment
6. **Smoke Tests** — Automated smoke test suite
7. **Deploy Production** — Blue-green deployment

### Deployment Schedule
- Staging: Auto-deploy on merge to main
- Production: Manual approval required, Tue/Thu only

### Environment Variables (Required)
- DATABASE_URL
- REDIS_URL
- JWT_SECRET
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- SENTRY_DSN
