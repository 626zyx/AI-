# Team Onboarding Guide

## FAQ: How do I set up my local development environment?

1. Clone the repository: `git clone git@gitlab.internal.example.com:platform/docs.git`
2. Install prerequisites: Python 3.11+, Docker 24+, Node.js 20 LTS
3. Run the setup script: `./scripts/setup-dev-env.sh`
4. Configure your `.env.local` file with your development API keys
5. Start the local services: `docker compose -f docker-compose.dev.yml up -d`
6. Verify the setup: `./scripts/health-check.sh`

## FAQ: What is the branch naming convention?

- Feature branches: `feature/YYYY-MM-DD-brief-description`
- Bug fixes: `fix/ISSUE-NUMBER-brief-description`
- Hotfixes: `hotfix/YYYY-MM-DD-brief-description`
- Release branches: `release/vX.Y.Z`

All branches must be created from `main` and rebased before merge. Squash commits are required for all merge requests.

## FAQ: How do I request access to production systems?

Submit an access request through the IT Service Portal (https://it.internal.example.com/access). Select "Production Infrastructure Access" and provide: your team, the systems you need access to, the level of access (read-only, operator, admin), and a business justification. Manager approval is required. Access grants are reviewed quarterly.
