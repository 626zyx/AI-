Deployment Runbook
==================

FAQ: How do I deploy to staging?
--------------------------------

1. Ensure all tests pass on your feature branch
2. Create a merge request targeting the ``staging`` branch
3. Wait for CI/CD pipeline to complete (includes integration tests)
4. After merge, the staging environment auto-deploys
5. Verify deployment: ``curl https://staging.internal.example.com/healthz``
6. Run smoke tests: ``./scripts/smoke-test-staging.sh``

FAQ: How do I deploy to production?
------------------------------------
Production deployments follow a strict change-management process:

1. Create a release candidate from staging: ``git checkout staging && git pull && git checkout -b release/vX.Y.Z``
2. Open a production change request in the Change Management System
3. Obtain approvals: Tech Lead, QA Lead, and Operations Lead
4. During the deployment window (Tue/Thu 10:00-12:00 UTC):
   a. Merge release branch to main
   b. Monitor the canary deployment (10% traffic for 15 minutes)
   c. If canary metrics are green, proceed to full rollout
   d. Monitor dashboards for 30 minutes post-deployment

FAQ: How do I roll back a production deployment?
-------------------------------------------------
1. Identify the last known-good commit from the deployment history
2. Execute rollback: ``./scripts/rollback-production.sh <commit-hash>``
3. The rollback script will:
   - Revert the infrastructure to the specified commit's artifact
   - Run database migration reversions if applicable
   - Execute health checks
4. Notify #platform-incidents Slack channel of the rollback
5. Create a post-mortem document within 24 hours
