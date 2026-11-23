#!/usr/bin/env python3
"""Build the consolidated FAQ knowledge-base artifact.

Only knowledge-base Q&A material is emitted. Credential, PII, compensation,
board/M&A, privileged legal, and vulnerability-report sources are excluded and
recorded in output/exclusion_register.json.
"""

from __future__ import annotations

import json
import re
import uuid
from collections import Counter
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output"

NAMESPACE = uuid.UUID("6f1c2a4e-8b7d-5c3a-9e2f-0a1b2c3d4e5f")

TOPICS = {
    "Authentication",
    "Networking",
    "Billing",
    "API",
    "Deployment",
    "Troubleshooting",
    "Onboarding",
    "Security",
    "Integrations",
}

# key, question, answer, topic, platform, source_file, confidence,
# contributing sources, cross-reference keys
ENTRIES = [
    # ---------------------------------------------------------------- Authentication
    dict(
        key="auth_password_reset",
        q="How do I reset my platform password?",
        a=(
            'Navigate to the login page and click "Forgot Password". Enter your registered email '
            "address; a reset link valid for 30 minutes is sent. Click the link, enter a new password "
            "(minimum 12 characters with uppercase, lowercase, digit, and special character), and "
            "confirm; the password updates immediately. If the email does not arrive, check the spam "
            "folder first, verify the email address on the account, and note that the link expires "
            "after 30 minutes. If the issue persists, an administrator can trigger a manual reset "
            "from the user management panel."
        ),
        topic="Authentication",
        source="confluence",
        file="confluence_export/kb_public/authentication_troubleshooting.md",
        conf=0.97,
        also=[("owncloud_tickets", "owncloud/exports/resolved_tickets_2025q1.csv")],
        refs=["auth_invalid_credentials", "auth_2fa"],
    ),
    dict(
        key="auth_invalid_credentials",
        q='Why am I getting "Invalid Credentials" after resetting my password?',
        a=(
            '"Invalid Credentials" after a reset is usually caused by cached old credentials. Clear '
            "the browser cache and cookies and try again. Verify Caps Lock is off and that the correct "
            "email address is being used. The system locks accounts for 15 minutes after 5 failed "
            "attempts."
        ),
        topic="Authentication",
        source="confluence",
        file="confluence_export/kb_public/authentication_troubleshooting.md",
        conf=0.97,
        also=[],
        refs=["auth_password_reset"],
    ),
    dict(
        key="auth_2fa",
        q="How do I enable Two-Factor Authentication (2FA)?",
        a=(
            'Go to Account Settings > Security > Two-Factor Authentication and click "Enable 2FA". '
            "Choose an authenticator app (recommended) or SMS verification. Scan the QR code or enter "
            "the phone number, then enter the verification code to confirm. Download and store the "
            "recovery codes securely; they are required if the device is lost."
        ),
        topic="Authentication",
        source="confluence",
        file="confluence_export/kb_public/authentication_troubleshooting.md",
        conf=0.97,
        also=[],
        refs=["auth_2fa_lost"],
    ),
    dict(
        key="auth_2fa_lost",
        q="I lost my phone or authenticator app and cannot log in. How do I recover my account?",
        a=(
            "Use a recovery code to regain access; recovery codes are issued during 2FA setup. If the "
            "recovery codes are also lost, an account administrator can disable 2FA from the admin "
            "panel. For accounts without an administrator, identity verification using a government ID "
            "is required to reset 2FA."
        ),
        topic="Authentication",
        source="owncloud_tickets",
        file="owncloud/exports/triage_decisions.json",
        conf=0.93,
        also=[],
        refs=["auth_2fa"],
    ),
    dict(
        key="auth_sso",
        q="Can I use Single Sign-On (SSO) with my corporate identity provider?",
        a=(
            "Yes. The platform supports SAML 2.0 and OIDC-based SSO. An organization's IT administrator "
            'configures the identity provider integration; once configured, users in that domain see a '
            '"Sign in with SSO" button on the login page.'
        ),
        topic="Authentication",
        source="confluence",
        file="confluence_export/kb_public/authentication_troubleshooting.md",
        conf=0.97,
        also=[],
        refs=["auth_sso_redirect", "auth_sso_enforced", "auth_sso_redirect_uri"],
    ),
    dict(
        key="auth_sso_redirect",
        q="Why is my SSO login stuck in an infinite redirect loop?",
        a=(
            "An infinite redirect between the IdP and the login page usually indicates a SAML assertion "
            "mismatch. Verify that the NameID format in the IdP matches the platform expectation "
            "(emailAddress), and confirm that the Assertion Consumer Service (ACS) URL in the IdP "
            "configuration matches the platform metadata exactly."
        ),
        topic="Authentication",
        source="owncloud_tickets",
        file="owncloud/exports/resolved_tickets_2025q1.csv",
        conf=0.93,
        also=[],
        refs=["auth_sso", "auth_sso_redirect_uri"],
    ),
    dict(
        key="auth_sso_enforced",
        q="I cannot log in after my company enforced SSO. What should I do?",
        a=(
            "When an organization enforces SSO, existing password-based accounts are linked to the SSO "
            'identity by email address. Sign in with the "Sign in with SSO" button using corporate '
            "credentials. If an error occurs, the IT administrator may need to add the account to the "
            "SSO provisioning group; otherwise contact the internal helpdesk."
        ),
        topic="Authentication",
        source="googledocs",
        file="googledocs_exports/faq_section_login.docx",
        conf=0.95,
        also=[],
        refs=["auth_sso"],
    ),
    dict(
        key="auth_sso_redirect_uri",
        q="What redirect URI should I configure for SSO?",
        a=(
            "As of v4.2.0 the SSO redirect URI format is "
            "`https://app.platform.example.com/auth/sso/callback?provider=<idp_id>`. The previous "
            "format (`/auth/callback/sso`) is outdated."
        ),
        topic="Authentication",
        source="googledocs",
        file="googledocs_exports/editorial_review_notes.md",
        conf=0.88,
        also=[],
        refs=["auth_sso", "auth_sso_redirect"],
    ),
    dict(
        key="auth_signup",
        q="How do I create a new account?",
        a=(
            "Visit https://app.platform.example.com/signup, enter a work email address, choose a "
            "password (minimum 12 characters with uppercase, lowercase, digit, and special character), "
            "and accept the Terms of Service. A verification email is sent; click the link within 24 "
            "hours to activate the account. After activation, set up the organization profile and "
            "invite team members."
        ),
        topic="Authentication",
        source="googledocs",
        file="googledocs_exports/faq_section_login.docx",
        conf=0.95,
        also=[],
        refs=["auth_social", "onboard_start"],
    ),
    dict(
        key="auth_social",
        q="Can I sign up using my Google or GitHub account?",
        a=(
            'Yes. On the signup page choose "Continue with Google" or "Continue with GitHub" and '
            "authenticate with the provider. On first login, complete the organization profile. "
            "SSO-managed organizations may restrict social login options."
        ),
        topic="Authentication",
        source="googledocs",
        file="googledocs_exports/faq_section_login.docx",
        conf=0.95,
        also=[],
        refs=["auth_signup", "auth_sso"],
    ),
    dict(
        key="auth_orgs",
        q="How do I manage multiple organization memberships?",
        a=(
            "If you belong to multiple organizations, an organization switcher appears in the top-left "
            "corner of the dashboard after login. Each organization keeps separate settings, projects, "
            "and billing. A single account can belong to up to 10 organizations."
        ),
        topic="Authentication",
        source="googledocs",
        file="googledocs_exports/faq_section_login.docx",
        conf=0.95,
        also=[],
        refs=["billing_upgrade"],
    ),
    # --------------------------------------------------------------------- Networking
    dict(
        key="net_timeouts",
        q="How do I troubleshoot connection timeouts to the API?",
        a=(
            "Verify connectivity with `ping api.platform.example.com`. If ping succeeds but API calls "
            "time out, check whether a firewall or proxy blocks outbound HTTPS on port 443, and confirm "
            "DNS resolution with `nslookup api.platform.example.com`. For persistent issues, collect a "
            "HAR file from the browser developer tools and attach it to a support ticket."
        ),
        topic="Networking",
        source="confluence",
        file="confluence_export/kb_public/network_diagnostics.md",
        conf=0.97,
        also=[],
        refs=["net_whitelist", "api_rate_limits"],
    ),
    dict(
        key="net_whitelist",
        q="What IP ranges should I whitelist for platform access?",
        a=(
            "Whitelist these CIDR ranges: 203.0.113.0/24 (primary API and web), 203.0.114.0/24 "
            "(WebSocket connections), and 198.51.100.0/24 (file storage and CDN). Ranges may change "
            "with 30 days' notice via the status page."
        ),
        topic="Networking",
        source="confluence",
        file="confluence_export/kb_public/network_diagnostics.md",
        conf=0.97,
        also=[],
        refs=["net_timeouts"],
    ),
    dict(
        key="net_websockets",
        q="Why do WebSocket connections keep dropping?",
        a=(
            "WebSocket disconnections are commonly caused by load balancer timeouts, proxy limits, or "
            "NAT gateway idle timeouts. Allow persistent connections for at least 60 seconds of idle "
            "time. The platform sends WebSocket ping frames every 30 seconds to keep the connection "
            "alive."
        ),
        topic="Networking",
        source="confluence",
        file="confluence_export/kb_public/network_diagnostics.md",
        conf=0.97,
        also=[],
        refs=["net_timeouts"],
    ),
    # ------------------------------------------------------------------------- Billing
    dict(
        key="billing_upgrade",
        q="How do I upgrade my subscription plan?",
        a=(
            'Go to Account Settings > Billing > Plan Details, click "Change Plan", and select the '
            "desired tier. The price difference is prorated for the remainder of the billing cycle, and "
            "new features take effect immediately. Downgrades apply at the start of the next billing "
            "cycle."
        ),
        topic="Billing",
        source="confluence",
        file="confluence_export/kb_public/billing_and_subscriptions.html",
        conf=0.97,
        also=[],
        refs=["billing_invoices", "billing_payment_methods"],
    ),
    dict(
        key="billing_invoices",
        q="Where can I find my invoices?",
        a=(
            "Invoices are available under Account Settings > Billing > Invoice History, where PDF copies "
            "can be downloaded for any billing period. Invoices are also emailed to the billing contact "
            "on file within 24 hours of payment processing."
        ),
        topic="Billing",
        source="confluence",
        file="confluence_export/kb_public/billing_and_subscriptions.html",
        conf=0.97,
        also=[],
        refs=["billing_upgrade", "billing_invoice_amount", "billing_contact"],
    ),
    dict(
        key="billing_payment_methods",
        q="What payment methods are accepted?",
        a=(
            "Visa, Mastercard, American Express, and bank transfer (ACH/wire) for annual plans are "
            "accepted. Enterprise customers can also use purchase orders with Net-30 terms after credit "
            "approval. Payment methods are managed under Account Settings > Billing > Payment Methods."
        ),
        topic="Billing",
        source="confluence",
        file="confluence_export/kb_public/billing_and_subscriptions.html",
        conf=0.97,
        also=[],
        refs=["billing_payment_failed"],
    ),
    dict(
        key="billing_trial",
        q="How does the free trial work?",
        a=(
            "The 14-day free trial includes full access to all Professional plan features and does not "
            "require a credit card. Reminder emails are sent on day 7 and day 13. At the end of the "
            "trial the account is downgraded to the Free tier unless a payment method is added and a "
            "paid plan selected."
        ),
        topic="Billing",
        source="confluence",
        file="confluence_export/kb_public/billing_and_subscriptions.html",
        conf=0.97,
        also=[],
        refs=["billing_upgrade"],
    ),
    dict(
        key="billing_payment_failed",
        q="What happens if my payment fails?",
        a=(
            "A failed payment triggers an immediate email notification. The system retries after 3 "
            "days. If the second attempt fails, the account enters a 7-day grace period with all "
            "features available; afterwards write access is restricted until the payment is resolved. "
            "Update the payment method in Account Settings > Billing > Payment Methods."
        ),
        topic="Billing",
        source="googledocs",
        file="googledocs_exports/faq_section_payments.txt",
        conf=0.95,
        also=[],
        refs=["billing_payment_methods", "billing_spending_limit"],
    ),
    dict(
        key="billing_annual",
        q="Can I switch from monthly to annual billing?",
        a=(
            'In Account Settings > Billing > Plan Details, select "Switch to Annual Billing". The annual '
            "rate is charged immediately, and remaining days on the monthly plan are credited toward "
            "the annual amount. Annual billing provides a 15% discount versus monthly billing."
        ),
        topic="Billing",
        source="googledocs",
        file="googledocs_exports/faq_section_payments.txt",
        conf=0.95,
        also=[],
        refs=["billing_upgrade"],
    ),
    dict(
        key="billing_contact",
        q="How do I add or change the billing contact?",
        a=(
            'Go to Account Settings > Billing > Billing Contacts and click "Add Contact" to add a '
            'billing contact by email. To change the primary contact, select the contact and click "Set '
            'as Primary". The primary contact receives all invoices, payment receipts, and billing '
            "notifications."
        ),
        topic="Billing",
        source="googledocs",
        file="googledocs_exports/faq_section_payments.txt",
        conf=0.95,
        also=[],
        refs=["billing_invoices"],
    ),
    dict(
        key="billing_spending_limit",
        q="Is there a spending limit I can set?",
        a=(
            "Yes. For usage-based charges (extra API requests, additional storage) set a monthly "
            "spending cap in Account Settings > Billing > Spending Limits. When the cap is reached, "
            "usage-based features are throttled rather than billed further. Warnings are sent at 50%, "
            "80%, and 100% of the cap."
        ),
        topic="Billing",
        source="googledocs",
        file="googledocs_exports/faq_section_payments.txt",
        conf=0.95,
        also=[],
        refs=["billing_payment_failed", "api_rate_limits"],
    ),
    dict(
        key="billing_invoice_amount",
        q="Why is my invoice amount higher than my plan price?",
        a=(
            "The plan price is the base charge; additional charges can come from extra API requests "
            "beyond plan limits, additional storage beyond allocation, or add-on services. Review the "
            "line items under Account Settings > Billing > Invoice History for the detailed breakdown."
        ),
        topic="Billing",
        source="owncloud_tickets",
        file="owncloud/exports/resolved_tickets_2025q1.csv",
        conf=0.93,
        also=[],
        refs=["billing_invoices", "billing_upgrade", "billing_spending_limit"],
    ),
    dict(
        key="billing_sla",
        q="What is the SLA uptime guarantee?",
        a=(
            "Free tier: best effort, no SLA. Professional: 99.5% uptime. Enterprise: 99.95% uptime with "
            "financial credits for breach. SLAs are measured on a calendar-month basis, excluding "
            "scheduled maintenance windows."
        ),
        topic="Billing",
        source="owncloud_docs",
        file="owncloud/documentation/spec_sheet_v2.txt",
        conf=0.95,
        also=[],
        refs=["trouble_slo_violation", "billing_invoices"],
    ),
    # ----------------------------------------------------------------------------- API
    dict(
        key="api_rate_limits",
        q="What are the API rate limits?",
        a=(
            "Default per-token limits: Free 60 requests/minute (burst 10); Professional 600 "
            "requests/minute (burst 100); Enterprise 6,000 requests/minute (burst 1,000). Limits use a "
            "token-bucket algorithm with soft limits (short bursts above the stated rate) and a hard "
            "ceiling at 2x the stated rate. Enterprise plans can request custom limits above 6,000 RPM."
        ),
        topic="API",
        source="confluence",
        file="confluence_export/kb_public/api_rate_limiting.rst",
        conf=0.96,
        also=[
            ("googledocs", "googledocs_exports/sme_comments.pdf"),
            ("googledocs", "googledocs_exports/editorial_review_notes.md"),
        ],
        refs=["api_rate_status", "api_rate_exceeded", "api_export_large"],
    ),
    dict(
        key="api_rate_status",
        q="How do I check my current rate limit status?",
        a=(
            "Inspect these response headers on every call: `X-RateLimit-Limit` (plan requests-per-minute "
            "cap), `X-RateLimit-Remaining` (requests remaining in the window), and `X-RateLimit-Reset` "
            "(Unix timestamp when the window resets)."
        ),
        topic="API",
        source="confluence",
        file="confluence_export/kb_public/api_rate_limiting.rst",
        conf=0.97,
        also=[],
        refs=["api_rate_limits"],
    ),
    dict(
        key="api_rate_exceeded",
        q="What happens when I exceed the API rate limit?",
        a=(
            "The API returns HTTP 429 (Too Many Requests) with a `Retry-After` header indicating how "
            "many seconds to wait. Repeated violations may temporarily suspend the API token. For CI/CD "
            "pipelines, stagger test suites (for example, 1-second delays between calls) or upgrade to "
            "an Enterprise plan for higher limits."
        ),
        topic="API",
        source="confluence",
        file="confluence_export/kb_public/api_rate_limiting.rst",
        conf=0.96,
        also=[("owncloud_tickets", "owncloud/exports/triage_decisions.json")],
        refs=["api_rate_limits", "api_rate_status"],
    ),
    dict(
        key="api_auth",
        q="How do I authenticate API requests?",
        a=(
            "All API requests require a token in the Authorization header: "
            "`Authorization: Bearer <token>`. Tokens are generated under Account Settings > API Tokens "
            "and can be scoped to read, write, or admin permissions. Tokens expire after 90 days of "
            "inactivity."
        ),
        topic="API",
        source="owncloud_docs",
        file="owncloud/shared/tech_pubs/api_reference.md",
        conf=0.97,
        also=[],
        refs=["api_token_403", "api_methods"],
    ),
    dict(
        key="api_methods",
        q="What HTTP methods are supported?",
        a=(
            "GET (retrieve), POST (create), PUT (full update), PATCH (partial update), DELETE (remove). "
            "All endpoints return JSON; POST/PUT/PATCH bodies must use `Content-Type: application/json`."
        ),
        topic="API",
        source="owncloud_docs",
        file="owncloud/shared/tech_pubs/api_reference.md",
        conf=0.97,
        also=[],
        refs=["api_auth", "api_pagination"],
    ),
    dict(
        key="api_pagination",
        q="How do I paginate through large result sets?",
        a=(
            "List endpoints use cursor-based pagination. Use `?limit=N` (maximum 100) for page size. "
            "The response includes `next_cursor` and `has_more`; pass `next_cursor` as "
            "`?cursor=<value>` in the next request."
        ),
        topic="API",
        source="owncloud_docs",
        file="owncloud/shared/tech_pubs/api_reference.md",
        conf=0.97,
        also=[],
        refs=["api_methods", "api_export_large"],
    ),
    dict(
        key="api_token_403",
        q="Why does my API token return 403 Forbidden for POST requests?",
        a=(
            "A token that works for GET but returns 403 for POST is usually read-only. Go to Account "
            "Settings > API Tokens, edit the token, and enable the `write` scope. Tokens created before "
            "v4.0 defaulted to read-only."
        ),
        topic="API",
        source="owncloud_tickets",
        file="owncloud/exports/resolved_tickets_2025q1.csv",
        conf=0.94,
        also=[],
        refs=["api_auth"],
    ),
    dict(
        key="api_export_large",
        q="How do I export large datasets without timing out?",
        a=(
            "Synchronous exports time out after 5 minutes. Use the Async Export API, which returns a job "
            "ID that can be polled for completion. For datasets exceeding 5 million rows, contact "
            "support to schedule a manual export."
        ),
        topic="API",
        source="owncloud_tickets",
        file="owncloud/exports/triage_decisions.json",
        conf=0.93,
        also=[],
        refs=["api_pagination", "api_rate_exceeded"],
    ),
    dict(
        key="api_versioning",
        q="How are breaking API changes managed?",
        a=(
            "Breaking changes are introduced only in new major API versions (for example /v1/ to "
            "/v2/). Each major version is supported for at least 18 months after its successor ships. "
            "Deprecation notices are sent via `Sunset` and `Deprecation` response headers and by email "
            "to API token owners 6 months before end-of-life."
        ),
        topic="API",
        source="owncloud_docs",
        file="owncloud/documentation/architecture_decision_records.md",
        conf=0.95,
        also=[],
        refs=["deploy_release_400", "deploy_release_420"],
    ),
    dict(
        key="api_payload",
        q="What is the maximum payload size for API requests?",
        a=(
            "The maximum REST API request payload is 10 MB. File uploads through the Assets API are "
            "limited to 250 MB per file. Requests above these limits return HTTP 413 (Payload Too "
            "Large)."
        ),
        topic="API",
        source="owncloud_docs",
        file="owncloud/documentation/product_manual_q1.pdf",
        conf=0.95,
        also=[],
        refs=["api_export_large", "api_methods"],
    ),
    # ---------------------------------------------------------------------- Deployment
    dict(
        key="deploy_docker",
        q="How do I deploy using Docker Compose?",
        a=(
            "1) Download `docker-compose.yml` from the releases page. 2) Create a `.env` file with the "
            "required environment variables. 3) Run `docker compose up -d`. 4) Access the application "
            "at `http://localhost:8080`. 5) Run `curl http://localhost:8080/healthz`."
        ),
        topic="Deployment",
        source="owncloud_docs",
        file="owncloud/shared/tech_pubs/deployment_guide.rst",
        conf=0.97,
        also=[],
        refs=["deploy_kubernetes", "deploy_db_pool", "trouble_docker_137"],
    ),
    dict(
        key="deploy_kubernetes",
        q="How do I deploy on Kubernetes?",
        a=(
            "An official Helm chart is published at `helm.platform.example.com`. Add the repository "
            "with `helm repo add platform https://charts.platform.example.com`, then install with "
            "`helm install my-deployment platform/platform-stack`."
        ),
        topic="Deployment",
        source="owncloud_docs",
        file="owncloud/shared/tech_pubs/deployment_guide.rst",
        conf=0.97,
        also=[],
        refs=["deploy_docker"],
    ),
    dict(
        key="deploy_db_pool",
        q="How do I configure database connection pooling?",
        a=(
            "Set `DB_POOL_SIZE` (maximum connections, default 20), `DB_POOL_TIMEOUT` (seconds to wait "
            "for a connection, default 30), and `DB_POOL_IDLE_TIMEOUT` (seconds before idle connections "
            "close, default 300)."
        ),
        topic="Deployment",
        source="owncloud_docs",
        file="owncloud/shared/tech_pubs/deployment_guide.rst",
        conf=0.97,
        also=[],
        refs=["deploy_env_vars", "trouble_502"],
    ),
    dict(
        key="deploy_start",
        q="How do I start a new deployment?",
        a=(
            "1) Define the deployment configuration in `deploy.yaml`. 2) Validate it with "
            "`platform-cli validate --config deploy.yaml`. 3) Execute with "
            "`platform-cli deploy --config deploy.yaml --env staging`. 4) Monitor progress with "
            "`platform-cli status --deployment <id>`."
        ),
        topic="Deployment",
        source="owncloud_docs",
        file="owncloud/shared/tech_pubs/orchestration_guide.md",
        conf=0.95,
        also=[],
        refs=["deploy_staging", "deploy_production", "deploy_env_vars"],
    ),
    dict(
        key="deploy_staging",
        q="How do I deploy to staging?",
        a=(
            "1) Ensure all tests pass on the feature branch. 2) Open a merge request targeting "
            "`staging`. 3) Wait for the CI/CD pipeline, including integration tests. 4) After merge the "
            "staging environment auto-deploys. 5) Verify with "
            "`curl https://staging.internal.example.com/healthz`. 6) Run "
            "`./scripts/smoke-test-staging.sh`."
        ),
        topic="Deployment",
        source="gitlab_runbooks",
        file="gitlab_repo/docs/runbook_deployment.rst",
        conf=0.96,
        also=[],
        refs=["deploy_production"],
    ),
    dict(
        key="deploy_production",
        q="How do I deploy to production?",
        a=(
            "Production deployments follow change management: 1) Create a release candidate from "
            "staging (`git checkout staging && git pull && git checkout -b release/vX.Y.Z`). 2) Open a "
            "production change request. 3) Obtain approval from Tech Lead, QA Lead, and Operations "
            "Lead. 4) During the Tue/Thu 10:00-12:00 UTC window, merge to main, monitor the canary (10% "
            "traffic for 15 minutes), proceed to full rollout if metrics are green, and monitor "
            "dashboards for 30 minutes."
        ),
        topic="Deployment",
        source="gitlab_runbooks",
        file="gitlab_repo/docs/runbook_deployment.rst",
        conf=0.96,
        also=[],
        refs=["deploy_staging", "deploy_rollback", "deploy_bluegreen"],
    ),
    dict(
        key="deploy_rollback",
        q="How do I roll back a deployment?",
        a=(
            "1) Identify the last known-good commit in the deployment history. 2) Run "
            "`./scripts/rollback-production.sh <commit-hash>`; the script restores the matching "
            "artifact, runs database migration reversions where applicable, and executes health "
            "checks. Alternatively, use `platform-cli rollback --deployment <id> --env production` and "
            "verify with `platform-cli health-check --env production`. 3) Notify `#platform-incidents` "
            "and create a post-mortem within 24 hours."
        ),
        topic="Deployment",
        source="gitlab_runbooks",
        file="gitlab_repo/docs/runbook_deployment.rst",
        conf=0.95,
        also=[("owncloud_docs", "owncloud/shared/tech_pubs/orchestration_guide.md")],
        refs=["deploy_production", "deploy_staging"],
    ),
    dict(
        key="deploy_bluegreen",
        q="What is the difference between blue-green and canary deployments?",
        a=(
            "Blue-green runs two complete environments and switches traffic at once. Canary gradually "
            "shifts a percentage of traffic to the new version. The platform defaults to canary for "
            "production and blue-green for staging."
        ),
        topic="Deployment",
        source="owncloud_docs",
        file="owncloud/shared/tech_pubs/orchestration_guide.md",
        conf=0.95,
        also=[],
        refs=["deploy_production"],
    ),
    dict(
        key="deploy_healthchecks",
        q="How do I add custom health checks to my deployment?",
        a=(
            "Define health check endpoints in `deploy.yaml` under the `health_checks` section. HTTP, "
            "TCP, and command-based checks are supported with configurable intervals, timeouts, and "
            "retry counts."
        ),
        topic="Deployment",
        source="owncloud_docs",
        file="owncloud/shared/tech_pubs/orchestration_guide.md",
        conf=0.95,
        also=[],
        refs=["deploy_production", "trouble_alerting"],
    ),
    dict(
        key="deploy_env_vars",
        q="How do I configure environment variables for a deployment?",
        a=(
            "Environment variables can be set at project, environment, or service scope. Service-level "
            "overrides environment-level, which overrides project-level. Use the `--scope` flag to "
            "specify the level."
        ),
        topic="Deployment",
        source="owncloud_docs",
        file="owncloud/shared/tech_pubs/orchestration_guide.md",
        conf=0.95,
        also=[],
        refs=["deploy_db_pool", "onboard_dev_env"],
    ),
    dict(
        key="deploy_release_420",
        q="What's new in v4.2.0?",
        a=(
            "v4.2.0 (2025-03-01) added bulk user import via CSV (maximum 10,000 users per import), "
            "custom RBAC role definitions, fuzzy search with typo tolerance, and audit log export to "
            "S3-compatible storage."
        ),
        topic="Deployment",
        source="owncloud_docs",
        file="owncloud/documentation/release_notes_2025.txt",
        conf=0.97,
        also=[],
        refs=["deploy_release_410", "auth_sso_redirect_uri"],
    ),
    dict(
        key="deploy_release_410",
        q="What was added in v4.1.0?",
        a=(
            "v4.1.0 (2025-02-01) added WebSocket real-time notifications for deployment events, "
            "multi-region failover for Enterprise, SAML metadata auto-refresh for IdP certificate "
            "rotation, and a customizable dashboard layout."
        ),
        topic="Deployment",
        source="owncloud_docs",
        file="owncloud/documentation/release_notes_2025.txt",
        conf=0.97,
        also=[],
        refs=["deploy_release_420", "net_websockets"],
    ),
    dict(
        key="deploy_release_400",
        q="What breaking changes were introduced in v4.0.0?",
        a=(
            "v4.0.0 (2025-01-06) deprecated API v1 endpoints (sunset 2026-07-06), replaced the legacy "
            "webhook format with JSON Schema v2 payloads, raised the minimum TLS version to 1.2, and "
            "ended Python 3.7/3.8 SDK support."
        ),
        topic="Deployment",
        source="owncloud_docs",
        file="owncloud/documentation/release_notes_2025.txt",
        conf=0.97,
        also=[],
        refs=["api_versioning", "security_tls", "integrations_webhook_config"],
    ),
    dict(
        key="deploy_db_engines",
        q="What database engines are supported?",
        a=(
            "PostgreSQL 14.x, 15.x, and 16.x (recommended); MySQL 8.0.x (InnoDB required); SQL Server "
            "2019 and 2022 (Enterprise tier only)."
        ),
        topic="Deployment",
        source="owncloud_docs",
        file="owncloud/documentation/spec_sheet_v2.txt",
        conf=0.97,
        also=[],
        refs=["deploy_hardware", "deploy_db_pool"],
    ),
    dict(
        key="deploy_hardware",
        q="What are the minimum hardware requirements for self-hosted deployment?",
        a=(
            "Minimum: 4 vCPUs (x86_64 or ARM64), 8 GB RAM (16 GB recommended for production), 50 GB "
            "SSD for the application plus attachment storage, and a 1 Gbps low-latency connection to "
            "the database."
        ),
        topic="Deployment",
        source="owncloud_docs",
        file="owncloud/documentation/spec_sheet_v2.txt",
        conf=0.97,
        also=[],
        refs=["deploy_db_engines", "deploy_os"],
    ),
    dict(
        key="deploy_os",
        q="What operating systems are supported?",
        a=(
            "Ubuntu 20.04/22.04/24.04 LTS; RHEL 8.x/9.x and compatible derivatives (Rocky Linux, "
            "AlmaLinux); Debian 11 (Bullseye) and 12 (Bookworm); container deployment via Docker 24+ or "
            "Kubernetes 1.27+."
        ),
        topic="Deployment",
        source="owncloud_docs",
        file="owncloud/documentation/spec_sheet_v2.txt",
        conf=0.97,
        also=[],
        refs=["deploy_hardware", "deploy_docker", "deploy_kubernetes"],
    ),
    # ---------------------------------------------------------------- Troubleshooting
    dict(
        key="trouble_502",
        q="What should I do when the API returns 502 Bad Gateway?",
        a=(
            "A 502 means the API gateway cannot reach the backend. 1) Check pods: "
            "`kubectl get pods -n platform -l app=api-backend`. 2) Check readiness: "
            "`kubectl describe pod <pod-name> -n platform`. 3) Read logs: "
            "`kubectl logs -n platform -l app=api-backend --tail=200`. 4) If crash-looping, inspect "
            "`State:` in the pod description. Common causes are database connection pool exhaustion, "
            "memory limits, and configuration errors after a deploy."
        ),
        topic="Troubleshooting",
        source="gitlab_runbooks",
        file="gitlab_repo/docs/troubleshooting_playbook.txt",
        conf=0.96,
        also=[],
        refs=["trouble_db_cpu", "deploy_db_pool", "trouble_alerting"],
    ),
    dict(
        key="trouble_db_cpu",
        q="How do I diagnose high database CPU usage?",
        a=(
            "1) Count active connections: "
            "`SELECT count(*) FROM pg_stat_activity WHERE state = 'active';`. 2) Find long-running "
            "queries: `SELECT pid, now() - query_start AS duration, query FROM pg_stat_activity WHERE "
            "state = 'active' ORDER BY duration DESC LIMIT 10;`. 3) Check locks: "
            "`SELECT * FROM pg_locks WHERE NOT granted;`. 4) Terminate a problematic query with "
            "`SELECT pg_terminate_backend(<pid>);`. Common causes are missing indexes, unoptimized "
            "joins over large tables, and analytics queries during peak hours."
        ),
        topic="Troubleshooting",
        source="gitlab_runbooks",
        file="gitlab_repo/docs/troubleshooting_playbook.txt",
        conf=0.96,
        also=[],
        refs=["trouble_502", "trouble_redis"],
    ),
    dict(
        key="trouble_redis",
        q="How do I clear the Redis cache safely?",
        a=(
            "1) Check memory: `redis-cli -h <host> INFO memory | grep used_memory_human`. 2) With "
            "`allkeys-lru`, Redis evicts automatically; otherwise clear the current database with "
            "`redis-cli -h <host> FLUSHDB`. `FLUSHALL` clears every database and must never be used in "
            "production without explicit approval. 3) Monitor for increased database load while caches "
            "rebuild."
        ),
        topic="Troubleshooting",
        source="gitlab_runbooks",
        file="gitlab_repo/docs/troubleshooting_playbook.txt",
        conf=0.96,
        also=[],
        refs=["trouble_502", "trouble_db_cpu"],
    ),
    dict(
        key="trouble_docker_137",
        q="Why does my Docker container exit immediately with code 137?",
        a=(
            "Exit code 137 indicates the container was killed by the OOM (Out of Memory) killer. Check "
            "that at least 2 GB of memory is allocated to the container. Increase the memory limit in "
            "the Docker configuration, or add a swap file if memory is constrained."
        ),
        topic="Troubleshooting",
        source="owncloud_tickets",
        file="owncloud/exports/resolved_tickets_2025q1.csv",
        conf=0.93,
        also=[],
        refs=["deploy_docker", "deploy_hardware"],
    ),
    dict(
        key="trouble_dashboard",
        q="Why is the dashboard slow to load?",
        a=(
            "The dashboard aggregates data across all projects. For users with 50+ projects, enable "
            '"Lazy Load" under User Preferences > Dashboard to load project data on demand as sections '
            "are expanded."
        ),
        topic="Troubleshooting",
        source="owncloud_tickets",
        file="owncloud/exports/resolved_tickets_2025q1.csv",
        conf=0.93,
        also=[],
        refs=["trouble_502"],
    ),
    dict(
        key="trouble_slo_violation",
        q="What happens when an SLO is violated?",
        a=(
            "An incident is created automatically in the on-call rotation. The error-budget burn rate is "
            "calculated and alerts go to the platform-eng Slack channel."
        ),
        topic="Troubleshooting",
        source="owncloud_docs",
        file="owncloud/shared/tech_pubs/service_level_targets.yaml",
        conf=0.96,
        also=[],
        refs=["trouble_slo_review", "trouble_alerting", "billing_sla"],
    ),
    dict(
        key="trouble_slo_review",
        q="How often are SLOs reviewed?",
        a=(
            "SLOs are reviewed quarterly by the platform reliability team. Adjustments require approval "
            "from the VP of Engineering."
        ),
        topic="Troubleshooting",
        source="owncloud_docs",
        file="owncloud/shared/tech_pubs/service_level_targets.yaml",
        conf=0.96,
        also=[],
        refs=["trouble_slo_violation"],
    ),
    dict(
        key="trouble_sev1",
        q="How do I declare a SEV1 incident?",
        a=(
            "Declare a SEV1 with `/incident declare` in Slack or by calling the emergency hotline at "
            "extension 4911. Provide the affected service, observed symptoms, approximate start time, "
            "and any known recent changes."
        ),
        topic="Troubleshooting",
        source="gitlab_runbooks",
        file="gitlab_repo/docs/incident_response.yaml",
        conf=0.96,
        also=[],
        refs=["trouble_incident_template"],
    ),
    dict(
        key="trouble_incident_template",
        q="What is the incident communication template?",
        a=(
            "Post to `#platform-incidents`: `SEV<level>: <brief description>. Impact: <user-facing "
            "impact>. Investigating: <team/engineer>. Next update: <time>` (typically 30 minutes for "
            "SEV1 and 1 hour for SEV2). Updates go in the thread."
        ),
        topic="Troubleshooting",
        source="gitlab_runbooks",
        file="gitlab_repo/docs/incident_response.yaml",
        conf=0.96,
        also=[],
        refs=["trouble_sev1"],
    ),
    dict(
        key="trouble_metrics",
        q="What metrics should I monitor for the platform?",
        a=(
            "Track application request rate, error rate, latency (p50/p95/p99), and active connections; "
            "infrastructure CPU, memory, disk I/O, and network throughput; database connection-pool "
            "utilization, query latency, replication lag, and deadlocks; and business metrics such as "
            "active users, feature adoption, and API token usage."
        ),
        topic="Troubleshooting",
        source="owncloud_docs",
        file="owncloud/shared/tech_pubs/monitoring_best_practices.md",
        conf=0.96,
        also=[],
        refs=["trouble_alerting", "trouble_logging"],
    ),
    dict(
        key="trouble_alerting",
        q="How do I set up alerting?",
        a=(
            "Suggested thresholds: API error rate >1% for 5 minutes pages on-call; p99 latency >1s for "
            "10 minutes creates an incident ticket; disk usage >85% sends a warning; database "
            "replication lag >30s pages on-call; certificate expiry within 7 days emails the security "
            "team."
        ),
        topic="Troubleshooting",
        source="owncloud_docs",
        file="owncloud/shared/tech_pubs/monitoring_best_practices.md",
        conf=0.96,
        also=[],
        refs=["trouble_metrics", "trouble_slo_violation", "security_ssl_upload"],
    ),
    dict(
        key="trouble_logging",
        q="What logging levels should I use?",
        a=(
            "ERROR for errors needing immediate attention; WARN for degraded functionality or "
            "approaching limits; INFO for normal operational events such as deployments and signups; "
            "DEBUG for detailed diagnostics (disabled in production). Logs must be structured JSON with "
            "at least timestamp, level, service, trace_id, and message."
        ),
        topic="Troubleshooting",
        source="owncloud_docs",
        file="owncloud/shared/tech_pubs/monitoring_best_practices.md",
        conf=0.96,
        also=[],
        refs=["trouble_metrics", "integrations_kibana"],
    ),
    # ---------------------------------------------------------------------- Onboarding
    dict(
        key="onboard_start",
        q="How do new users get started with the platform?",
        a=(
            "After account creation, complete the Quick Start wizard from the dashboard welcome banner. "
            "It guides you through connecting a source repository, configuring the first deployment "
            "pipeline, and inviting team members; estimated completion time is 15 minutes."
        ),
        topic="Onboarding",
        source="owncloud_docs",
        file="owncloud/internal_faq_draft_v2.txt",
        conf=0.9,
        also=[],
        refs=["auth_signup", "integrations_available", "onboard_dev_env"],
    ),
    dict(
        key="onboard_dev_env",
        q="How do I set up my local development environment?",
        a=(
            "1) `git clone git@gitlab.internal.example.com:platform/docs.git`. 2) Install Python 3.11+, "
            "Docker 24+, and Node.js 20 LTS. 3) Run `./scripts/setup-dev-env.sh`. 4) Configure "
            "`.env.local` with development API keys. 5) Start services with "
            "`docker compose -f docker-compose.dev.yml up -d`. 6) Verify with "
            "`./scripts/health-check.sh`."
        ),
        topic="Onboarding",
        source="gitlab_runbooks",
        file="gitlab_repo/docs/onboarding_guide.md",
        conf=0.96,
        also=[],
        refs=["deploy_env_vars", "onboard_prod_access"],
    ),
    dict(
        key="onboard_branch",
        q="What is the branch naming convention?",
        a=(
            "Feature: `feature/YYYY-MM-DD-brief-description`. Bug fix: "
            "`fix/ISSUE-NUMBER-brief-description`. Hotfix: `hotfix/YYYY-MM-DD-brief-description`. "
            "Release: `release/vX.Y.Z`. Branch from `main`, rebase before merge, and squash commits for "
            "all merge requests."
        ),
        topic="Onboarding",
        source="gitlab_runbooks",
        file="gitlab_repo/docs/onboarding_guide.md",
        conf=0.96,
        also=[],
        refs=["onboard_dev_env", "onboard_gitlab_member"],
    ),
    dict(
        key="onboard_prod_access",
        q="How do I request access to production systems?",
        a=(
            'Submit an access request through the IT Service Portal at https://it.internal.example.com/access. '
            'Select "Production Infrastructure Access" and provide team, systems, access level '
            "(read-only, operator, admin), and business justification. Manager approval is required, and "
            "access is reviewed quarterly."
        ),
        topic="Onboarding",
        source="gitlab_runbooks",
        file="gitlab_repo/docs/onboarding_guide.md",
        conf=0.96,
        also=[],
        refs=["onboard_dev_env", "security_audit_logs"],
    ),
    dict(
        key="onboard_gitlab_member",
        q="How do I add a new team member to the GitLab group?",
        a=(
            "Go to Group Settings > Members > Invite Members. Enter the email, select a role (Developer "
            "for engineers, Reporter for PMs), and set an expiration (default 365 days). The person "
            "receives an invitation email."
        ),
        topic="Onboarding",
        source="gitlab_runbooks",
        file="gitlab_repo/docs/team_cheatsheet.yaml",
        conf=0.95,
        also=[],
        refs=["onboard_branch"],
    ),
    # ------------------------------------------------------------------------ Security
    dict(
        key="security_ssl_upload",
        q="How do I upload a custom SSL certificate for my custom domain?",
        a=(
            'Go to Settings > Domains > SSL Certificates and click "Upload Certificate". Provide the '
            "PEM certificate, private key, and intermediate chain files. The system validates validity, "
            "chain of trust, and private-key match before activating. Renewal reminders are sent 30, 14, "
            "and 7 days before expiry."
        ),
        topic="Security",
        source="confluence",
        file="confluence_export/kb_public/ssl_certificate_guide.md",
        conf=0.96,
        also=[],
        refs=["security_ssl_wildcard", "security_ssl_validation", "security_tls"],
    ),
    dict(
        key="security_ssl_wildcard",
        q="Does the platform support wildcard certificates?",
        a=(
            "Yes. Wildcard certificates (`*.example.com`) are supported for custom domains and are "
            "uploaded the same way as standard certificates. A wildcard covers one level of subdomain "
            "(for example `app.example.com` but not `api.app.example.com`)."
        ),
        topic="Security",
        source="confluence",
        file="confluence_export/kb_public/ssl_certificate_guide.md",
        conf=0.96,
        also=[],
        refs=["security_ssl_upload"],
    ),
    dict(
        key="security_tls",
        q="What TLS and cipher configuration does the platform support?",
        a=(
            "The platform supports modern, secure TLS configurations only. TLS 1.0, TLS 1.1, SSLv3, "
            "RC4, and 3DES are disabled on all endpoints. The detailed cipher-suite list is available "
            "in the enterprise security whitepaper under NDA."
        ),
        topic="Security",
        source="confluence",
        file="confluence_export/kb_public/ssl_certificate_guide.md",
        conf=0.9,
        also=[("googledocs", "googledocs_exports/sme_comments.pdf")],
        refs=["security_ssl_upload", "security_data_residency"],
    ),
    dict(
        key="security_ssl_validation",
        q="Why does my custom SSL certificate fail browser validation?",
        a=(
            "Common causes: (1) the intermediate certificate chain is missing, so the bundle must "
            "include all intermediate CA certificates; (2) the certificate is issued for a different "
            "domain; (3) the private key does not match the certificate. An SSL checker tool can "
            "identify the specific failure."
        ),
        topic="Security",
        source="owncloud_tickets",
        file="owncloud/exports/resolved_tickets_2025q1.csv",
        conf=0.94,
        also=[],
        refs=["security_ssl_upload"],
    ),
    dict(
        key="security_data_residency",
        q="How does the platform handle data residency requirements?",
        a=(
            "Enterprise customers select a data residency region during onboarding. Available regions: "
            "US (us-east-1, us-west-2), EU (eu-central-1, eu-west-1), and APAC (ap-southeast-1, "
            "ap-northeast-1). Data at rest is encrypted with AES-256 and in transit with TLS 1.2+. "
            "Customer data stays in the selected region except for explicit cross-region replication "
            "configured by the customer."
        ),
        topic="Security",
        source="owncloud_docs",
        file="owncloud/internal_faq_draft_v2.txt",
        conf=0.9,
        also=[],
        refs=["security_tls", "security_audit_logs"],
    ),
    dict(
        key="security_audit_logs",
        q="How do I enable audit logging?",
        a=(
            'Audit logging is available on Enterprise plans under Settings > Security > Audit Logs. '
            'Enable "Detailed Activity Logging" and select event categories: Authentication Events, API '
            "Access, Configuration Changes, and Data Export. Logs are retained 90 days by default, "
            "configurable up to 365 days on request."
        ),
        topic="Security",
        source="owncloud_docs",
        file="owncloud/documentation/product_manual_q1.pdf",
        conf=0.95,
        also=[],
        refs=["onboard_prod_access", "security_data_residency"],
    ),
    dict(
        key="security_backups",
        q="What are the database backup schedules?",
        a=(
            "Full backups run daily at 02:00 UTC and incremental backups every 4 hours. Retention is 30 "
            "days for daily backups, 7 days for incremental backups, and 12 months for monthly backups."
        ),
        topic="Security",
        source="gitlab_runbooks",
        file="gitlab_repo/docs/team_cheatsheet.yaml",
        conf=0.95,
        also=[],
        refs=["trouble_db_cpu"],
    ),
    dict(
        key="security_sharding",
        q="How does the platform distribute data across database servers?",
        a=(
            "Data is distributed across multiple database servers to provide horizontal scalability and "
            "strong consistency for single-tenant queries. Detailed sharding internals are not "
            "published; they are available to enterprise customers under NDA."
        ),
        topic="Security",
        source="owncloud_docs",
        file="owncloud/documentation/architecture_decision_records.md",
        conf=0.85,
        also=[("googledocs", "googledocs_exports/sme_comments.pdf")],
        refs=["trouble_db_cpu", "security_data_residency"],
    ),
    # -------------------------------------------------------------------- Integrations
    dict(
        key="integrations_available",
        q="What integrations are available out of the box?",
        a=(
            "Native integrations include GitHub, GitLab, Bitbucket, Slack, Jira, PagerDuty, Datadog, and "
            "Splunk. The Integration Marketplace offers 200+ community and partner integrations. Custom "
            "integrations can be built with the Webhook API and Platform SDK."
        ),
        topic="Integrations",
        source="owncloud_docs",
        file="owncloud/internal_faq_draft_v2.txt",
        conf=0.9,
        also=[],
        refs=["integrations_webhook_config", "onboard_start"],
    ),
    dict(
        key="integrations_webhook_config",
        q="How do I configure webhook notifications?",
        a=(
            'Configure webhooks under Developer Settings > Webhooks. Click "Add Webhook", provide the '
            "target URL, select events (minimum: `deployment.completed`, `build.failed`), and optionally "
            "set a secret token for signature verification. The platform sends a test ping; the endpoint "
            "must answer an initial challenge-response handshake within 5 seconds or the webhook is not "
            "created. Payloads are signed with HMAC-SHA256 using the provided secret."
        ),
        topic="Integrations",
        source="owncloud_docs",
        file="owncloud/documentation/product_manual_q1.pdf",
        conf=0.94,
        also=[("googledocs", "googledocs_exports/sme_comments.pdf")],
        refs=["integrations_webhook_not_firing", "deploy_release_400"],
    ),
    dict(
        key="integrations_webhook_not_firing",
        q="Why is my webhook not firing for deployment events?",
        a=(
            "Confirm the webhook is enabled and the event filter includes `deployment.completed`. By "
            'default the webhook fires only for successful deployments; enable "Include Failed '
            'Deployments" to receive failed ones. Also confirm the endpoint passed the initial '
            "challenge-response handshake when the webhook was created."
        ),
        topic="Integrations",
        source="owncloud_tickets",
        file="owncloud/exports/resolved_tickets_2025q1.csv",
        conf=0.93,
        also=[],
        refs=["integrations_webhook_config"],
    ),
    dict(
        key="integrations_kibana",
        q="How do I access the Kibana logs dashboard?",
        a=(
            'Navigate to https://kibana.internal.example.com and sign in with SSO credentials. The '
            '"Platform Logs" dashboard shows all application logs; use the filter bar to narrow by '
            "service, environment, or trace ID."
        ),
        topic="Integrations",
        source="gitlab_runbooks",
        file="gitlab_repo/docs/team_cheatsheet.yaml",
        conf=0.95,
        also=[],
        refs=["trouble_logging", "trouble_502"],
    ),
    dict(
        key="integrations_rabbitmq",
        q="Why was RabbitMQ chosen over Kafka for the task queue?",
        a=(
            "RabbitMQ was chosen for mature AMQP 0-9-1 support, flexible routing with exchanges and "
            "bindings, and lower operational complexity for task distribution with individual "
            "acknowledgment. Kafka was considered overengineered for throughput below 10K "
            "messages/second and added operational burden."
        ),
        topic="Integrations",
        source="owncloud_docs",
        file="owncloud/documentation/architecture_decision_records.md",
        conf=0.94,
        also=[],
        refs=["security_sharding"],
    ),
]

# Sources deliberately withheld from the published artifact.
EXCLUSIONS = [
    dict(
        source_file="gitlab_repo/config/credentials.json",
        category="credentials",
        reason="Live service secrets (API keys, service-account password, DB master key, ingest key). "
        "Publishing would expose production credentials.",
    ),
    dict(
        source_file="gitlab_repo/config/env_production.env",
        category="credentials",
        reason="Production environment file containing the same live secrets in env-var form.",
    ),
    dict(
        source_file="owncloud/exports/raw_tickets_2025q1.json",
        category="customer_pii",
        reason="Unredacted customer names, emails, phone numbers, home/shipping addresses, payment "
        "references, and passport verification numbers.",
    ),
    dict(
        source_file="owncloud/documentation/onboarding_checklist_v3.txt",
        category="employee_pii",
        reason="Employee SSN/beneficiary tax ID, home address, and personal emergency contact.",
    ),
    dict(
        source_file="owncloud/documentation/employee_handbook_2025.pdf",
        category="employee_pii",
        reason="Employee SSN, home address, emergency contact, and personal compensation details.",
    ),
    dict(
        source_file="googledocs_exports/bonus_allocation.csv",
        category="compensation",
        reason="Named employee base salaries, bonus allocations, equity grants, promotion rankings, and "
        "retention offers.",
    ),
    dict(
        source_file="googledocs_exports/compensation_planning.xlsx",
        category="compensation",
        reason="Salary bands, bonus pool, promotion slate, and an individual retention package.",
    ),
    dict(
        source_file="confluence_export/exec_strategy/m_and_a_diligence_memo.md",
        category="material_nonpublic_information",
        reason="Board-eyes-only M&A diligence memo under NDA, including valuation, term sheet, and "
        "insider-trading restrictions.",
    ),
    dict(
        source_file="owncloud/board_20250215_summary.pdf",
        category="board_confidential",
        reason="Strictly confidential board minutes: fundraising, litigation settlement range, CEO "
        "review, and divestiture strategy.",
    ),
    dict(
        source_file="gitlab_repo/legal/contracts/nda_template.md",
        category="privileged_legal",
        reason="Attorney-client privileged, confidential legal template with unsigned governing-law "
        "terms.",
    ),
    dict(
        source_file="gitlab_repo/legal/contracts/vendor_agreement_draft.pdf",
        category="privileged_legal",
        reason="Privileged unsigned vendor agreement with indemnification limits and negotiation "
        "positions.",
    ),
    dict(
        source_file="owncloud/shared/tech_pubs/pentest_report_q4.pdf",
        category="security_vulnerability",
        reason="Unpatched critical vulnerabilities, exploit chain, and a zero-day under embargo until "
        "2025-06-15. Publication would materially increase attack risk.",
    ),
]

DOCUMENTATION_GAPS = [
    "GDPR/CCPA data-export request procedure (requested in editorial notes; no source answer exists).",
    "Bulk user import CSV column/format specification (feature announced, format not documented).",
    "Custom RBAC role management procedure (feature announced, no how-to source).",
    "Audit-log export to S3 configuration steps (feature announced, steps not documented).",
    "Slack integration setup walkthrough (reviewers noted docs are scattered; no consolidated source).",
    "Error-code reference table (requested by Customer Success; no source mapping exists).",
]

SECRET_MARKERS = [
    "sk-kb-prod",
    "cf-svc-acc",
    "oc-bak-tok",
    "db-master-k3y",
    "es-ingest-api-key",
    "P47829103",
    "N50281764",
    "987-65-4321",
    "123-45-6789",
]

PII_PATTERNS = [
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "SSN-like identifier"),
    (re.compile(r"\b[A-Z]\d{8}\b"), "passport-like identifier"),
    (re.compile(r"\+1-555-0\d{3}-\d{4}"), "personal phone number"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "private key block"),
]


def build() -> tuple[dict, dict]:
    id_by_key = {
        e["key"]: "faq-" + str(uuid.uuid5(NAMESPACE, e["q"].strip().lower())) for e in ENTRIES
    }

    entries = []
    for e in ENTRIES:
        contributing = [{"platform": e["source"], "source_file": e["file"]}]
        for platform, path in e["also"]:
            contributing.append({"platform": platform, "source_file": path})
        entries.append(
            {
                "id": id_by_key[e["key"]],
                "question": e["q"],
                "answer": e["a"],
                "topic": e["topic"],
                "source": e["source"],
                "source_file": e["file"],
                "cross_references": [id_by_key[k] for k in e["refs"]],
                "confidence": e["conf"],
                "contributing_sources": contributing,
            }
        )

    entries.sort(key=lambda x: (x["topic"], x["question"].lower()))
    distribution = Counter(e["topic"] for e in entries)

    metadata = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "schema_version": "1.0",
        "source_platforms": [
            "confluence",
            "owncloud_tickets",
            "gitlab_runbooks",
            "googledocs",
            "owncloud_docs",
        ],
        "total_entries": len(entries),
        "topic_distribution": dict(sorted(distribution.items())),
        "scope": (
            "Knowledge-base FAQ content only. Credential, customer/employee PII, compensation, "
            "board/M&A, privileged legal, and unpatched-vulnerability sources were withheld from "
            "this artifact; see output/exclusion_register.json."
        ),
        "deduplication": {
            "method": "normalized question text, near-duplicate review at SequenceMatcher ratio >= 0.90",
            "merged_groups": [
                "password reset (Confluence + resolved ticket TKT-1001)",
                "API rate limiting (Confluence + SME comments + editorial notes + triage TKT-1009)",
                "deployment rollback (GitLab runbook + orchestration guide)",
                "SSO troubleshooting (Confluence + resolved ticket TKT-1003 + Google Docs login draft)",
                "webhook configuration (product manual + SME comments + resolved ticket TKT-1005)",
            ],
            "duplicates_remaining": 0,
        },
        "editorial_controls_applied": [
            "Removed enumerated cipher suites from the public SSL answer per Security review.",
            "Generalized database-sharding internals per API Platform Architect review.",
            "Added hard/soft rate-limit semantics from SME review.",
            "Added webhook challenge-response handshake requirement from SME review.",
        ],
        "documentation_gaps": DOCUMENTATION_GAPS,
        "excluded_source_count": len(EXCLUSIONS),
    }

    artifact = {"metadata": metadata, "faq_entries": entries}
    return artifact, id_by_key


def validate(artifact: dict) -> dict:
    entries = artifact["faq_entries"]
    checks: list[dict] = []

    def check(name: str, ok: bool, detail: str) -> None:
        checks.append({"check": name, "passed": bool(ok), "detail": detail})

    required = {
        "id",
        "question",
        "answer",
        "topic",
        "source",
        "source_file",
        "cross_references",
        "confidence",
    }
    missing = [e["id"] for e in entries if not required.issubset(e)]
    check("required_fields", not missing, f"missing fields on {len(missing)} entries")

    bad_topics = [e["id"] for e in entries if e["topic"] not in TOPICS]
    check("topic_values", not bad_topics, f"{len(bad_topics)} entries outside allowed topics")

    bad_conf = [e["id"] for e in entries if not 0.0 <= e["confidence"] <= 1.0]
    check("confidence_range", not bad_conf, f"{len(bad_conf)} entries out of range")

    ids = [e["id"] for e in entries]
    check("unique_ids", len(ids) == len(set(ids)), f"{len(ids) - len(set(ids))} duplicate ids")

    unresolved = [
        (e["id"], ref)
        for e in entries
        for ref in e["cross_references"]
        if ref not in set(ids) or ref == e["id"]
    ]
    check("cross_references_resolve", not unresolved, f"{len(unresolved)} unresolved/self references")

    missing_files = [
        e["source_file"] for e in entries if not (ROOT / e["source_file"]).is_file()
    ]
    check("source_files_exist", not missing_files, f"{len(missing_files)} missing source files")

    normalized = [re.sub(r"[^a-z0-9 ]", "", e["question"].lower()).strip() for e in entries]
    exact_dupes = len(normalized) - len(set(normalized))
    near = []
    for i in range(len(normalized)):
        for j in range(i + 1, len(normalized)):
            ratio = SequenceMatcher(None, normalized[i], normalized[j]).ratio()
            if ratio >= 0.90:
                near.append((entries[i]["id"], entries[j]["id"], round(ratio, 3)))
    check("no_duplicate_questions", exact_dupes == 0, f"{exact_dupes} exact duplicate questions")
    check("no_near_duplicate_questions", not near, f"{len(near)} near-duplicate pairs >= 0.90")

    blob = json.dumps(artifact, ensure_ascii=False).lower()
    leaked = [m for m in SECRET_MARKERS if m.lower() in blob]
    check("no_known_secrets", not leaked, f"{len(leaked)} secret markers present")

    pii_hits = []
    for pattern, label in PII_PATTERNS:
        if pattern.search(json.dumps(artifact, ensure_ascii=False)):
            pii_hits.append(label)
    check("no_pii_patterns", not pii_hits, f"patterns matched: {pii_hits or 'none'}")

    excluded_paths = {x["source_file"] for x in EXCLUSIONS}
    used_excluded = sorted(
        {e["source_file"] for e in entries} & excluded_paths
    )
    check("no_excluded_sources_used", not used_excluded, f"excluded sources referenced: {used_excluded or 'none'}")

    check(
        "entry_count",
        artifact["metadata"]["total_entries"] == len(entries),
        f"metadata={artifact['metadata']['total_entries']} actual={len(entries)}",
    )

    distribution = Counter(e["topic"] for e in entries)
    check(
        "topic_distribution",
        artifact["metadata"]["topic_distribution"] == dict(sorted(distribution.items())),
        "metadata topic_distribution matches entries",
    )

    passed = all(c["passed"] for c in checks)
    return {
        "validated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "passed": passed,
        "checks_total": len(checks),
        "checks_passed": sum(1 for c in checks if c["passed"]),
        "checks": checks,
        "near_duplicate_pairs": near,
    }


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    artifact, _ = build()

    validation = validate(artifact)
    if not validation["passed"]:
        (OUT / "validation_report.json").write_text(
            json.dumps(validation, indent=2) + "\n", encoding="utf-8"
        )
        print("VALIDATION FAILED")
        for c in validation["checks"]:
            if not c["passed"]:
                print(f" - {c['check']}: {c['detail']}")
        return 1

    (OUT / "consolidated_faq_kb.json").write_text(
        json.dumps(artifact, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    exclusions = {
        "generated_at": artifact["metadata"]["generated_at"],
        "policy": (
            "These sources are in the discovery set but were withheld from the consolidated FAQ and "
            "from all publication sinks because they contain secrets, personal data, privileged or "
            "material non-public information, or unpatched vulnerability details. Field values are not "
            "reproduced here by design."
        ),
        "excluded_sources": EXCLUSIONS,
        "publication_decision": (
            "Do not publish, mirror, email, or index any excluded source without the data owner's "
            "explicit approval and an appropriate access-controlled destination."
        ),
    }
    (OUT / "exclusion_register.json").write_text(
        json.dumps(exclusions, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (OUT / "validation_report.json").write_text(
        json.dumps(validation, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    print(f"wrote {OUT / 'consolidated_faq_kb.json'}")
    print(f"entries: {artifact['metadata']['total_entries']}")
    print(f"topics: {artifact['metadata']['topic_distribution']}")
    print(f"validation: {validation['checks_passed']}/{validation['checks_total']} passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
