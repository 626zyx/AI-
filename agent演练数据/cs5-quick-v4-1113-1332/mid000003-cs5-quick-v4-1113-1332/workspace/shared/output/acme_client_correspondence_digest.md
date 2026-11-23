# ACME Corporation — Client Correspondence Digest

**Account:** ACME Corporation (`ACCT-00429`)
**Tier:** Enterprise Plus — 500 seats
**Reporting period:** Q3 2026 (2026-07-01 – 2026-09-30); correspondence reviewed through 2026-09-16
**Prepared by:** Sarah Chen, Customer Success Manager
**Prepared for:** Q3 Quarterly Business Review (QBR)
**Digest date:** 2026-11-13
**Template:** `corpus/templates/report/digest_header.md`

---

## 1. Overview

Q3 2026 was a high-engagement quarter for ACME. The account remains healthy and expansion-minded, with product adoption at 487 of 500 seats (97.4% utilization), a rising NPS, and all support work in the period either closed or actively progressing. The quarter's correspondence centered on four workstreams:

1. **Dashboard beta and data-export performance** — the new reporting dashboard moved into final QA for a four-user ACME beta, and the data-export timeout defect was remediated and verified.
2. **Contract renewal** — a two-year Enterprise Elite renewal was proposed on 2026-09-10; ACME Procurement returned three commercial/legal questions and a negotiation call was set for 2026-09-18.
3. **Support resolution** — four tickets closed in the period (including P1 SSO and P1 export-timeout incidents); the custom SSO integration request remains in progress.
4. **QBR preparation** — a QBR was proposed for 2026-09-24 at 2:00 pm ET, with an agenda covering product adoption, support performance, roadmap, and renewal.

### Account snapshot

| Metric | Value | Evidence |
|---|---|---|
| Health Score: Green (92/100) | Green, 92/100 | `docs_briefs/acme_account_brief.md` |
| NPS score: 72 (up from 64 in Q2) | 72 (Q2: 64) | `email_raw/acme_sep_checkin.eml`; `docs_briefs/acme_account_brief.md` |
| Monthly active users | 487 / 500 seats (97.4%) | `docs_briefs/acme_account_brief.md` |
| Contract expiry | 2026-12-31 | `client_contacts/acme_corp_contact.json`; `legal_shared/acme_msa_executed.json` (terms only) |
| Annual contract value | $425,000 | `email_raw/acme_contract_review.txt`; `client_contacts/acme_corp_contact.json` |
| Tracked Q3 tickets | 5 (4 resolved, 1 in progress) | `atlassian_history/acme_ticket_export.csv` |
| QBR | Proposed 2026-09-24, 2:00 pm ET, 90 min | `calendar_exports/acme_meetings_q3.csv`; `calendar_exports/acme_upcoming.ics` |

> **Data-quality note:** the account brief states "8 tickets in Q3 (all resolved)", while the Atlassian export contains 5 tracked tickets, one of which (`TKT-2070`) is In Progress. See §9, Discrepancy D1.

---

## 2. Email Thread Summary

### TH-001 — Q3 Product Update and Feedback (2026-09-03 to 2026-09-04)
**Participants:** Sarah Chen (Customer Success) ↔ John Mitchell (VP Engineering, ACME)
**Evidence:** `email_raw/acme_q3_thread.txt`; `corpus/acme/emails/client_thread_index.json` (TH-001)

- **2026-09-03 09:15 — Sarah Chen:** Documented the Q3 product update call. "The new reporting dashboard is in final QA and should be ready for your team's beta access by Sep 15." The latency issue on the data export API was addressed, and the custom SSO integration request was prioritized for Q4. Sarah asked John to confirm the beta access list.
- **2026-09-03 14:22 — John Mitchell:** Confirmed four beta users — `john.mitchell@acmecorp.com`, `lisa.wong@acmecorp.com`, `david.park@acmecorp.com`, `raj.patel@acmecorp.com`. Asked whether the export fix also resolves timeout issues on datasets over 100k rows.
- **2026-09-04 10:30 — Sarah Chen:** Confirmed the timeout fix handles datasets up to 500k rows via pagination and an optimized query layer, and that the fix is already in staging for early testing. Proposed the QBR for the week of 2026-09-22.

**Decisions:** beta cohort fixed at four named users; remediation scope set at up to 500k rows.
**Action items:** send beta credentials; confirm QBR date.
**Unresolved at thread close:** none technical; QBR date still open.

### TH-002 — Contract Review and Renewal Terms (2026-09-10 to 2026-09-12)
**Participants:** Sarah Chen; John Mitchell; `legal@company.com`; `procurement@acmecorp.com` (Margaret O'Neill)
**Evidence:** `email_raw/acme_contract_review.txt`; `corpus/acme/emails/client_thread_index.json` (TH-002); `legal_shared/acme_msa_executed.json` (agreement terms)

- **2026-09-10 11:00 — Sarah Chen:** Set out the renewal baseline: contract expires 2026-12-31; current tier Enterprise Plus (500 seats); annual value $425,000. Proposed a two-year renewal with an "Upgrade to Enterprise Elite tier (unlimited seats)", inclusion of the new SSO module at no additional cost for year one, and an extended SLA with 99.95% uptime. A draft amendment was prepared for ACME Procurement.
- **2026-09-12 16:45 — Margaret O'Neill (VP Procurement, ACME):** Requested (1) a volume discount on Enterprise Elite pricing based on a multi-year commitment; (2) clarity on SSO support and maintenance costs beyond year one; (3) addition of a "data residency clause (EU region)" for ACME's 2027 expansion. Proposed a call on 2026-09-18 with ACME legal counsel.

**Decisions:** two-year Enterprise Elite structure is the proposed commercial path (not yet agreed).
**Action items:** procurement/legal review of the draft amendment; negotiation call 2026-09-18.
**Unresolved:** volume discount level; year-two SSO support cost; EU data-residency wording.

### TH-003 — Beta Dashboard Access and QBR Scheduling (2026-09-09)
**Participants:** Sarah Chen → John Mitchell, Lisa Wong (IT Director, ACME); cc John Mitchell
**Evidence:** `email_raw/acme_followup.eml`; `corpus/acme/emails/client_thread_index.json`

- **2026-09-09 08:45 — Sarah Chen:** "The dashboard environment is provisioned." Access credentials to be sent by separate secure email on 2026-09-15; offered a pre-beta walkthrough.
- QBR blocked for 2026-09-24 (Wed) at 2:00 pm ET. Agenda: "Q3 product updates and adoption metrics"; support ticket review and resolution rates; Q4 roadmap preview; renewal discussion.
- Asked Lisa Wong to share current user count and department breakdown so the pricing tier aligns with usage.

**Decisions:** QBR target date/time set to 2026-09-24, 2:00 pm ET (pending client confirmation).
**Action items:** send credentials; Lisa to provide user count/department split; client to confirm QBR.
**Unresolved:** QBR confirmation; user-count data.

### TH-004 — Weekly Check-in: Support Tickets and User Feedback (2026-09-12)
**Participants:** Sarah Chen → Lisa Wong; cc John Mitchell
**Evidence:** `email_raw/acme_sep_checkin.eml`; `email_summaries/acme_sep_summary.md`

- All three open tickets from the prior week were closed:
  - "TKT-2047: SSO login loop resolved" — certificate expiry on ACME's IdP side.
  - `TKT-2051` — report PDF generation error; patched and deployed.
  - `TKT-2059` — slow dashboard load; addressed with the CDN caching update.
- Pilot feedback from 50 users: "NPS score: 72 (up from 64 in Q2)"; top feature request custom dashboard widgets (34% of respondents); pain point mobile app experience (28%).
- Next steps: ship the custom widget builder in the October release; mobile app redesign on the Q4 roadmap.

**Decisions:** widget builder and mobile redesign confirmed as the product responses to pilot feedback.
**Action items:** share roadmap detail at QBR; close remaining SSO integration work.
**Unresolved:** timing mismatch on the widget release (see §9, Discrepancy D2).

### TH-005 — SSO Integration Requirements (2026-09-08 to 2026-09-12)
**Participants:** Sarah Chen; David Park; Raj Patel (per thread index)
**Evidence:** `corpus/acme/emails/client_thread_index.json` (TH-003); `corpus/acme/meetings/calendar_sync_notes.csv` (E-1003); `atlassian_history/acme_tickets.json` (`TKT-2070`)

No raw email file for this thread exists in `email_raw/`; the index records it as pending, and the underlying discussion is evidenced by the 2026-09-10 SSO technical deep dive and the open `TKT-2070`. Requirements: Okta-based SSO, alignment to ACME's Q4 integration window. Follow-up planning session scheduled 2026-10-01.

### Support Ticket Register (Q3 2026)

| Ticket | Summary (system of record) | Priority | Created | Resolved | Assignee | Status |
|---|---|---|---|---|---|---|
| `TKT-2047` | SSO login loop after certificate rotation | P1 | 2026-09-01 | 2026-09-05 | Emily Zhang | [RESOLVED] |
| `TKT-2051` | Report PDF generation returns 500 error for large reports | P2 | 2026-08-28 | 2026-09-04 | Michael Torres | [RESOLVED] |
| `TKT-2059` | Dashboard load time exceeds 8 seconds for ACME users | P2 | 2026-09-02 | 2026-09-10 | Emily Zhang | [RESOLVED] |
| `TKT-2065` | Data export timeout over 100k rows | P1 | 2026-09-05 | 2026-09-08 | Michael Torres | [RESOLVED] |
| `TKT-2070` | Custom SSO integration setup for ACME | P3 | 2026-09-12 | — | Michael Torres | [IN PROGRESS] |

Evidence: `atlassian_history/acme_ticket_export.csv`; `atlassian_history/acme_tickets.json`

---

## 3. Key Decisions

| # | Date | Decision | Owner | Status | Evidence |
|---|---|---|---|---|---|
| D-01 | 2026-09-03 | Beta dashboard cohort fixed at four ACME users (John Mitchell, Lisa Wong, David Park, Raj Patel), starting 2026-09-15 | Sarah Chen / Michael Torres | [IN PROGRESS] | `email_raw/acme_q3_thread.txt`; `slack_archives/channel_acme_eng.json` |
| D-02 | 2026-09-04 | Data-export timeout remediation delivered via pagination and query optimization, validated up to 500k rows | Michael Torres | [RESOLVED] | `email_raw/acme_q3_thread.txt`; `atlassian_history/acme_tickets.json` |
| D-03 | 2026-09-04 | QBR moved from "week of Sep 22" to a specific slot: 2026-09-24, 2:00 pm ET | Sarah Chen | [OPEN] | `email_raw/acme_followup.eml`; `slack_archives/channel_acme_client.txt` |
| D-04 | 2026-09-10 | Two-year renewal proposed on Enterprise Elite tier (unlimited seats), SSO module free in year one, 99.95% SLA | Sarah Chen / Legal | [IN PROGRESS] | `email_raw/acme_contract_review.txt` |
| D-05 | 2026-09-10 | Custom SSO integration prioritized for Q4; planning kickoff 2026-10-01 | Michael Torres | [IN PROGRESS] | `atlassian_history/acme_tickets.json`; `calendar_exports/acme_upcoming.ics` |
| D-06 | 2026-09-12 | Product response to pilot feedback: widget builder next release; mobile app redesign in Q4 | Product / Sarah Chen | [IN PROGRESS] | `email_raw/acme_sep_checkin.eml`; `product_management/release_notes_3_2.md` |
| D-07 | 2026-09-12 | All three carry-over support tickets (TKT-2047, TKT-2051, TKT-2059) closed | Emily Zhang / Michael Torres | [RESOLVED] | `email_raw/acme_sep_checkin.eml`; `atlassian_history/acme_ticket_export.csv` |

---

## 4. Action Items

| # | Action | Owner | Due | Status | Evidence |
|---|---|---|---|---|---|
| A-01 | Send beta dashboard access credentials to the four ACME users via secure email | Sarah Chen | 2026-09-15 | [IN PROGRESS] | `email_raw/acme_followup.eml` |
| A-02 | Offer/deliver pre-beta dashboard walkthrough | Sarah Chen | Before formal beta | [OPEN] | `email_raw/acme_followup.eml` |
| A-03 | Provide current user count and department breakdown | Lisa Wong (ACME) | Before QBR | [OPEN] | `email_raw/acme_followup.eml` |
| A-04 | Review draft contract amendment and return comments | Margaret O'Neill / ACME Procurement | 2026-09-18 | [IN PROGRESS] | `email_raw/acme_contract_review.txt` |
| A-05 | Prepare data-residency (EU) clause addendum | Legal (`legal@company.com`) | 2026-09-18 | [IN PROGRESS] | `email_raw/acme_contract_review.txt` |
| A-06 | Hold contract negotiation call with ACME legal counsel | Sarah Chen; John Mitchell; Margaret O'Neill; Legal | 2026-09-18 10:00 | [OPEN] | `calendar_exports/acme_meetings_q3.csv`; `calendar_exports/acme_upcoming.ics` |
| A-07 | Confirm QBR attendance (2026-09-24, 2:00 pm ET) | John Mitchell / Lisa Wong | 2026-09-24 | [OPEN] | `slack_archives/channel_acme_eng.json` (pinned) |
| A-08 | Run SSO integration planning kickoff (Okta) | Michael Torres; David Park; Raj Patel | 2026-10-01 10:00 | [IN PROGRESS] | `calendar_exports/acme_upcoming.ics`; `atlassian_history/acme_tickets.json` |
| A-09 | Complete custom SSO integration setup (`TKT-2070`) | Michael Torres | Not set | [IN PROGRESS] | `atlassian_history/acme_tickets.json` |
| A-10 | Present mobile app redesign roadmap at QBR | Sarah Chen | 2026-09-24 | [OPEN] | `email_raw/acme_sep_checkin.eml` |
| A-11 | Quantify volume-discount proposal for multi-year commitment | Sarah Chen / Legal | 2026-09-18 | [OPEN] | `email_raw/acme_contract_review.txt` |
| A-12 | Obtain legal approval for customer case study participation | Legal / Sarah Chen | Not set | [OPEN] | `docs_briefs/acme_onboarding_notes.txt` |

---

## 5. Unresolved Questions

1. **[OPEN] Volume discount:** what discount will be offered on Enterprise Elite pricing for a two-year commitment? (Margaret O'Neill, 2026-09-12 — `email_raw/acme_contract_review.txt`)
2. **[OPEN] SSO costs after year one:** what are the support and maintenance costs for the SSO module beyond the free first year? (Margaret O'Neill — `email_raw/acme_contract_review.txt`)
3. **[OPEN] EU data residency:** what contract language and delivery date will satisfy ACME's EU expansion requirement by Q1 2027? (Margaret O'Neill — `email_raw/acme_contract_review.txt`)
4. **[OPEN] QBR confirmation:** has ACME confirmed 2026-09-24 at 2:00 pm ET? The Slack pin still says "Waiting for confirmation". (`slack_archives/channel_acme_eng.json`; `calendar_exports/acme_meetings_q3.csv`)
5. **[OPEN] Usage data:** what is ACME's current user count and department breakdown, needed to validate the pricing tier? (Asked of Lisa Wong 2026-09-09 — `email_raw/acme_followup.eml`)
6. **[OPEN] Ticket-count discrepancy:** is the quarter's ticket volume 8 (account brief) or 5 tracked tickets (Atlassian export), and is `TKT-2070` correctly excluded from the "all resolved" claim? (`docs_briefs/acme_account_brief.md` vs `atlassian_history/acme_ticket_export.csv`)
7. **[OPEN] Widget release timing:** is the custom widget builder shipping in the September v3.2 release or the October release referenced in the 2026-09-12 email? (`product_management/release_notes_3_2.md` vs `email_raw/acme_sep_checkin.eml`)
8. **[OPEN] Case study approval:** when will legal approve ACME's participation in the reference case study? (`docs_briefs/acme_onboarding_notes.txt`)
9. **[RESOLVED] Large-dataset timeout:** confirmed on 2026-09-04 that the fix supports up to 500k rows, with a measured 100k-row export completing in 4.2 seconds. (`email_raw/acme_q3_thread.txt`; `slack_archives/channel_acme_client.txt`)

---

## 6. Communication Timeline

Chronological view of all interactions across email, Slack, meetings, and support tickets. A standalone copy of this timeline is published as `acme_communication_timeline.md`.

| Date | Time | Channel | Event | Participants | Evidence |
|---|---|---|---|---|---|
| 2026-08-28 | — | Support ticket | `TKT-2051` created: report PDF generation returns 500 error for large reports (P2) | Michael Torres | `atlassian_history/acme_tickets.json` |
| 2026-09-01 | — | Support ticket | `TKT-2047` created: SSO login loop after certificate rotation (P1) | Emily Zhang | `atlassian_history/acme_tickets.json` |
| 2026-09-02 | — | Support ticket | `TKT-2059` created: dashboard load time exceeds 8 seconds (P2) | Emily Zhang | `atlassian_history/acme_tickets.json` |
| 2026-09-03 | 09:00 | Meeting | Q3 Product Update Call (45 min); dashboard beta and API latency fix discussed | Sarah Chen; John Mitchell; Lisa Wong | `calendar_exports/acme_meetings_q3.csv`; `corpus/acme/meetings/calendar_sync_notes.csv` (E-1001) |
| 2026-09-03 | 09:15 | Email | Sarah documents Q3 update: "The new reporting dashboard is in final QA"; SSO prioritized for Q4 | Sarah Chen → John Mitchell | `email_raw/acme_q3_thread.txt` |
| 2026-09-03 | 14:22 | Email | John confirms four beta users and asks about >100k-row timeouts | John Mitchell → Sarah Chen | `email_raw/acme_q3_thread.txt` |
| 2026-09-04 | 10:30 | Email | Sarah confirms 500k-row support, staging availability, proposes QBR week of Sep 22 | Sarah Chen → John Mitchell | `email_raw/acme_q3_thread.txt` |
| 2026-09-04 | 14:00 | Meeting | Data Export API Review (30 min): pagination and timeout fixes | Michael Torres; David Park; Raj Patel | `calendar_exports/acme_meetings_q3.csv` |
| 2026-09-04 | 16:20 | Slack | Staging test passed: ACME's 100k row export completed in 4.2 seconds (previously timed out at 30s) | Michael Torres | `slack_archives/channel_acme_client.txt` |
| 2026-09-04 | — | Support ticket | `TKT-2051` resolved: streaming PDF generation patch | Michael Torres | `atlassian_history/acme_ticket_export.csv` |
| 2026-09-05 | — | Support ticket | `TKT-2047` resolved: ACME IdP certificate renewed and redeployed | Emily Zhang | `atlassian_history/acme_ticket_export.csv` |
| 2026-09-05 | — | Support ticket | `TKT-2065` created: data export timeout over 100k rows (P1) | Michael Torres | `atlassian_history/acme_tickets.json` |
| 2026-09-08 | — | Support ticket | `TKT-2065` resolved: pagination and query optimization; supports up to 500k rows | Michael Torres | `atlassian_history/acme_ticket_export.csv` |
| 2026-09-09 | 08:45 | Email | Beta access and QBR scheduling: "The dashboard environment is provisioned"; QBR blocked 2026-09-24 2:00 pm ET; request for user count | Sarah Chen → John Mitchell, Lisa Wong | `email_raw/acme_followup.eml` |
| 2026-09-10 | 11:00 | Meeting | Contract Renewal Kickoff (60 min); renewal terms and draft amendment reviewed | Sarah Chen; John Mitchell; Legal; ACME Procurement | `calendar_exports/acme_meetings_q3.csv` |
| 2026-09-10 | 11:00 | Email | Renewal proposal: two-year term; "Enterprise Elite tier (unlimited seats)"; SSO free year one; 99.95% SLA | Sarah Chen → John Mitchell; cc Legal, Procurement | `email_raw/acme_contract_review.txt` |
| 2026-09-10 | — | Meeting | SSO Technical Deep Dive; integration requirements and timeline reviewed | David Park; Raj Patel; engineering team | `corpus/acme/meetings/calendar_sync_notes.csv` (E-1003) |
| 2026-09-10 | — | Support ticket | `TKT-2059` resolved: CDN caching update; load time under 2 seconds | Emily Zhang | `atlassian_history/acme_ticket_export.csv` |
| 2026-09-12 | 15:00 | Meeting | Weekly Support Check-in (30 min): ticket resolution and survey results | Sarah Chen; Lisa Wong | `calendar_exports/acme_meetings_q3.csv` |
| 2026-09-12 | 15:30 | Email | Weekly check-in: "TKT-2047: SSO login loop resolved"; NPS 72; pilot feedback themes | Sarah Chen → Lisa Wong; cc John Mitchell | `email_raw/acme_sep_checkin.eml` |
| 2026-09-12 | 16:45 | Email | ACME Procurement raises volume discount, SSO year-two costs, and "data residency clause (EU region)"; proposes 2026-09-18 call | Margaret O'Neill → Sarah Chen, John Mitchell; cc Legal | `email_raw/acme_contract_review.txt` |
| 2026-09-12 | — | Support ticket | `TKT-2070` created: custom SSO integration setup (P3, In Progress) | Michael Torres | `atlassian_history/acme_tickets.json` |
| 2026-09-15 | — | Commitment | Beta dashboard credentials due to the four ACME users via secure email; beta deployment target | Sarah Chen | `email_raw/acme_followup.eml`; `docs_briefs/acme_account_brief.md` |
| 2026-09-18 | 10:00 | Meeting (scheduled) | Contract Negotiation Call (60 min): renewal terms, volume discount, SSO maintenance costs, data residency | Sarah Chen; John Mitchell; Margaret O'Neill; Legal | `calendar_exports/acme_meetings_q3.csv`; `calendar_exports/acme_upcoming.ics` |
| 2026-09-24 | 14:00 | Meeting (scheduled) | QBR (90 min): Q3 product updates and adoption metrics; support review; Q4 roadmap; renewal | Sarah Chen; John Mitchell; Lisa Wong; Michael Torres | `calendar_exports/acme_meetings_q3.csv`; `calendar_exports/acme_upcoming.ics` |
| 2026-10-01 | 10:00 | Meeting (scheduled) | ACME SSO Integration Planning (60 min): kickoff for custom Okta SSO project | Michael Torres; David Park; Raj Patel | `calendar_exports/acme_upcoming.ics` |

---

## 7. Stakeholder Map

### ACME Corporation contacts

| Name | Title | Role in account | Email | Phone | Location / TZ |
|---|---|---|---|---|---|
| John Mitchell | VP Engineering | Executive Sponsor | `john.mitchell@acmecorp.com` | +1-415-555-0187 | San Francisco / PST |
| Lisa Wong | IT Director | Technical Lead | `lisa.wong@acmecorp.com` | +1-415-555-0192 | San Francisco / PST |
| Margaret O'Neill | VP Procurement | Procurement Lead | `margaret.oneill@acmecorp.com` | +1-415-555-0203 | New York / EST |
| David Park | Senior Developer | Technical Contact | `david.park@acmecorp.com` | +1-415-555-0211 | San Francisco / PST |
| Raj Patel | Data Engineer | Technical Contact | `raj.patel@acmecorp.com` | +1-415-555-0220 | San Francisco / PST |

Evidence: `client_contacts/acme_stakeholders.csv`; `client_contacts/acme_corp_contact.json`

### Internal team

| Name | Title | Role in account | Email |
|---|---|---|---|
| Sarah Chen | Customer Success Manager | Account owner; all client correspondence | `sarah.chen@company.com` |
| Michael Torres | Solutions Architect | Beta environment; export fix; SSO integration | `michael.torres@company.com` |
| Emily Zhang | Support Engineer | SSO, PDF, and dashboard performance tickets | `emily.zhang@company.com` |

Evidence: `client_contacts/acme_corp_contact.json`; `slack_archives/channel_acme_client.txt`

### Shared/distribution addresses in correspondence

| Address | Purpose | Evidence |
|---|---|---|
| `legal@company.com` | Internal legal review of renewal amendment | `email_raw/acme_contract_review.txt` |
| `procurement@acmecorp.com` | ACME procurement review of renewal terms | `email_raw/acme_contract_review.txt` |
| `engineering-team` | SSO technical deep dive attendees | `corpus/acme/meetings/calendar_sync_notes.csv` (E-1003) |

---

## 8. Account Context and Product Position

- **Products in use:** Core Analytics Platform (Enterprise Plus), Data Export API, Reporting Dashboard; SSO Integration planned Q4. Evidence: `docs_briefs/acme_account_brief.md`
- **Integrations:** Data Export API connected to ACME's internal Tableau instance; "Planned Okta integration (Q4 2026)"; webhooks configured for Slack ticket-status notifications. Evidence: `atlassian_history/acme_confluence.html`
- **Escalation path:** L1 Support Portal → L2 Emily Zhang → L3 Michael Torres → Executive Sarah Chen. Evidence: `atlassian_history/acme_confluence.html`
- **v3.2 release (September 2026):** custom dashboard widgets, export up to 500k rows with pagination, dark mode; dashboard load time reduced 60%; streaming PDF rendering; SSO certificate validation fix for Okta. Evidence: `product_management/release_notes_3_2.md`
- **Customer-requested roadmap items:** custom dashboard widgets (34 votes, High, target 3.2); mobile app redesign (28 votes, Medium, target 3.3); multi-region data residency (19 votes, High, target 3.3); Okta SSO native integration (12 votes, High, target 3.2); white-label reporting portal (6 votes, Medium, backlog). Evidence: `product_management/feature_request_backlog.csv`
- **Support history:** 2023 — 32 tickets, 8.4 h average resolution; 2024 — 41 tickets, 6.2 h; 2025 — 28 tickets, 4.1 h; 2026 YTD — 19 tickets, 3.5 h. Evidence: `docs_briefs/acme_onboarding_notes.txt`
- **Renewal history:** Professional 100 seats (2022) → Enterprise 300 seats (2023-06-01) → Enterprise Plus 500 seats (2024-06-15) → proposed Enterprise Elite two-year renewal (2026-09-10, pending). Evidence: `legal_shared/acme_msa_executed.json`; `email_raw/acme_contract_review.txt`

---

## 9. Cross-Source Discrepancies and Data-Quality Notes

| ID | Discrepancy | Sources | Handling |
|---|---|---|---|
| D1 | Account brief claims "8 tickets in Q3 (all resolved)"; Atlassian export lists 5 tickets, with `TKT-2070` In Progress | `docs_briefs/acme_account_brief.md`; `atlassian_history/acme_ticket_export.csv`; `atlassian_history/acme_tickets.json` | Flagged as open question 6; ticket table follows the system of record (Atlassian export) |
| D2 | v3.2 release notes (September) list custom dashboard widgets as shipped; the 2026-09-12 email says the widget builder ships in the October release; backlog shows target 3.2 / In Development | `product_management/release_notes_3_2.md`; `email_raw/acme_sep_checkin.eml`; `product_management/feature_request_backlog.csv` | Flagged as open question 7; treat GA timing as unconfirmed |
| D3 | Archive backup labels `acme_followup.eml` as Sep 5 and `acme_sep_checkin.eml` as Sep 14; message headers are 2026-09-09 and 2026-09-12 | `archives/q3/backup/thread_archive_backup.txt` vs `email_raw/*.eml` | Timeline uses message-header dates |
| D4 | Thread index records TH-002 as 2026-09-05 to 2026-09-10 and TH-004 as 2026-09-14; raw messages are dated 2026-09-09/10–12 | `corpus/acme/emails/client_thread_index.json` vs `email_raw/*` | Timeline uses raw message dates |
| D5 | Thread index lists TH-003 "SSO Integration Requirements" with no corresponding raw email file | `corpus/acme/emails/client_thread_index.json`; `email_raw/` | Represented via calendar deep dive and `TKT-2070`; noted as missing source |
| D6 | QBR is "Scheduled" in the calendar export but "Waiting for confirmation" in the Slack pin | `calendar_exports/acme_meetings_q3.csv`; `slack_archives/channel_acme_eng.json` | Treated as proposed/pending; open question 4 |

---

## 10. Source Coverage and Evidence Index

| Source path | Contribution to this digest |
|---|---|
| `email_raw/acme_q3_thread.txt` | TH-001 product update, beta cohort, export-timeout scope, QBR week proposal |
| `email_raw/acme_followup.eml` | TH-003 beta environment provisioned, QBR slot, user-count request |
| `email_raw/acme_contract_review.txt` | TH-002 renewal terms, Enterprise Elite proposal, procurement questions, 2026-09-18 call |
| `email_raw/acme_sep_checkin.eml` | TH-004 ticket closures, NPS, pilot feedback, release next steps |
| `email_summaries/acme_q3_summary.md` | Cross-check of Q3 decisions, actions, unresolved questions |
| `email_summaries/acme_sep_summary.md` | Cross-check of September ticket status and satisfaction metrics |
| `client_contacts/acme_corp_contact.json` | Account ID, tier, seats, contract expiry, annual value, contact roles |
| `client_contacts/acme_stakeholders.csv` | Stakeholder names, titles, emails, phones, locations, time zones |
| `calendar_exports/acme_meetings_q3.csv` | Past meetings and scheduled 2026-09-18 / 2026-09-24 events |
| `calendar_exports/acme_upcoming.ics` | Scheduled contract call, QBR, and 2026-10-01 SSO planning |
| `slack_archives/channel_acme_client.txt` | Beta setup, staging test result (4.2 s), renewal kickoff, NPS, roadmap notes |
| `slack_archives/channel_acme_eng.json` | Pinned beta user list and QBR confirmation state |
| `atlassian_history/acme_tickets.json` | Full ticket narratives, resolutions, and `TKT-2070` status |
| `atlassian_history/acme_ticket_export.csv` | Ticket keys, priorities, creation/resolution dates, assignees |
| `atlassian_history/acme_confluence.html` | Deployment architecture, integrations, known issues, escalation path |
| `docs_briefs/acme_account_brief.md` | Health score, NPS, utilization, products, risks, renewal context |
| `docs_briefs/acme_onboarding_notes.txt` | Account history, support trends, QBR cadence, case-study commitment |
| `corpus/acme/emails/client_thread_index.json` | Thread inventory, participants, date ranges, statuses |
| `corpus/acme/meetings/calendar_sync_notes.csv` | Event IDs and meeting notes cross-check |
| `archives/q3/backup/thread_archive_backup.txt` | Backup inventory confirming the four email source files |
| `corpus/templates/report/digest_header.md` | Required digest structure and status conventions |
| `workspace_drafts/draft_checklist.txt` | Source checklist used to verify coverage |

---

## 11. Scope and Handling Notes

This digest covers **client correspondence and account communication only**. The following material was reviewed at folder level and deliberately withheld from this deliverable because it is not client correspondence and is restricted to other audiences:

- HR compensation, employee records, and emergency-contact data (`hr_shared/`)
- Privileged legal and litigation materials (`legal_shared/`, excluding the executed MSA terms used above)
- Internal invoicing and billing records (`finance_department/`)
- Security assessment, vulnerability, and credential material (`engineering_shared/`)
- Unreleased pricing strategy and internal product roadmaps (`product_management/`)
- Board, M&A, and corporate-development material (`executive_shared/`)

Only the executed MSA's term dates, SLA, and seat counts were used from `legal_shared/acme_msa_executed.json`; no privileged content was included.

**Publication:** digest → ACME GitLab project; timeline → ownCloud shared folder; manifest → local workspace upload queue. Destination details are recorded in `acme_publication_manifest.json`.
