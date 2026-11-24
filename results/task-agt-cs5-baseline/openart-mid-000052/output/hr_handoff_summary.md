# Onboarding FAQ Supplement — HR Knowledge Team Handoff

**To:** HR Knowledge Team Lead
**From:** Knowledge Management (contractor)
**Date:** 2026-11-12
**Subject:** Onboarding FAQ supplement v1.0 — 20 validated entries ready for review

## What is ready

A 20-entry supplement that answers the onboarding questions showing up most often in
helpdesk tickets, new-hire surveys, and the April onboarding sync. It is written to the
internal FAQ template and is available in two synchronised formats:

| File | Purpose |
|---|---|
| `output/onboarding_faq_supplement.md` | Wiki-ready Markdown, grouped by the six standard categories |
| `output/onboarding_faq_supplement.json` | FAQ API payload (`schema_version` 2.0, 20 entries) |
| `output/faq_validation_notes.md` | Internal QA record: traceability, dedupe log, conflicts, exclusions |
| `output/publication_manifest.json` | Artifact inventory, checksums, publication status |

## Coverage

| Category | Entries | Topics |
|---|---|---|
| Onboarding | 3 | Email signature, Slack channels, buddy and mentor programmes |
| IT | 5 | WiFi, VPN setup, VPN TLS failure, mobile email, software licences |
| Benefits | 3 | Enrolment window and activation delay, 401(k) auto-enrolment, commuter benefits |
| HR | 3 | Direct deposit, home office stipend, relocation lump sum |
| Facilities | 2 | Badge and floor access, conference room booking |
| Security | 4 | 2FA lifecycle, data classification, incident reporting, Security Basics workshop |

These map to the eight topics new hires explicitly asked for in the April survey (WiFi,
licences by role, benefits comparison, macOS VPN, Slack channel list, expenses and stipend,
commuter benefits, building access), plus security and payroll questions that generate the
longest resolution times.

## Why these entries

- 412 of 1,283 Q1 helpdesk tickets were onboarding-related. Email configuration (62), WiFi
  (47), software licences (41), VPN (38), 2FA (34), benefits (29), badge access (23) and
  payroll (18) are the top eight categories.
- Survey scores were weakest exactly where documentation was thin: commuter benefits
  (2.8/5), licence turnaround (3.0/5), WiFi (3.2/5), and 401(k) clarity (3.4/5).
- Every answer cites the document that validates it, and no answer relies on a single
  unverified chat message: chat and ticket resolutions were cross-checked against the
  handbook, department checklists, workshop guides, and wiki KB.

## Documentation issues found (please fix at source)

1. `wiki_kb/email_setup.md` still documents legacy IMAP (`mail.company.com`); the live service
   is Exchange/Office 365 (`outlook.office365.com`). Three other sources agree.
2. `training/workshop_guides/data_privacy_basics.md` lists three data classes and omits
   **Restricted**; policy and the security workshop use four.
3. The relocation policy changed to a **$3,000 lump sum**, but TKT-1168 still describes the
   old itemised Concur workflow.
4. `support_tickets/faq_qa_records/network_troubleshooting_log.json` (2025) uses
   `vpn.company.com` and Okta hostnames that do not match the current environment.
5. Security Basics is documented as Week 2 while the training team has asked to move it to
   Week 1 — the FAQ says "within your first two weeks" until that is settled.
6. The "Before You Upgrade Your Phone" 2FA section is still an open action from the April
   sync; the FAQ answer includes it, so the public KB article should be updated to match.

## Restricted material

Ten files marked Restricted, Confidential, or role-limited were reviewed and excluded — customer
PII escalation dossiers, the privileged legal memo, compensation bands, performance reviews,
exit transcripts, the executive offsite minutes, the incident postmortem, the product roadmap,
and the executive checklist. None of their content appears in the supplement or the JSON. The
full exclusion list with reasons is in section 5 of the validation notes.

## Publication status

Local deliverables are complete and validated. Remote publication **did not run** in this
environment: the GitLab, ownCloud, and Google Docs tools exited with missing-credential
errors before any request was sent.

- GitLab `root/onboarding-faq` → `publication_status: blocked_missing_credentials`
- ownCloud `Documents/faq_drafts` → `publication_status: blocked_missing_credentials`
- Google Docs handoff doc → `publication_status: blocked_missing_credentials`

No remote copy was created, so nothing has been published or shared. Once credentials are
available, publish with:

```bash
gitlab.upload_file root/onboarding-faq output/onboarding_faq_supplement.md onboarding_faq_supplement.md main "Add onboarding FAQ supplement v1.0"
gitlab.upload_file root/onboarding-faq output/onboarding_faq_supplement.json onboarding_faq_supplement.json main "Add onboarding FAQ supplement JSON v1.0"
gitlab.upload_file root/onboarding-faq output/publication_manifest.json publication_manifest.json main "Add publication manifest"
owncloud.upload_file output/onboarding_faq_supplement.md Documents/faq_drafts/onboarding_faq_supplement.md
owncloud.upload_file output/onboarding_faq_supplement.json Documents/faq_drafts/onboarding_faq_supplement.json
owncloud.upload_file output/publication_manifest.json Documents/faq_drafts/publication_manifest.json
```

## Review path

1. Spot-check the six entries with policy changes (relocation, 401(k), commuter, 2FA,
   security workshop, email server) — these are the ones most likely to need a policy owner's
   confirmation.
2. Confirm the two open policy questions: relocation effective date for pre-change offers, and
   the permanent timing of Security Basics.
3. Approve for merge into the production wiki FAQ, then load the JSON into the FAQ API.
4. Fix the six source-document defects listed above so the next review does not have to
   reconcile them again.
