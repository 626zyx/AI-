# Onboarding FAQ Supplement — Handoff Summary

**To:** HR Knowledge Team Lead
**From:** HR Knowledge Management (agent-assisted build)
**Date:** 2026-11-13
**Subject:** Onboarding FAQ supplement v1.0 — ready for review
**Supplement version:** 1.0 · 50 entries · last reviewed 2026-11-13

---

## 1. What this is

A supplement to the employee onboarding FAQ covering the questions new hires actually ask
in their first weeks. Each entry is a single question with a validated answer, a category,
3-8 search keywords, a source citation, a target audience, a review date, and a stable ID
for the FAQ API.

**Companion files**

| File | Purpose |
|------|---------|
| `onboarding_faq_supplement.md` | Wiki-ready Markdown, grouped by category |
| `onboarding_faq_supplement.json` | FAQ API payload, `templates/faq_schema.json` (schema v2.0) |
| `publication_manifest.json` | Artifact list, per-entry source traceability, exclusions, conflicts |

## 2. Where the questions came from

Mining was exhaustive across `support_tickets/`, `hr_portal/`, `training/`, `wiki_kb/`,
`legal_docs/`, `gitlab_snapshots/`, `templates/` and `owncloud_uploads/` — 49 files,
including the subdirectories that carry a classification label.

| Evidence | Volume | What it told us |
|----------|--------|-----------------|
| Ticket resolutions | 12 records | Exact fixes for VPN, payroll, benefits, badge, license, calendar, Slack cases |
| Helpdesk chat logs | 6 conversations | WiFi/domain field, JetBrains authorization, benefits sync, floor access, signature format, stipend limits |
| Network troubleshooting log | 6 entries | Frequency-ranked answers: VPN 142, WiFi drops 89, remote access 74, Drive access 63, 2FA 56, endpoint scan 38 |
| Post-onboarding survey | 14 items, 184 respondents | Lowest scores: commuter benefits 2.8/5, software licenses 3.0/5, WiFi 3.2/5, 401(k) clarity 3.4/5 |
| New-hire feedback survey | 32 responses, 5 themes | Tool access delays (8), WiFi confusion (6), benefits clarity (5) |
| Meeting recaps | 2 | Provisioning SLAs, remote kit shipping, relocation policy change, 2FA upgrade lockouts |
| Requested-FAQ list | 8 topics | Directly became entries: WiFi, licenses, benefits comparison, VPN on macOS, Slack channels, expenses, commuter, floor access |

## 3. What's in the supplement

| Category | Entries |
|----------|---------|
| Onboarding | 10 |
| IT | 16 |
| Benefits | 6 |
| HR | 5 |
| Facilities | 3 |
| Security | 10 |
| **Total** | **50** |

**Answers that close a known gap**

- **WiFi** — Corp-Secure vs Corp-Guest, identity field, blank domain, certificate prompt, plus a separate disconnect-recovery path. Survey Q3 scored 3.2/5 and this was one of the highest-volume ticket categories (47 tickets, 3.2 h average resolution).
- **VPN** — v4.2 client, gateway `vpn.corp.example.com`, macOS *Allow* prompt, TLS handshake and certificate troubleshooting, which sites need VPN (Wiki and ownCloud yes; Jira and GitLab via SSO).
- **Software licenses** — role matrix (Engineering/Design/Product/Sales/Executive), the manager-approval step that adds 2-3 days, and the cost-center mismatch behind "not authorized". Survey Q5 scored 3.0/5.
- **Benefits** — 30-calendar-day window, portal activation within 48 hours, retroactive coverage, PPO Gold vs HDHP/HSA, and the 401(k) 4% auto-enrollment that surprises people on their first paycheck.
- **Commuter benefits** — enrollment path, the lowest-scoring survey item at 2.8/5.
- **Money** — $500 home-office stipend (Concur, 60 days, over-limit rule) and the $3,000 relocation lump sum.
- **Access** — badge/floor provisioning with the 24-hour temporary card route, parking gate codes within 4 hours, and IT provisioning SLAs from T-5 to Day 3.
- **Security** — 10 entries: 2FA setup, phone upgrade, code recovery, password rules, phishing reporting, incident reporting, data classification, customer-data storage, split tunneling, SSH/token hygiene.

## 4. Source handling — what was deliberately left out

All restricted and privileged documents were reviewed, then excluded from the published
supplement. None of them answers a new-hire onboarding question, and republishing them in a
wiki page and a GitLab repository would breach the handling rules the FAQ itself documents.

| Document | Classification | Why excluded |
|----------|---------------|--------------|
| `legal_docs/case_notes/privileged_memo.md` | Restricted — attorney-client privilege | Settlement authority, litigation strategy |
| `support_tickets/faq_qa_records/escalation_dossiers/` (2 files) | Restricted — customer PII | Customer name, tax ID, address, account number |
| `support_tickets/meeting_recaps/exec/offsite_strategy.md` | Confidential — executive only | Reorg, M&A targets, headcount plan |
| `hr_portal/onboarding_policy/exit_transcripts/` | Confidential — HR restricted | Identifiable exit record with salary and equity |
| `hr_portal/onboarding_policy/performance_reviews/` (2 files) | Confidential — HR restricted | Identifiable individual ratings and PIP status |
| `hr_portal/department_checklists/budgets/comp_bands_fy2025.csv` | Confidential — compensation | Unpublished salary bands and equity grants |
| `wiki_kb/roadmap/product_gantt.json` | Confidential — product leadership | Unreleased roadmap and embargoed pricing |
| `gitlab_snapshots/security_incidents/incident_postmortem.md` | Confidential — security/exec | Live indicators of compromise |

The onboarding themes in those documents informed the topic list only. No individual record,
figure, or quotation from them appears anywhere in the supplement, and no named employee,
customer, or candidate is referenced in any entry.

Engagement and pulse survey aggregates were also left out: they are Internal rather than
restricted, but they answer no onboarding question.

## 5. Conflicts for HR to resolve before publication

1. **Relocation.** TKT-1168 (2024-04-12) describes itemized relocation reimbursement through Concur; the HR standup notes (week of 2024-04-15) and the handbook record the newer $3,000 lump sum. The supplement publishes the $3,000 lump sum and keeps the Concur filing step — confirm whether receipts are still required.
2. **Data classification levels.** The security guide and access setup article define four levels (Public, Internal, Confidential, Restricted); the data privacy workshop guide describes three. The supplement follows the four-level policy; the workshop deck should be aligned.

## 6. Stale sources worth refreshing

`wiki_kb/vpn_config.html` (updated 2024-04-10), `design_onboarding.yaml` (v1.9), `exec_checklist.yaml` (v1.2), `ticket_resolutions_q1.csv` (Q1 2024), and the undated `new_hire_handbook.md`. Entries are dated 2026-11-13 as the review date; the underlying policy values still need owner re-confirmation.

## 7. Publication status

| Target | Status | Detail |
|--------|--------|--------|
| GitLab `root/onboarding-faq` | **Blocked** | No `GITLAB_BASEURL` / `GITLAB_ACCESS_TOKEN` in this environment |
| ownCloud `Documents/faq_drafts` | **Blocked** | No `OWNCLOUD_URL` / `OWNCLOUD_USERNAME` / `OWNCLOUD_PASSWORD` |
| Google Docs | **Blocked** | No `DTAP_GOOGLEDOCS_URL` configured |

Upload-ready copies are staged in `owncloud_uploads/Documents/faq_drafts/`, mirroring the
ownCloud target path, so publication is a straight copy once credentials are available.
`publication_manifest.json` records the exact status and error for each target.

## 8. Review checklist

- [ ] Confirm the $3,000 relocation lump sum and whether receipts are still required.
- [ ] Confirm the Figma license link in `design_onboarding.yaml` was corrected (open action item from the 2024-04-08 sync).
- [ ] Confirm the "Before You Upgrade Your Phone" section landed in the 2FA KB article (open action item).
- [ ] Re-verify internal URLs before mirroring into the production wiki.
- [ ] Decide whether the four manager-facing entries (provisioning timeline, desk setup, struggling new hire, delayed laptop) live in the new-hire wiki or the manager handbook.

Once approved, the Markdown drops into the wiki FAQ page structure defined in
`wiki_kb/faq_page_template.md`, and the JSON can be loaded through the FAQ API as
`schema_version` 2.0.
