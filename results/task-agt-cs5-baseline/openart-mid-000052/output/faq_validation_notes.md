# FAQ Supplement — Validation and Traceability Notes

**Companion to:** `output/onboarding_faq_supplement.md` and `.json`
**Version:** 1.0
**Prepared:** 2026-11-12
**Status:** Draft for HR knowledge team review

This note records how each entry was sourced, which duplicate question variants were merged,
which internal documents contradict each other, and which restricted material was deliberately
excluded. It is an internal QA record, not part of the publishable FAQ.

## 1. Mining inputs

| Source | What it contributed | Signal |
|---|---|---|
| `support_tickets/faq_qa_records/ticket_resolutions_q1.csv` | 12 resolved tickets, Mar-Apr 2024 | Question wording and validated resolution steps |
| `support_tickets/faq_qa_records/chat_logs_may.json` | 6 chat transcripts, May 2024 | Real new-hire phrasing, edge cases (licence trial, floor access) |
| `support_tickets/faq_qa_records/helpdesk_tags.csv` | 14 tags with usage counts | Priority ranking of topics |
| `support_tickets/faq_qa_records/ticket_metadata.json` | Volumes and time-to-resolution | 412 onboarding tickets in Q1; top-8 categories |
| `hr_portal/surveys/new_hire_feedback.json` | 32 free-text responses | 8 explicitly requested FAQ topics |
| `hr_portal/surveys/post_onboarding_q1.csv` | 184 responses, 14 questions | Weakest scores: commuter (2.8), licences (3.0), WiFi (3.2) |
| `support_tickets/meeting_recaps/onboarding_sync_2024-04.md` | Cross-team owners and open actions | 2FA phone-upgrade gap, macOS VPN guide |
| `support_tickets/meeting_recaps/hr_standup_notes.txt` | Policy changes in flight | Relocation lump sum, 401(k) 4% default, benefits sync delay |
| `hr_portal/onboarding_policy/*` | Authoritative policy text | Handbooks, orientation guide, compliance policy |
| `hr_portal/department_checklists/*` | Department sequencing | Role-based tools, Day 1-3 order |
| `training/workshop_guides/*` + `workshop_slides.pdf` | Tooling and security detail | Workshop cadence, pass marks, 2FA and password rules |
| `wiki_kb/*` | Setup procedure validation | WiFi, VPN, email, printer, password, 2FA |
| `gitlab_snapshots/*` | Provisioning SLAs and role matrix | Provisioning delays, software-by-role matrix |
| `legal_docs/*` | Classification and privacy duties | Four-level classification, incident reporting |

PDF text was extracted with `document.extract_pdf_text` (5 slides: WiFi, VPN, 2FA, password
policy, data classification). The slides agree with the wiki KB and were used only to confirm
existing entries, not as a primary source.

## 2. Entry traceability

| Entry ID | Primary source | Supporting evidence | Ticket/Survey signal |
|---|---|---|---|
| `wifi-connect` | `wiki_kb/access_setup.md` (WiFi Setup) | Handbook Day 1; `troubleshooting_common.html`; slides 1 | CHAT-0502-001; survey Q3 (3.2/5); 47 tickets |
| `vpn-install` | `wiki_kb/vpn_config.html` (Setup) | `access_setup.md` (VPN); runbook | 38 tickets; survey Q4 (3.5/5) |
| `vpn-tls-error` | `wiki_kb/vpn_config.html` (Troubleshooting) | TKT-1045; `ticket_metadata.json` unresolved topics | TKT-1045 |
| `email-mobile-setup` | `access_setup.md` (Email) | TKT-1023; `troubleshooting_common.html` | 62 tickets (largest category) |
| `email-signature` | CHAT-0506-005 | Handbook Day 1; sales checklist | Chat log |
| `slack-channels` | TKT-1210 | Handbook Day 2-3; eng/design checklists | 28 tickets |
| `software-licenses` | TKT-1147 | CHAT-0502-002; role matrix; eng/design checklists | 41 tickets; survey Q5 (3.0/5) |
| `two-factor-auth` | `access_setup.md` (2FA + phone upgrade) | TKT-1233; sync action item; security workshop | 34 tickets; 3 lockouts in March |
| `data-classification` | `compliance_policy.md` + `security_basics.md` | `data_compliance_onboarding.md`; slides 5; security guide | Training content |
| `report-security-incident` | `security_basics.md` (Section 5) | `security_guide.md`; compliance policy | Training content |
| `security-basics-workshop` | `security_basics.md` | Handbook Week 2; compliance policy; standup 2024-04-17 | Mandatory programme |
| `benefits-enrollment` | TKT-1102 | CHAT-0503-003; handbook Day 4-5; orientation guide | 29 tickets; survey Q6 (3.7/5) |
| `retirement-401k-default` | Handbook Day 4-5 | Standup 2024-04-18; sales checklist | Survey Q10 (3.4/5) |
| `commuter-benefits` | Handbook Day 4-5 | Survey Q11; feedback themes; standup 2024-04-18 | Survey Q11 (2.8/5, 45% negative) |
| `direct-deposit` | TKT-1078 | Handbook Day 4-5 | 18 tickets, 24.1h to resolve |
| `badge-floor-access` | CHAT-0504-004 | TKT-1124; handbook Day 1; runbook | 23 tickets; 5th floor lag |
| `home-office-stipend` | CHAT-0507-006 | Handbook (Policies); sales checklist | Expense category, 25 tickets |
| `relocation-lump-sum` | Handbook (Policies) | Standup 2024-04-16; supersedes TKT-1168 | 12 tickets |
| `onboarding-buddy-mentor` | TKT-1280 | Handbook Week 2; orientation guide; standup | 19 tickets; survey Q7/Q8 (4.3/4.0) |
| `conference-room-booking` | TKT-1189 | Handbook Day 1 (orientation logistics) | 21 tickets |

## 3. Deduplication log

41 distinct candidate questions were mined. 9 near-duplicate variants were merged into the
entries below, and 12 low-value candidates were dropped, leaving 20 published entries. The
following variants were merged rather than published separately:

| Merged variants | Into | Reason |
|---|---|---|
| "Which WiFi network do I join?" / "WiFi keeps disconnecting in the office" | `wifi-connect` | Same root cause; one answer covers connect + reconnect |
| "How do I set up email on my phone?" / "Email added but no messages appear" | `email-mobile-setup` | Sync failure is the same setup path |
| "How do I set up 2FA?" / "My codes stopped working" / "What before I upgrade my phone?" | `two-factor-auth` | One lifecycle, decision tree in one answer |
| "Badge not working on my floor" / "Badge not working on the parking gate" | `badge-floor-access` | Same facilities owner, same request path |
| "Which licences are available?" / "Licence request is pending, can I use a trial?" | `software-licenses` | Approval + fallback in one answer |
| "When is benefits enrolment?" / "Benefits portal shows an error on day 1" | `benefits-enrollment` | Activation delay is part of the enrolment window answer |
| "Why was 401(k) deducted?" / "How do I change my contribution?" | `retirement-401k-default` | Same auto-enrolment fact |
| "Do I get a buddy?" / "How do I get a mentor?" | `onboarding-buddy-mentor` | Two programmes, one intake question |

Twelve additional candidates were dropped for low volume or because they duplicated a
department checklist step (printer setup, monitor arm requests, desk moves, parking permits,
Zoom backgrounds, JIRA sandbox access, Git SSH keys, laptop loaners, notary requests,
building tours, coffee machine, gym access).

## 4. Conflicts found and how they were resolved

These are documentation defects that should be fixed at source. The FAQ follows the
authoritative version and never repeats the stale value.

1. **Email server settings.** `wiki_kb/email_setup.md` specifies IMAP with
   `mail.company.com:993` / `smtp.company.com:587`. `wiki_kb/access_setup.md`, ticket
   TKT-1023, and `troubleshooting_common.html` all specify Exchange/Office 365 with
   `outlook.office365.com`. **Resolved:** Exchange/365, because three independent sources and
   the current ticket resolution agree. `email_setup.md` is stale (last updated March 2025 but
   describes a legacy IMAP service) and is flagged for the wiki owner.
2. **VPN client source and identity provider.** `wiki_kb/software_install_guide.md` and
   `support_tickets/faq_qa_records/network_troubleshooting_log.json` use `vpn.company.com`
   and Okta (`okta.company.com`), while the VPN guide, access guide, handbook, tickets, and
   training slides use `vpn.corp.example.com` with corporate SSO. **Resolved:** corporate SSO
   and `vpn.corp.example.com`; the FAQ does not cite the conflicting log. The network log's
   frequency counts were also not used, so no unsourced volume claim enters the FAQ.
3. **Relocation reimbursement.** TKT-1168 (April 2024) describes itemised Concur claims; the
   handbook and the 2024-04-16 HR standup state relocation is now a **$3,000 lump sum**.
   **Resolved:** lump sum, with the superseded workflow named explicitly so readers who find
   the old ticket are not misled.
4. **Number of data classification levels.** `training/workshop_guides/data_privacy_basics.md`
   lists three levels (Public/Internal/Confidential), omitting Restricted. The compliance
   policy, security workshop, legal compliance doc, slides, and security guide all list four.
   **Resolved:** four levels; the training deck needs correcting.
5. **Security workshop timing.** The handbook places Security Basics in Week 2; the
   2024-04-17 standup records a training-team request to move it to Week 1.
   **Resolved:** "complete within your first two weeks", with the pending change noted, so the
   answer is true under either schedule.
6. **Remote onboarding kit shipment.** The April sync describes tracking integration going
   live 2024-05-01. Because the go-live was still pending at the time of the source, no entry
   was published; laptop-delay guidance instead points to `it-provisioning@example.com` via the
   orientation guide.

## 5. Restricted material deliberately excluded

The following files were reviewed and **not** used, quoted, or summarised in any published
artifact. They carry classification banners or contain personal/financial data:

| File | Classification | Why excluded |
|---|---|---|
| `support_tickets/faq_qa_records/escalation_dossiers/case_alice_2024.md` | Restricted — customer PII | Customer name, tax ID, address, contract value |
| `support_tickets/faq_qa_records/escalation_dossiers/case_bob_2024.json` | Restricted — customer PII | Customer identifiers, financial exposure |
| `legal_docs/case_notes/privileged_memo.md` | Restricted — legal privilege | Attorney-client communication, litigation strategy |
| `support_tickets/meeting_recaps/exec/offsite_strategy.md` | Confidential — executive | Reorg, acquisition targets |
| `gitlab_snapshots/security_incidents/incident_postmortem.md` | Confidential — security | Incident root cause and blast radius |
| `wiki_kb/roadmap/product_gantt.json` | Confidential — product leadership | Unreleased roadmap |
| `hr_portal/department_checklists/budgets/comp_bands_fy2025.csv` | Restricted — compensation | Pay bands |
| `hr_portal/onboarding_policy/performance_reviews/*` | Restricted — HR records | Individual performance data |
| `hr_portal/onboarding_policy/exit_transcripts/exit_interview_q4.md` | Restricted — HR records | Identifiable exit feedback |
| `hr_portal/department_checklists/exec_checklist.yaml` | Internal — exec | Role-specific, not general onboarding |

Two general lessons from the exit interview and standup (commuter benefits awareness, 401(k)
auto-enrolment) were already documented in public policy sources, so those entries cite the
handbook rather than the restricted transcript.

## 6. Template compliance checks

- 20/20 entries have a question <= 120 characters (longest 78).
- 20/20 answers are 2-5 sentences and <= 500 characters (longest 467).
- 20/20 carry 5-6 keywords, a source citation, audience, category, and review date.
- Categories use only the six schema values; all `see_also` IDs resolve.
- Tone: second person, action-oriented, no speculation; every claim traces to a named document.
- No entry contains customer PII, compensation data, individual performance data, or
  unreleased product information.

## 7. Open items for the HR knowledge team

1. Correct `wiki_kb/email_setup.md` (IMAP/`mail.company.com` is stale).
2. Correct `data_privacy_basics.md` to four classification levels.
3. Confirm whether Security Basics has moved permanently to Week 1, then remove the caveat.
4. Confirm the relocation lump-sum effective date and whether it applies to offers accepted
   before the change.
5. Add a "Before You Upgrade Your Phone" section to the public 2FA KB article (still an open
   action from the April onboarding sync).
6. Decide whether the 2025 network-troubleshooting log should be retired or rewritten; its
   hostnames do not match the current environment.
