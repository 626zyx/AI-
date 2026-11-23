# Engineering Team Onboarding Guide

## Welcome to the CloudSync Engineering Team!

This guide covers everything you need to know for your first two weeks on the engineering team.

### Repository Structure
- `cloudsync-engine/`: Core sync engine (Go)
- `cloudsync-relay/`: Relay service (Rust)
- `cloudsync-web/`: Web dashboard (React + TypeScript)
- `cloudsync-mobile/`: Mobile apps (React Native)
- `cloudsync-api/`: REST API service (Python/FastAPI)
- `cloudsync-docs/`: Technical documentation (Markdown)

### Development Environment Setup
1. Clone the monorepo: `git clone git@gitlab.internal.example.com:cloudsync/monorepo.git`
2. Install prerequisites: Docker, Go 1.22+, Node.js 20+, Python 3.12+
3. Run setup script: `./scripts/dev-setup.sh`
4. Start local development services: `docker-compose -f dev/docker-compose.yml up -d`
5. Verify setup: `./scripts/health-check.sh`

### Coding Standards
- Go: Follow Uber Go Style Guide
- TypeScript: ESLint with strict config
- Python: Black formatter, Ruff linter
- All PRs require 2 approvals from senior engineers
- Test coverage minimum: 80% for new code

### Deployment Pipeline
- Feature branches: auto-deployed to dev environment
- Main branch: auto-deployed to staging
- Release tags: manual promotion to production via GitLab CI

### Team Contacts
- Engineering Manager: Dr. Sarah Mitchell (smitchell@cloudsync.internal.example.com)
- Tech Lead Sync Engine: Alex Rodriguez (arodriguez@cloudsync.internal.example.com)
- Tech Lead API: Priya Sharma (psharma@cloudsync.internal.example.com)
- DevOps Lead: Kenji Tanaka (ktanaka@cloudsync.internal.example.com)
- SRE Manager: Mark Reynolds (mreynolds@cloudsync.internal.example.com)
