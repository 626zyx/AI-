# IT Onboarding Setup Runbook

*Fetched from GitLab repository: root/it-onboarding — branch: main*

## Purpose
This runbook documents the IT provisioning steps for new hires. It is maintained by the IT Operations team and updated quarterly.

## Provisioning Timeline

| Task | Owner | Timing | SLA |
|------|-------|--------|-----|
| Create accounts (SSO, email, HRIS) | IT Provisioning | T-5 business days | 99% |
| Configure laptop with base image | IT Provisioning | T-3 business days | 95% |
| Assign software licenses based on role | IT Provisioning | T-2 business days | 90% |
| Grant building badge access | Facilities | T-1 business day | 85% |
| Create JIRA/Confluence/GitHub accounts | IT Provisioning | Day 0 | 95% |
| Grant department-specific tool access | IT Provisioning | Day 1-3 | 80% |
| Create VPN account and send setup guide | IT Security | Day 0 | 98% |

## Role-Based Software Matrix

| Role | JetBrains | GitHub EE | AWS Dev | Docker Desktop | Figma | Salesforce |
|------|-----------|-----------|---------|---------------|-------|------------|
| Engineering | Yes | Yes | Yes | Yes | No | No |
| Design | No | No | No | No | Yes | No |
| Product | No | Yes | No | No | Yes | No |
| Sales | No | No | No | No | No | Yes |
| Executive | No | Yes | No | No | No | No |

## Common Provisioning Delays

1. **Cost Center Mismatch:** The most common delay. HR enters the cost center during HRIS creation. If incorrect, IT cannot provision accounts until HR corrects it. Average delay: 1-2 business days.
2. **Manager Approval for Licenses:** JetBrains, AWS, and database tools require explicit manager approval. Managers should approve within 24 hours of the request.
3. **Floor Access Provisioning:** Facilities handles badge and zone access. The security systems team syncs overnight. New hires starting on Monday may not have floor access until Tuesday if the request was submitted Friday afternoon.

## New Hire IT Checklist (to be completed by Day 3)

- [ ] Laptop received and logged in with SSO
- [ ] Connected to Corp-Secure WiFi
- [ ] VPN client installed and tested
- [ ] Email configured (Outlook and mobile)
- [ ] 2FA enabled and backup codes saved
- [ ] 1Password Teams account activated
- [ ] GitHub SSH key configured
- [ ] JIRA and Confluence access confirmed
- [ ] Department Slack channels joined
- [ ] Printer drivers installed (if in office)
- [ ] Software licenses confirmed in software portal
