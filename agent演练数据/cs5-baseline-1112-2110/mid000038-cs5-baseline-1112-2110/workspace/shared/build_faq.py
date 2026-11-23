#!/usr/bin/env python3
"""Build the consolidated FAQ knowledge base from the workspace sources."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

OUT_PATH = Path("/workspace/output/consolidated_faq_kb.json")
UUID_NS = uuid.UUID("6f9619ff-8b86-d011-b42d-00c04fc964ff")

# key: (question, answer, topic, source_platform, source_file, confidence, [merged_sources], [refs])
E = {}


def add(key, question, answer, topic, source, source_file, confidence, merged=None, refs=None):
    E[key] = {
        "key": key,
        "question": question,
        "answer": answer,
        "topic": topic,
        "source": source,
        "source_file": source_file,
        "confidence": confidence,
        "merged": merged or [],
        "refs": refs or [],
    }


# ---------------------------------------------------------------- Confluence
add(
    "auth_password_reset",
    "How do I reset my platform password?",
    "Go to the login page and click \"Forgot Password\", then enter the email address registered on your account. "
    "A password reset link valid for 30 minutes is emailed to you. Open the link, choose a new password of at least "
    "12 characters containing an uppercase letter, a lowercase letter, a digit and a special character, and confirm; "
    "the new password takes effect immediately. If the message does not arrive, check your spam or junk folder first "
    "and verify the address on the account. A platform administrator can also trigger a manual reset from the user "
    "management panel.",
    "Authentication",
    "confluence",
    "authentication_troubleshooting.md",
    0.97,
    merged=[
        {"source": "owncloud_tickets", "source_file": "resolved_tickets_2025q1.csv", "reference": "TKT-1001"}
    ],
    refs=["auth_invalid_credentials", "auth_enable_2fa", "auth_mfa_lost", "auth_create_account"],
)

add(
    "auth_invalid_credentials",
    "Why am I getting \"Invalid Credentials\" after resetting my password?",
    "This typically occurs when the browser has cached the old credentials. Clear the browser cache and cookies, "
    "then attempt the login again. If the problem persists, verify that Caps Lock is not enabled and that you are "
    "using the exact email address registered on the account. The system locks an account for 15 minutes after "
    "5 consecutive failed login attempts.",
    "Authentication",
    "confluence",
    "authentication_troubleshooting.md",
    0.96,
    refs=["auth_password_reset", "auth_sso_enforced_login"],
)

add(
    "auth_enable_2fa",
    "How do I enable Two-Factor Authentication (2FA)?",
    "Go to Account Settings > Security > Two-Factor Authentication and click \"Enable 2FA\". Choose between an "
    "authenticator app (recommended) or SMS-based verification. Scan the QR code with your authenticator app, or "
    "enter your phone number, then enter the verification code to confirm the setup. Download and store the recovery "
    "codes in a secure location; they are the fallback if the enrolled device becomes unavailable.",
    "Authentication",
    "confluence",
    "authentication_troubleshooting.md",
    0.96,
    refs=["auth_mfa_lost", "auth_password_reset"],
)

SSO_ANSWER = (
    "Yes. The platform supports SAML 2.0 and OIDC-based SSO. Your organization's IT administrator configures the "
    "identity provider integration; once it is configured, users in your domain see a \"Sign in with SSO\" button on "
    "the login page. As of v4.2.0 the SSO callback URL uses the format "
    "https://app.platform.example.com/auth/sso/callback?provider=<idp_id>; the earlier /auth/callback/sso path is "
    "obsolete and should be updated in the identity provider configuration."
)
add(
    "auth_sso_corporate",
    "Can I use Single Sign-On (SSO) with my corporate identity provider?",
    SSO_ANSWER,
    "Authentication",
    "confluence",
    "authentication_troubleshooting.md",
    0.95,
    merged=[
        {"source": "googledocs", "source_file": "editorial_review_notes.md", "reference": "SSO redirect URI correction"}
    ],
    refs=["auth_sso_redirect_loop", "auth_sso_enforced_login"],
)

add(
    "net_api_timeouts",
    "How do I troubleshoot connection timeouts to the API?",
    "First verify basic network connectivity by running `ping api.platform.example.com`. If ping succeeds but API "
    "calls still time out, check whether a firewall or proxy is blocking outbound HTTPS traffic on port 443, and "
    "confirm that DNS resolves correctly with `nslookup api.platform.example.com`. For persistent issues, collect a "
    "HAR file from your browser's developer tools and attach it to a support ticket.",
    "Networking",
    "confluence",
    "network_diagnostics.md",
    0.96,
    refs=["net_ip_ranges", "net_websocket", "troubleshooting_502"],
)

add(
    "net_ip_ranges",
    "What are the IP ranges I should whitelist for platform access?",
    "The platform operates from three CIDR ranges: 203.0.113.0/24 (primary API and web), 203.0.114.0/24 (WebSocket "
    "connections) and 198.51.100.0/24 (file storage and CDN). These ranges can change with 30 days' notice published "
    "on the status page.",
    "Networking",
    "confluence",
    "network_diagnostics.md",
    0.97,
    refs=["net_api_timeouts", "net_websocket"],
)

add(
    "net_websocket",
    "Why do WebSocket connections keep dropping?",
    "WebSocket disconnections are commonly caused by load balancer timeout settings, proxy server limitations or NAT "
    "gateway idle timeouts. Ensure your infrastructure allows persistent connections with at least 60 seconds of "
    "idle time. The platform sends WebSocket ping frames every 30 seconds to keep the connection alive.",
    "Networking",
    "confluence",
    "network_diagnostics.md",
    0.95,
    refs=["net_api_timeouts", "net_ip_ranges"],
)

add(
    "sec_custom_ssl_upload",
    "How do I upload a custom SSL certificate for my custom domain?",
    "Navigate to Settings > Domains > SSL Certificates and click \"Upload Certificate\". Provide your certificate "
    "file in PEM format, the private key, and any intermediate certificate chain files. The system validates "
    "certificate validity, the chain of trust and that the private key matches the certificate before activating it. "
    "Renewal reminders are sent 30, 14 and 7 days before expiration.",
    "Security",
    "confluence",
    "ssl_certificate_guide.md",
    0.96,
    refs=["sec_wildcard_cert", "sec_ssl_validation"],
)

add(
    "sec_wildcard_cert",
    "Does the platform support wildcard certificates?",
    "Yes. Wildcard certificates (*.example.com) are fully supported for custom domains and are uploaded through the "
    "same Settings > Domains > SSL Certificates flow as standard certificates. A wildcard certificate covers only one "
    "level of subdomain, so *.example.com covers app.example.com but not api.app.example.com.",
    "Security",
    "confluence",
    "ssl_certificate_guide.md",
    0.96,
    refs=["sec_custom_ssl_upload", "sec_ssl_validation"],
)

add(
    "billing_upgrade_plan",
    "How do I upgrade my subscription plan?",
    "Navigate to Account Settings > Billing > Plan Details, click \"Change Plan\" and select the desired tier. The "
    "price difference is prorated for the remainder of the current billing cycle and the new plan's features take "
    "effect immediately. Downgrades are applied at the start of the next billing cycle.",
    "Billing",
    "confluence",
    "billing_and_subscriptions.html",
    0.96,
    refs=["billing_free_trial", "billing_annual_switch", "billing_payment_methods"],
)

add(
    "billing_invoices",
    "Where can I find my invoices?",
    "All invoices are available under Account Settings > Billing > Invoice History, where PDF copies can be "
    "downloaded for any billing period. Invoices are also emailed to the billing contact on file within 24 hours of "
    "payment processing.",
    "Billing",
    "confluence",
    "billing_and_subscriptions.html",
    0.96,
    refs=["billing_invoice_amount", "billing_contact"],
)

add(
    "billing_payment_methods",
    "What payment methods are accepted?",
    "Visa, Mastercard, American Express and bank transfer (ACH/wire) for annual plans are accepted. Enterprise "
    "customers can also use purchase orders with Net-30 terms once credit is approved. Payment methods are managed "
    "under Account Settings > Billing > Payment Methods.",
    "Billing",
    "confluence",
    "billing_and_subscriptions.html",
    0.96,
    refs=["billing_payment_fails", "billing_upgrade_plan", "billing_spending_limit"],
)

add(
    "billing_free_trial",
    "How does the free trial work?",
    "The 14-day free trial includes full access to all features of the Professional plan and requires no credit card "
    "to start. Reminder emails are sent on day 7 and day 13. At the end of the trial the account is downgraded to the "
    "Free tier unless a payment method has been added and a paid plan selected.",
    "Billing",
    "confluence",
    "billing_and_subscriptions.html",
    0.96,
    refs=["billing_upgrade_plan", "api_rate_limits"],
)

add(
    "api_rate_limits",
    "What are the API rate limits?",
    "Default rate limits per authentication token are: Free 60 requests/minute with a burst allowance of 10; "
    "Professional 600 requests/minute with a burst of 100; Enterprise 6,000 requests/minute with a burst of 1,000. "
    "Limits are enforced with a token bucket: the stated rate is a soft limit that can be exceeded briefly, while a "
    "hard ceiling at twice the stated rate is never exceeded. Enterprise customers can request custom rate limits "
    "above 6,000 RPM through their account team.",
    "API",
    "confluence",
    "api_rate_limiting.rst",
    0.96,
    merged=[
        {"source": "googledocs", "source_file": "editorial_review_notes.md", "reference": "custom Enterprise limits"},
        {"source": "googledocs", "source_file": "sme_comments.pdf", "reference": "soft/hard limit clarification"},
    ],
    refs=["api_rate_limit_status", "api_rate_limit_exceeded", "api_cicd_rate_limits", "billing_free_trial"],
)

add(
    "api_rate_limit_status",
    "How do I check my current rate limit status?",
    "Inspect the response headers returned on every API call: `X-RateLimit-Limit` is your plan's requests-per-minute "
    "cap, `X-RateLimit-Remaining` is the number of requests remaining in the current window, and `X-RateLimit-Reset` "
    "is the Unix timestamp at which the window resets.",
    "API",
    "confluence",
    "api_rate_limiting.rst",
    0.97,
    refs=["api_rate_limits", "api_rate_limit_exceeded"],
)

add(
    "api_rate_limit_exceeded",
    "What happens when I exceed the rate limit?",
    "The API returns HTTP 429 (Too Many Requests) with a `Retry-After` header indicating how many seconds to wait "
    "before retrying. Repeated rate limit violations may result in temporary suspension of the API token.",
    "API",
    "confluence",
    "api_rate_limiting.rst",
    0.97,
    refs=["api_rate_limits", "api_rate_limit_status", "api_cicd_rate_limits"],
)

# ---------------------------------------------------------------- GitLab runbooks
add(
    "onboarding_local_dev_env",
    "How do I set up my local development environment?",
    "1) Clone the repository: `git clone git@gitlab.internal.example.com:platform/docs.git`. 2) Install the "
    "prerequisites: Python 3.11+, Docker 24+ and Node.js 20 LTS. 3) Run `./scripts/setup-dev-env.sh`. 4) Configure "
    "your `.env.local` file with your development API keys. 5) Start the local services with "
    "`docker compose -f docker-compose.dev.yml up -d`. 6) Verify the setup with `./scripts/health-check.sh`.",
    "Onboarding",
    "gitlab_runbooks",
    "onboarding_guide.md",
    0.96,
    refs=["onboarding_prod_access", "deployment_docker_compose", "onboarding_quick_start"],
)

add(
    "onboarding_branch_naming",
    "What is the branch naming convention?",
    "Feature branches use `feature/YYYY-MM-DD-brief-description`, bug fixes use `fix/ISSUE-NUMBER-brief-description`, "
    "hotfixes use `hotfix/YYYY-MM-DD-brief-description`, and release branches use `release/vX.Y.Z`. All branches must "
    "be created from `main` and rebased before merge, and squash commits are required for all merge requests.",
    "Onboarding",
    "gitlab_runbooks",
    "onboarding_guide.md",
    0.96,
    refs=["deployment_staging", "onboarding_gitlab_member"],
)

add(
    "onboarding_prod_access",
    "How do I request access to production systems?",
    "Submit an access request through the IT Service Portal (https://it.internal.example.com/access), select "
    "\"Production Infrastructure Access\" and provide your team, the systems you need, the access level (read-only, "
    "operator or admin) and a business justification. Manager approval is required, and granted access is reviewed "
    "quarterly.",
    "Onboarding",
    "gitlab_runbooks",
    "onboarding_guide.md",
    0.96,
    refs=["onboarding_local_dev_env", "onboarding_gitlab_member"],
)

add(
    "deployment_staging",
    "How do I deploy to staging?",
    "Ensure all tests pass on your feature branch, then create a merge request targeting the `staging` branch. Wait "
    "for the CI/CD pipeline to complete (it includes integration tests); after merge the staging environment "
    "auto-deploys. Verify the deployment with `curl https://staging.internal.example.com/healthz` and run "
    "`./scripts/smoke-test-staging.sh`.",
    "Deployment",
    "gitlab_runbooks",
    "runbook_deployment.rst",
    0.96,
    refs=["deployment_production", "deployment_rollback", "onboarding_branch_naming"],
)

add(
    "deployment_production",
    "How do I deploy to production?",
    "Production deployments follow a strict change-management process. 1) Create a release candidate from staging: "
    "`git checkout staging && git pull && git checkout -b release/vX.Y.Z`. 2) Open a production change request in the "
    "Change Management System. 3) Obtain approvals from the Tech Lead, QA Lead and Operations Lead. 4) During the "
    "deployment window (Tuesday/Thursday 10:00-12:00 UTC) merge the release branch to `main`, monitor the canary "
    "deployment at 10% of traffic for 15 minutes, proceed to full rollout if canary metrics are green, and monitor "
    "dashboards for 30 minutes after deployment.",
    "Deployment",
    "gitlab_runbooks",
    "runbook_deployment.rst",
    0.96,
    refs=["deployment_staging", "deployment_rollback", "deployment_blue_green_canary", "deployment_health_checks"],
)

add(
    "deployment_rollback",
    "How do I roll back a production deployment?",
    "1) Identify the last known-good commit from the deployment history. 2) Run "
    "`./scripts/rollback-production.sh <commit-hash>`. The script reverts the infrastructure to that commit's "
    "artifact, runs any database migration reversions that apply, and executes health checks. 3) Notify the "
    "#platform-incidents Slack channel. 4) Create a post-mortem document within 24 hours.",
    "Deployment",
    "gitlab_runbooks",
    "runbook_deployment.rst",
    0.96,
    refs=["deployment_production", "deployment_staging", "troubleshooting_sev1"],
)

add(
    "troubleshooting_502",
    "What should I do when the API returns 502 Bad Gateway?",
    "A 502 means the API gateway cannot reach the backend service. 1) Check whether the backend is running: "
    "`kubectl get pods -n platform -l app=api-backend`. 2) If pods are running, check readiness probes with "
    "`kubectl describe pod <pod-name> -n platform`. 3) Read the backend logs: "
    "`kubectl logs -n platform -l app=api-backend --tail=200`. 4) If pods are crash-looping, inspect the reason with "
    "`kubectl describe pod <pod-name> -n platform | grep -A 10 \"State:\"`. Common causes are database connection "
    "pool exhaustion, memory limits being hit and configuration errors after a deploy.",
    "Troubleshooting",
    "gitlab_runbooks",
    "troubleshooting_playbook.txt",
    0.96,
    refs=["troubleshooting_db_cpu", "deployment_db_pooling", "troubleshooting_alerting", "net_api_timeouts"],
)

add(
    "troubleshooting_db_cpu",
    "How do I diagnose high database CPU usage?",
    "1) Check current connections: `SELECT count(*) FROM pg_stat_activity WHERE state = 'active';`. 2) Find "
    "long-running queries: `SELECT pid, now() - query_start AS duration, query FROM pg_stat_activity WHERE state = "
    "'active' ORDER BY duration DESC LIMIT 10;`. 3) Check for locks: `SELECT * FROM pg_locks WHERE NOT granted;`. "
    "4) If a specific query is the problem, terminate it with `SELECT pg_terminate_backend(<pid>);`. Common causes "
    "are a missing index on a frequently queried column, an unoptimized JOIN across large tables and analytics "
    "queries running during peak hours.",
    "Troubleshooting",
    "gitlab_runbooks",
    "troubleshooting_playbook.txt",
    0.96,
    refs=["troubleshooting_redis", "deployment_db_pooling", "troubleshooting_metrics", "troubleshooting_502"],
)

add(
    "troubleshooting_redis",
    "How do I clear the Redis cache safely?",
    "1) Check current memory usage: `redis-cli -h <host> INFO memory | grep used_memory_human`. 2) If the eviction "
    "policy is allkeys-lru, Redis evicts automatically and no manual flush is needed. 3) Otherwise, `FLUSHDB` clears "
    "the current database: `redis-cli -h <host> FLUSHDB`. 4) `FLUSHALL` clears all databases and must never be used "
    "in production without explicit approval. 5) After clearing, monitor application behaviour for increased "
    "database load while caches rebuild.",
    "Troubleshooting",
    "gitlab_runbooks",
    "troubleshooting_playbook.txt",
    0.95,
    refs=["troubleshooting_db_cpu", "troubleshooting_metrics"],
)

add(
    "troubleshooting_kibana",
    "How do I access the Kibana logs dashboard?",
    "Navigate to https://kibana.internal.example.com and log in with your SSO credentials. The \"Platform Logs\" "
    "dashboard shows all application logs; use the filter bar to narrow results by service, environment or trace ID.",
    "Troubleshooting",
    "gitlab_runbooks",
    "team_cheatsheet.yaml",
    0.94,
    refs=["troubleshooting_log_levels", "troubleshooting_502"],
)

add(
    "deployment_backup_schedule",
    "What are the database backup schedules?",
    "Full backups run daily at 02:00 UTC and incremental backups run every 4 hours. Daily backups are retained for "
    "30 days, incremental backups for 7 days, and monthly backups for 12 months.",
    "Deployment",
    "gitlab_runbooks",
    "team_cheatsheet.yaml",
    0.94,
    refs=["deployment_db_engines", "deployment_production"],
)

add(
    "onboarding_gitlab_member",
    "How do I add a new team member to the GitLab group?",
    "Go to Group Settings > Members > Invite Members, enter the person's email address, select the role (Developer "
    "for engineers, Reporter for PMs) and set an expiration date (365 days by default). An invitation email is sent "
    "to the new member.",
    "Onboarding",
    "gitlab_runbooks",
    "team_cheatsheet.yaml",
    0.93,
    refs=["onboarding_branch_naming", "onboarding_prod_access"],
)

add(
    "troubleshooting_sev1",
    "How do I declare a SEV1 incident?",
    "Use the `/incident declare` command in Slack or call the emergency hotline at extension 4911. Provide the "
    "affected service, the symptoms observed, the approximate start time and any known recent changes.",
    "Troubleshooting",
    "gitlab_runbooks",
    "incident_response.yaml",
    0.95,
    refs=["troubleshooting_incident_comms", "deployment_rollback"],
)

add(
    "troubleshooting_incident_comms",
    "What is the incident communication template?",
    "Post to #platform-incidents in the form: \"SEV<level>: <brief description>. Impact: <user-facing impact>. "
    "Investigating: <team/engineer>. Next update: <time>\", using roughly 30 minutes for SEV1 and 1 hour for SEV2. "
    "Post subsequent updates in the same thread.",
    "Troubleshooting",
    "gitlab_runbooks",
    "incident_response.yaml",
    0.95,
    refs=["troubleshooting_sev1", "troubleshooting_alerting"],
)

# ---------------------------------------------------------------- ownCloud documentation
add(
    "deployment_db_engines",
    "What database engines are supported?",
    "PostgreSQL 14.x, 15.x and 16.x (recommended), MySQL 8.0.x (InnoDB engine required), and SQL Server 2019 and "
    "2022 (Enterprise tier only).",
    "Deployment",
    "owncloud_docs",
    "spec_sheet_v2.txt",
    0.97,
    refs=["deployment_hardware", "deployment_db_pooling", "deployment_backup_schedule"],
)

add(
    "deployment_hardware",
    "What are the minimum hardware requirements for self-hosted deployment?",
    "Minimum: 4 vCPUs (x86_64 or ARM64), 8 GB RAM (16 GB recommended for production), 50 GB SSD for the application "
    "plus additional storage for attachments, and a 1 Gbps low-latency network connection to the database.",
    "Deployment",
    "owncloud_docs",
    "spec_sheet_v2.txt",
    0.97,
    refs=["deployment_os", "deployment_db_engines", "deployment_docker_compose"],
)

add(
    "deployment_os",
    "What operating systems are supported?",
    "Ubuntu 20.04, 22.04 and 24.04 LTS; RHEL 8.x and 9.x plus compatible derivatives (Rocky Linux, AlmaLinux); "
    "Debian 11 (Bullseye) and 12 (Bookworm); and container deployment via Docker 24+ or Kubernetes 1.27+.",
    "Deployment",
    "owncloud_docs",
    "spec_sheet_v2.txt",
    0.97,
    refs=["deployment_hardware", "deployment_docker_compose", "deployment_kubernetes"],
)

add(
    "deployment_sla",
    "What is the SLA uptime guarantee?",
    "The Free tier is best effort with no SLA. Professional provides 99.5% uptime and Enterprise provides 99.95% "
    "uptime with financial credits for a breach. All SLAs are measured on a calendar-month basis, excluding "
    "scheduled maintenance windows.",
    "Deployment",
    "owncloud_docs",
    "spec_sheet_v2.txt",
    0.96,
    refs=["troubleshooting_slo_violation", "billing_upgrade_plan"],
)

add(
    "deployment_release_420",
    "What's new in v4.2.0?",
    "v4.2.0 (2025-03-01) added bulk user import via CSV upload (maximum 10,000 users per import), role-based access "
    "control with custom role definitions, enhanced search with fuzzy matching and typo tolerance, and audit log "
    "export to S3-compatible storage.",
    "Deployment",
    "owncloud_docs",
    "release_notes_2025.txt",
    0.96,
    refs=["deployment_release_410", "api_release_400_breaking", "security_audit_logging"],
)

add(
    "deployment_release_410",
    "What was added in v4.1.0?",
    "v4.1.0 (2025-02-01) added WebSocket-based real-time notifications for deployment events, multi-region failover "
    "for Enterprise customers, SAML metadata auto-refresh for identity provider certificate rotation, and a "
    "customizable widget layout on the dashboard.",
    "Deployment",
    "owncloud_docs",
    "release_notes_2025.txt",
    0.96,
    refs=["deployment_release_420", "auth_sso_corporate"],
)

add(
    "api_release_400_breaking",
    "What breaking changes were introduced in v4.0.0?",
    "v4.0.0 (2025-01-06) deprecated API v1 endpoints (sunset date 2026-07-06), replaced the legacy webhook format "
    "with JSON Schema v2 payloads, raised the minimum TLS version to 1.2 (TLS 1.0/1.1 removed), and ended support "
    "for the Python 3.7 and 3.8 SDKs.",
    "API",
    "owncloud_docs",
    "release_notes_2025.txt",
    0.96,
    refs=["api_versioning", "integrations_webhook_setup", "deployment_release_420"],
)

add(
    "deployment_rabbitmq",
    "Why did we choose RabbitMQ over Kafka for the task queue?",
    "RabbitMQ was selected for its mature AMQP 0-9-1 support, flexible routing with exchanges and bindings, and lower "
    "operational complexity for a workload pattern based on task distribution with individual acknowledgment. Kafka "
    "was considered but judged overengineered for throughput requirements below 10,000 messages per second and would "
    "have added unnecessary operational burden.",
    "Deployment",
    "owncloud_docs",
    "architecture_decision_records.md",
    0.93,
    refs=["deployment_db_pooling", "deployment_health_checks"],
)

add(
    "api_versioning",
    "How are breaking API changes managed?",
    "Breaking changes are introduced only in new major API versions (for example /v1/ to /v2/). Each major version "
    "is supported for a minimum of 18 months after its successor is released. Deprecation notices are communicated "
    "through the Sunset and Deprecation response headers and by email to API token owners 6 months before "
    "end-of-life.",
    "API",
    "owncloud_docs",
    "architecture_decision_records.md",
    0.95,
    refs=["api_release_400_breaking", "api_rate_limits"],
)

add(
    "integrations_webhook_setup",
    "How do I configure webhook notifications?",
    "Open Developer Settings > Webhooks and click \"Add Webhook\". Provide the target URL, select the events to "
    "subscribe to (at minimum deployment.completed and build.failed), and optionally set a secret token for payload "
    "signature verification. The platform sends a test ping to validate the endpoint; the endpoint must answer the "
    "challenge-response handshake within 5 seconds or the webhook is not created. Payloads are signed with HMAC-SHA256 "
    "using the provided secret.",
    "Integrations",
    "owncloud_docs",
    "product_manual_q1.pdf",
    0.95,
    merged=[
        {"source": "googledocs", "source_file": "sme_comments.pdf", "reference": "challenge-response handshake"}
    ],
    refs=["integrations_webhook_not_firing", "integrations_available", "api_release_400_breaking"],
)

add(
    "api_payload_size",
    "What is the maximum payload size for API requests?",
    "The maximum request payload is 10 MB for REST API calls. For file uploads through the Assets API the limit is "
    "250 MB per file. Requests exceeding these limits return HTTP 413 (Payload Too Large).",
    "API",
    "owncloud_docs",
    "product_manual_q1.pdf",
    0.96,
    refs=["api_http_methods", "api_pagination"],
)

add(
    "security_audit_logging",
    "How do I enable audit logging?",
    "Audit logging is available on Enterprise plans. Go to Settings > Security > Audit Logs, enable \"Detailed "
    "Activity Logging\" and select the event categories to capture: Authentication Events, API Access, Configuration "
    "Changes and Data Export. Audit logs are retained for 90 days by default and can be extended to 365 days on "
    "request.",
    "Security",
    "owncloud_docs",
    "product_manual_q1.pdf",
    0.95,
    refs=["security_data_residency", "deployment_release_420"],
)

add(
    "onboarding_quick_start",
    "How do new users get started with the platform?",
    "After account creation, complete the Quick Start wizard from the dashboard welcome banner. The wizard walks "
    "through connecting a source repository, configuring the first deployment pipeline and inviting team members; it "
    "takes about 15 minutes.",
    "Onboarding",
    "owncloud_docs",
    "internal_faq_draft_v2.txt",
    0.94,
    refs=["integrations_available", "onboarding_local_dev_env", "deployment_staging"],
)

add(
    "integrations_available",
    "What integrations are available out of the box?",
    "Native integrations are available for GitHub, GitLab, Bitbucket, Slack, Jira, PagerDuty, Datadog and Splunk. "
    "More than 200 community and partner integrations are listed in the Integration Marketplace, and custom "
    "integrations can be built with the Webhook API and the Platform SDK.",
    "Integrations",
    "owncloud_docs",
    "internal_faq_draft_v2.txt",
    0.94,
    refs=["integrations_webhook_setup", "integrations_webhook_not_firing", "onboarding_quick_start"],
)

add(
    "security_data_residency",
    "How does the platform handle data residency requirements?",
    "Enterprise customers select a data residency region during onboarding. Available regions are US (us-east-1, "
    "us-west-2), EU (eu-central-1, eu-west-1) and APAC (ap-southeast-1, ap-northeast-1). Data at rest is encrypted "
    "with AES-256 and data in transit uses TLS 1.2 or later. Customer data never leaves the selected region except "
    "for explicit cross-region replication configured by the customer.",
    "Security",
    "owncloud_docs",
    "internal_faq_draft_v2.txt",
    0.94,
    refs=["security_audit_logging", "auth_multi_org"],
)

# ---------------------------------------------------------------- Service desk tickets
add(
    "api_token_403_post",
    "Why does my API token return 403 Forbidden for POST requests when GET works?",
    "The API token most likely has read-only scope. Go to Account Settings > API Tokens, edit the token and enable "
    "the 'write' scope. Tokens created before v4.0 defaulted to read-only scope, so older tokens commonly need this "
    "change.",
    "API",
    "owncloud_tickets",
    "resolved_tickets_2025q1.csv",
    0.92,
    merged=[{"source": "owncloud_tickets", "source_file": "resolved_tickets_2025q1.csv", "reference": "TKT-1002"}],
    refs=["api_authenticate_requests", "api_rate_limit_exceeded"],
)

add(
    "auth_sso_redirect_loop",
    "After enabling SSO, users get stuck in an infinite redirect loop between the IdP and the login page.",
    "This usually indicates a SAML assertion mismatch. Verify that the NameID format in your identity provider "
    "matches what the platform expects (emailAddress), and check that the Assertion Consumer Service URL configured "
    "in the IdP matches the platform metadata exactly. Also confirm the SSO callback URL uses the v4.2.0 format "
    "https://app.platform.example.com/auth/sso/callback?provider=<idp_id>.",
    "Authentication",
    "owncloud_tickets",
    "resolved_tickets_2025q1.csv",
    0.92,
    merged=[
        {"source": "owncloud_tickets", "source_file": "resolved_tickets_2025q1.csv", "reference": "TKT-1003"},
        {"source": "googledocs", "source_file": "editorial_review_notes.md", "reference": "SSO redirect URI correction"},
    ],
    refs=["auth_sso_corporate", "auth_sso_enforced_login"],
)

add(
    "troubleshooting_slow_dashboard",
    "The main dashboard takes over 30 seconds to load for users with many projects.",
    "The dashboard aggregates data across all projects. For users with 50 or more projects, enable the \"Lazy Load\" "
    "option under User Preferences > Dashboard, which loads project data on demand as sections are expanded.",
    "Troubleshooting",
    "owncloud_tickets",
    "resolved_tickets_2025q1.csv",
    0.9,
    merged=[{"source": "owncloud_tickets", "source_file": "resolved_tickets_2025q1.csv", "reference": "TKT-1004"}],
    refs=["troubleshooting_metrics", "troubleshooting_db_cpu"],
)

add(
    "integrations_webhook_not_firing",
    "My webhook for deployment.completed never fires when deployments finish.",
    "First check that the webhook is enabled in the webhook settings. Then verify that the event filter includes "
    "'deployment.completed'. By default the webhook only fires for successful deployments; enable \"Include Failed "
    "Deployments\" if failed deployments should also trigger it. If the configuration looks correct, confirm that the "
    "endpoint answers the initial challenge-response validation within 5 seconds.",
    "Integrations",
    "owncloud_tickets",
    "resolved_tickets_2025q1.csv",
    0.92,
    merged=[
        {"source": "owncloud_tickets", "source_file": "resolved_tickets_2025q1.csv", "reference": "TKT-1005"},
        {"source": "googledocs", "source_file": "sme_comments.pdf", "reference": "handshake timeout"},
    ],
    refs=["integrations_webhook_setup", "integrations_available"],
)

add(
    "billing_invoice_amount",
    "Why is my invoice higher than my plan price?",
    "The plan price is the base charge. Additional line items can come from extra API requests beyond plan limits, "
    "additional storage beyond the allocation, or add-on services. Open Account Settings > Billing > Invoice History "
    "for an itemized breakdown of the invoice.",
    "Billing",
    "owncloud_tickets",
    "resolved_tickets_2025q1.csv",
    0.92,
    merged=[{"source": "owncloud_tickets", "source_file": "resolved_tickets_2025q1.csv", "reference": "TKT-1006"}],
    refs=["billing_invoices", "billing_spending_limit", "billing_contact"],
)

add(
    "deployment_docker_137",
    "My Docker deployment starts but the container exits immediately with code 137.",
    "Exit code 137 means the container was killed by the OOM (out of memory) killer. Allocate at least 2 GB of memory "
    "to the container by raising the memory limit in the Docker configuration, and add a swap file if the host is "
    "memory constrained.",
    "Deployment",
    "owncloud_tickets",
    "resolved_tickets_2025q1.csv",
    0.93,
    merged=[{"source": "owncloud_tickets", "source_file": "resolved_tickets_2025q1.csv", "reference": "TKT-1007"}],
    refs=["deployment_docker_compose", "deployment_hardware"],
)

add(
    "sec_ssl_validation",
    "My custom SSL certificate was accepted but browsers show a certificate validation error.",
    "The three most common causes are: (1) the intermediate certificate chain is missing, so the certificate bundle "
    "must include all intermediate CA certificates; (2) the certificate is issued for a different domain than the one "
    "configured; (3) the private key does not match the certificate. An SSL checker tool will identify which of these "
    "applies.",
    "Security",
    "owncloud_tickets",
    "resolved_tickets_2025q1.csv",
    0.92,
    merged=[{"source": "owncloud_tickets", "source_file": "resolved_tickets_2025q1.csv", "reference": "TKT-1008"}],
    refs=["sec_custom_ssl_upload", "sec_wildcard_cert"],
)

add(
    "api_cicd_rate_limits",
    "Our CI/CD pipeline hits API rate limits during peak integration test runs.",
    "Reduce concurrent API pressure by staggering test suites with a one-second delay between API calls, or upgrade "
    "to the Enterprise plan for higher rate limits (including the option to request custom limits above 6,000 RPM).",
    "API",
    "owncloud_tickets",
    "triage_decisions.json",
    0.89,
    merged=[{"source": "owncloud_tickets", "source_file": "triage_decisions.json", "reference": "TKT-1009"}],
    refs=["api_rate_limits", "api_rate_limit_exceeded", "api_rate_limit_status"],
)

add(
    "api_export_timeout",
    "Exporting a large analytics dataset times out after 5 minutes.",
    "Synchronous exports time out after 5 minutes. Use the Async Export API endpoint instead: it returns a job ID "
    "that can be polled for completion status. For datasets exceeding 5 million rows, contact support to schedule a "
    "manual export.",
    "API",
    "owncloud_tickets",
    "triage_decisions.json",
    0.89,
    merged=[{"source": "owncloud_tickets", "source_file": "triage_decisions.json", "reference": "TKT-1010"}],
    refs=["api_pagination", "api_authenticate_requests"],
)

add(
    "auth_mfa_lost",
    "I lost access to my authenticator app after replacing my phone and cannot log in to disable 2FA.",
    "Use one of the recovery codes issued during 2FA setup to regain access. If the recovery codes are also lost, an "
    "account administrator can disable 2FA from the admin panel. For accounts without an administrator, identity "
    "verification with a government ID is required before 2FA can be reset.",
    "Authentication",
    "owncloud_tickets",
    "triage_decisions.json",
    0.91,
    merged=[{"source": "owncloud_tickets", "source_file": "triage_decisions.json", "reference": "TKT-1011"}],
    refs=["auth_enable_2fa", "auth_password_reset", "auth_invalid_credentials"],
)

# ---------------------------------------------------------------- Google Docs drafts
add(
    "auth_create_account",
    "How do I create a new account?",
    "Visit the signup page at https://app.platform.example.com/signup, enter your work email address, choose a "
    "password of at least 12 characters containing uppercase and lowercase letters, a digit and a special character, "
    "and accept the Terms of Service. Click the verification link in the email within 24 hours to activate the "
    "account, after which you can set up the organization profile and invite team members.",
    "Authentication",
    "googledocs",
    "faq_section_login.docx",
    0.95,
    refs=["auth_social_login", "auth_multi_org", "onboarding_quick_start", "auth_password_reset"],
)

add(
    "auth_social_login",
    "Can I sign up using my Google or GitHub account?",
    "Yes. On the signup page click \"Continue with Google\" or \"Continue with GitHub\" and authenticate with the "
    "selected provider. On first login you are prompted to set up your organization profile. Organizations that "
    "enforce SSO may restrict social login options.",
    "Authentication",
    "googledocs",
    "faq_section_login.docx",
    0.95,
    refs=["auth_create_account", "auth_sso_corporate"],
)

add(
    "auth_sso_enforced_login",
    "I can't log in after my company enforced SSO. What should I do?",
    "When an organization enforces SSO, existing password-based accounts are linked to the SSO identity by email "
    "address. Sign in with the \"Sign in with SSO\" button using your corporate credentials. If you get an error, "
    "your IT administrator may need to add your account to the SSO provisioning group; contact your internal "
    "helpdesk for assistance.",
    "Authentication",
    "googledocs",
    "faq_section_login.docx",
    0.95,
    refs=["auth_sso_corporate", "auth_sso_redirect_loop", "auth_invalid_credentials"],
)

add(
    "auth_multi_org",
    "How do I manage multiple organization memberships?",
    "If you belong to more than one organization, an organization switcher appears in the top-left corner of the "
    "dashboard after login. Use it to switch organizations; each keeps separate settings, projects and billing. A "
    "single account can be a member of up to 10 organizations.",
    "Authentication",
    "googledocs",
    "faq_section_login.docx",
    0.95,
    refs=["auth_create_account", "security_data_residency"],
)

add(
    "billing_payment_fails",
    "What happens if my payment fails?",
    "You receive an email notification immediately and the system retries the payment after 3 days. If the retry also "
    "fails, the account enters a 7-day grace period during which all features remain available; after that, write "
    "access is restricted until the payment is resolved. The payment method can be updated at any time under Account "
    "Settings > Billing > Payment Methods.",
    "Billing",
    "googledocs",
    "faq_section_payments.txt",
    0.95,
    refs=["billing_payment_methods", "billing_spending_limit", "billing_invoice_amount"],
)

add(
    "billing_annual_switch",
    "Can I switch from monthly to annual billing?",
    "Yes. In Account Settings > Billing > Plan Details select \"Switch to Annual Billing\". The annual rate is charged "
    "immediately, remaining days on the monthly plan are credited toward the annual amount, and annual billing "
    "carries a 15% discount compared with monthly billing.",
    "Billing",
    "googledocs",
    "faq_section_payments.txt",
    0.95,
    refs=["billing_upgrade_plan", "billing_free_trial"],
)

add(
    "billing_contact",
    "How do I add or change the billing contact?",
    "Go to Account Settings > Billing > Billing Contacts and click \"Add Contact\" to add a contact by email address. "
    "To change the primary contact, select the desired contact and click \"Set as Primary\". The primary contact "
    "receives all invoices, payment receipts and billing-related notifications.",
    "Billing",
    "googledocs",
    "faq_section_payments.txt",
    0.95,
    refs=["billing_invoices", "billing_invoice_amount"],
)

add(
    "billing_spending_limit",
    "Is there a spending limit I can set?",
    "Yes. For usage-based charges such as extra API requests and additional storage, set a monthly spending cap in "
    "Account Settings > Billing > Spending Limits. When the cap is reached, usage-based features are throttled rather "
    "than billed further, and warning notifications are sent at 50%, 80% and 100% of the cap.",
    "Billing",
    "googledocs",
    "faq_section_payments.txt",
    0.95,
    refs=["billing_payment_methods", "billing_invoice_amount", "api_rate_limits"],
)

# ---------------------------------------------------------------- ownCloud tech_pubs
add(
    "api_authenticate_requests",
    "How do I authenticate API requests?",
    "All API requests require an authentication token in the Authorization header: `Authorization: Bearer <token>`. "
    "Tokens are generated from Account Settings > API Tokens and can be scoped to specific permissions (read, write, "
    "admin). Tokens expire after 90 days of inactivity.",
    "API",
    "owncloud_docs",
    "api_reference.md",
    0.96,
    refs=["api_http_methods", "api_token_403_post", "api_rate_limits"],
)

add(
    "api_http_methods",
    "What HTTP methods are supported?",
    "GET retrieves resources, POST creates them, PUT performs a full update, PATCH a partial update and DELETE "
    "removes them. All endpoints return JSON, and request bodies for POST, PUT and PATCH must use "
    "Content-Type: application/json.",
    "API",
    "owncloud_docs",
    "api_reference.md",
    0.96,
    refs=["api_authenticate_requests", "api_pagination", "api_payload_size"],
)

add(
    "api_pagination",
    "How do I paginate through large result sets?",
    "All list endpoints support cursor-based pagination. Pass `?limit=N` (maximum 100) to control page size; the "
    "response includes a `next_cursor` field and a `has_more` boolean. Send the cursor value as `?cursor=<value>` in "
    "the next request to fetch the following page.",
    "API",
    "owncloud_docs",
    "api_reference.md",
    0.96,
    refs=["api_http_methods", "api_export_timeout"],
)

add(
    "deployment_docker_compose",
    "How do I deploy using Docker Compose?",
    "1) Download `docker-compose.yml` from the releases page. 2) Create a `.env` file with the required environment "
    "variables. 3) Run `docker compose up -d`. 4) Access the application at http://localhost:8080. 5) Run the health "
    "check `curl http://localhost:8080/healthz`.",
    "Deployment",
    "owncloud_docs",
    "deployment_guide.rst",
    0.95,
    refs=["deployment_kubernetes", "deployment_docker_137", "deployment_hardware"],
)

add(
    "deployment_kubernetes",
    "How do I deploy on Kubernetes?",
    "An official Helm chart is published at helm.platform.example.com. Add the repository with "
    "`helm repo add platform https://charts.platform.example.com` and install with "
    "`helm install my-deployment platform/platform-stack`.",
    "Deployment",
    "owncloud_docs",
    "deployment_guide.rst",
    0.95,
    refs=["deployment_docker_compose", "deployment_health_checks", "deployment_os"],
)

add(
    "deployment_db_pooling",
    "How do I configure database connection pooling?",
    "Set the following environment variables: `DB_POOL_SIZE` is the maximum number of connections in the pool "
    "(default 20), `DB_POOL_TIMEOUT` is the number of seconds to wait for a connection (default 30), and "
    "`DB_POOL_IDLE_TIMEOUT` is the number of seconds before idle connections are closed (default 300).",
    "Deployment",
    "owncloud_docs",
    "deployment_guide.rst",
    0.95,
    refs=["troubleshooting_502", "troubleshooting_db_cpu", "deployment_db_engines"],
)

add(
    "deployment_blue_green_canary",
    "What is the difference between blue-green and canary deployments?",
    "Blue-green deployments run two complete environments and switch traffic between them at once. Canary deployments "
    "gradually shift a percentage of traffic to the new version. The platform defaults to canary for production and "
    "blue-green for staging.",
    "Deployment",
    "owncloud_docs",
    "orchestration_guide.md",
    0.95,
    refs=["deployment_production", "deployment_staging", "deployment_health_checks"],
)

add(
    "deployment_health_checks",
    "How do I add custom health checks to my deployment?",
    "Define health check endpoints in `deploy.yaml` under the `health_checks` section. The platform supports HTTP, "
    "TCP and command-based health checks with configurable intervals, timeouts and retry counts.",
    "Deployment",
    "owncloud_docs",
    "orchestration_guide.md",
    0.95,
    refs=["deployment_kubernetes", "deployment_production", "deployment_blue_green_canary"],
)

add(
    "troubleshooting_metrics",
    "What metrics should I monitor for the platform?",
    "Application: request rate, error rate, latency (p50/p95/p99) and active connections. Infrastructure: CPU "
    "utilization, memory usage, disk I/O and network throughput. Database: connection pool utilization, query "
    "latency, replication lag and deadlocks. Business: active users, feature adoption rates and API token usage.",
    "Troubleshooting",
    "owncloud_docs",
    "monitoring_best_practices.md",
    0.95,
    refs=["troubleshooting_alerting", "troubleshooting_slo_violation", "troubleshooting_db_cpu"],
)

add(
    "troubleshooting_alerting",
    "How do I set up alerting?",
    "Configure alerts in your monitoring system with these thresholds: API error rate above 1% for 5 minutes pages "
    "the on-call engineer; p99 latency above 1 second for 10 minutes creates an incident ticket; disk usage above 85% "
    "sends a warning notification; database replication lag above 30 seconds pages on-call; certificate expiry within "
    "7 days emails the security team.",
    "Troubleshooting",
    "owncloud_docs",
    "monitoring_best_practices.md",
    0.95,
    refs=["troubleshooting_metrics", "troubleshooting_slo_violation", "troubleshooting_sev1"],
)

add(
    "troubleshooting_log_levels",
    "What logging levels should I use?",
    "ERROR for application errors requiring immediate attention, WARN for degraded functionality or approaching "
    "limits, INFO for normal operational events such as deployments and user signups, and DEBUG for detailed "
    "diagnostics (disabled in production). All logs must be structured as JSON with at minimum timestamp, level, "
    "service, trace_id and message.",
    "Troubleshooting",
    "owncloud_docs",
    "monitoring_best_practices.md",
    0.95,
    refs=["troubleshooting_kibana", "troubleshooting_metrics"],
)

add(
    "troubleshooting_slo_violation",
    "What happens when an SLO is violated?",
    "An incident is automatically created in the on-call rotation. The error budget burn rate is calculated and alerts "
    "are sent to the platform-eng Slack channel.",
    "Troubleshooting",
    "owncloud_docs",
    "service_level_targets.yaml",
    0.94,
    refs=["troubleshooting_slo_review", "deployment_sla", "troubleshooting_alerting"],
)

add(
    "troubleshooting_slo_review",
    "How often are SLOs reviewed?",
    "SLOs are reviewed quarterly by the platform reliability team. Any adjustment requires approval from the VP of "
    "Engineering.",
    "Troubleshooting",
    "owncloud_docs",
    "service_level_targets.yaml",
    0.94,
    refs=["troubleshooting_slo_violation", "deployment_sla"],
)


# ---------------------------------------------------------------- Assembly
def build() -> dict:
    # deterministic ids
    id_of = {}
    for key, item in E.items():
        norm = re.sub(r"\s+", " ", item["question"].strip().lower())
        id_of[key] = "faq-" + str(uuid.uuid5(UUID_NS, norm))

    entries = []
    for key, item in E.items():
        cross = [id_of[r] for r in item["refs"] if r in id_of and r != key]
        entry = {
            "id": id_of[key],
            "question": item["question"],
            "answer": item["answer"],
            "topic": item["topic"],
            "source": item["source"],
            "source_file": item["source_file"],
            "cross_references": cross,
            "confidence": item["confidence"],
        }
        if item["merged"]:
            entry["contributing_sources"] = item["merged"]
        entries.append(entry)

    entries.sort(key=lambda e: (e["topic"], e["question"].lower()))

    topics = {}
    for e in entries:
        topics[e["topic"]] = topics.get(e["topic"], 0) + 1

    sources = {}
    for e in entries:
        sources[e["source"]] = sources.get(e["source"], 0) + 1

    doc_counts = {}
    for item in E.values():
        doc_counts[item["source_file"]] = doc_counts.get(item["source_file"], 0) + 1

    return {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source_platforms": [
                "confluence",
                "owncloud_tickets",
                "gitlab_runbooks",
                "googledocs",
                "owncloud_docs",
            ],
            "total_entries": len(entries),
            "topic_distribution": dict(sorted(topics.items(), key=lambda kv: (-kv[1], kv[0]))),
            "source_distribution": dict(sorted(sources.items())),
            "source_documents": dict(sorted(doc_counts.items())),
            "schema_version": "1.0",
            "deduplication": {
                "method": "normalized question similarity with manual review of near-duplicate clusters",
                "clusters_merged": 1,
                "entries_removed_by_merge": 1,
                "merged_cluster": (
                    "Password reset: Confluence authentication article merged with service desk ticket TKT-1001"
                ),
                "enrichments_applied": sum(
                    1
                    for i in E.values()
                    if any(
                        "editorial_review_notes" in m["source_file"] or "sme_comments" in m["source_file"]
                        for m in i["merged"]
                    )
                ),
                "entries_with_ticket_provenance": sum(
                    1
                    for i in E.values()
                    if any(m.get("reference", "").startswith("TKT-") for m in i["merged"])
                ),
                "provenance_field": (
                    "contributing_sources records the ticket reference or additional documents that fed an entry"
                ),
            },
            "exclusion_policy": {
                "summary": (
                    "Non-FAQ business records and restricted material were excluded from the corpus. "
                    "Categories: executive/board material, HR records containing employee PII, "
                    "unredacted customer ticket data, credentials and production configuration, "
                    "privileged legal drafts, and security assessment reports."
                ),
                "documents_excluded": 12,
                "entries_withheld_on_security_review": 2,
            },
            "security_review_applied": [
                "Cipher-suite enumeration omitted from the SSL/TLS entry per security engineering review.",
                "Database sharding implementation details omitted per security engineering review.",
                "No credentials, PII, board, M&A or legal material included.",
            ],
        },
        "faq_entries": entries,
    }


if __name__ == "__main__":
    payload = build()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH} with {payload['metadata']['total_entries']} entries")
    print(json.dumps(payload["metadata"]["topic_distribution"], indent=2))
