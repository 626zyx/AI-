# Security Incident Postmortem — INC-2024-031
# Classification: Confidential — Security Team and Executives Only

## Incident Overview

**IncidentID:** INC-2024-031  
**Date Detected:** 2024-11-14 03:22 UTC  
**Date Contained:** 2024-11-14 07:45 UTC  
**Date Resolved:** 2024-11-16 18:00 UTC  
**Severity:** P1 — Critical  
**Incident Commander:** Marcus Rivera, Director of Security Operations  

## root_cause

The incident was caused by a compromised CI/CD pipeline token with excessive permissions. An attacker gained access to the pipeline service account credentials through a phishing attack on a DevOps engineer. The engineer's 1Password vault was not configured to require 2FA for every access (the default "remember for 30 days" setting was enabled on their workstation).

The compromised token had `write` access to the production container registry and `read` access to the secrets manager, allowing the attacker to:
1. Pull container images and inspect environment variables for additional secrets
2. Inject a modified container image into the production registry
3. Deploy the modified image through a routine deployment pipeline

The modified image contained a credential harvester that exfiltrated database connection strings to an external command-and-control server.

## blast_radius

### Systems Affected
- Production container registry (all images potentially compromised)
- Production database (read-only access exfiltrated — schema and metadata, not customer data)
- CI/CD pipeline (service account credentials rotated post-incident)
- Internal monitoring system (logs tampered with to suppress detection)

### Data Exposure Assessment
- **Customer data:** NO direct customer PII or content data was accessed. The database exfiltration was limited to schema metadata, table names, and row counts. The production database connection used by the compromised image had column-level encryption on PII fields.
- **Internal data exposed:** YES — CI/CD configuration, deployment scripts, container image build arguments (which contained some API keys for third-party services), and monitoring architecture documentation.
- **Credentials compromised:** 1 CI/CD service account, 4 third-party API keys (rotated within 2 hours), 1 monitoring dashboard admin account.

### Customers Notified
- No customer data breach notification required (confirmed by legal and privacy teams after forensic analysis).
- 3 enterprise customers on shared infrastructure were proactively notified of the incident and the remediation actions taken (per their contractual security notification requirements).

## IoCs (Indicators of Compromise)

The following IoCs were identified during the investigation and have been added to the threat detection platform:

1. **IP Addresses:**
   - 185.173.36.84 (C2 server — primary)
   - 45.155.205.19 (C2 server — fallback)
   - 91.240.118.221 (phishing infrastructure)

2. **Container Image Hashes:**
   - sha256:a7f3c91b8d2e... (compromised api-gateway image)
   - sha256:8b2d41e9f0c6... (compromised worker image)

3. **File System Artifacts:**
   - /tmp/.cred-reader.so (credential harvester binary)
   - /etc/cron.d/system-update (persistence mechanism)
   - ~/.ssh/authorized_keys entry: ssh-rsa AAAAB3NzaC1... m0n1t0r@c2

4. **Network Signatures:**
   - Outbound HTTPS to *.metrics-collector.net (C2 domain — now sinkholed)
   - DNS queries for api.internal-monitoring.co (typosquatted internal domain)

## Timeline

| Time (UTC) | Event |
|------------|-------|
| Nov 13 14:15 | Phishing email delivered to DevOps engineer (disguised as GitHub security alert) |
| Nov 13 14:22 | Engineer clicks link and enters credentials on phishing page |
| Nov 13 14:23 | Attacker accesses 1Password vault (2FA not required due to "remember for 30 days") |
| Nov 13 22:10 | Attacker uses CI/CD service account token to pull container images |
| Nov 14 01:45 | Modified api-gateway image pushed to production registry |
| Nov 14 02:30 | Routine deployment picks up modified image — credential harvester activates |
| Nov 14 03:22 | SOC detects anomalous outbound traffic to unknown IP (alert fired) |
| Nov 14 03:30 | Incident Commander declares P1 incident |
| Nov 14 04:15 | Compromised service account identified and token revoked |
| Nov 14 05:00 | All deployments paused; traffic shifted to known-good image versions |
| Nov 14 07:45 | C2 communication blocked at firewall; incident contained |
| Nov 14-16 | Forensic analysis, credential rotation, security control hardening |
| Nov 16 18:00 | Incident resolved; post-incident review scheduled |

## Remediation Actions

### Immediate (Completed by Nov 14)
- [x] Revoked all CI/CD service account tokens
- [x] Rotated all third-party API keys
- [x] Blocked C2 IPs and domains at firewall
- [x] Reverted all production deployments to known-good images
- [x] Reset MFA for all DevOps team members

### Short-Term (Completed by Nov 20)
- [x] Enforced mandatory 2FA for every 1Password vault access (removed "remember for 30 days")
- [x] Added pipeline service account token scoping (read-only for registry; no secrets manager access)
- [x] Deployed container image signing (Cosign) — unsigned images blocked from deployment
- [x] Enhanced outbound traffic monitoring with threat intelligence feed integration
- [x] Mandatory phishing training for all engineering staff (completed Nov 18)

### Long-Term (In Progress)
- [ ] Implement Just-In-Time access for CI/CD service accounts (target: Q1 2025)
- [ ] Deploy runtime container scanning in production (target: Q1 2025)
- [ ] Separate build and deploy service accounts with zero-standing-privilege model
- [ ] Quarterly red team exercises focused on CI/CD pipeline attacks

## Lessons Learned

1. **"Remember for 30 days" on 2FA is a liability.** Even with a password manager, a phished workstation session can lead to full credential compromise. Enforce per-access 2FA for all sensitive systems.
2. **Service account permissions were overly broad.** The CI/CD service account had far more access than needed. Apply least-privilege rigorously — service accounts should have exactly the permissions required for their specific job.
3. **Pipeline artifact integrity was not verified.** Any pipeline could push any image to production. Image signing with Cosign would have prevented the compromised image from deploying.
4. **Outbound traffic monitoring caught this.** The SOC alert on anomalous outbound traffic was the detection trigger. Without it, the credential harvester might have run for weeks.
