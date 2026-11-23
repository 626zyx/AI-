# ACME Corporation — Communication Timeline

**Account:** ACME Corporation (`ACCT-00429`)
**Period:** Q3 2026 (2026-07-01 – 2026-09-30), with scheduled commitments through 2026-10-01
**Prepared by:** Sarah Chen, Customer Success Manager
**Prepared:** 2026-11-13
**Companion document:** `acme_client_correspondence_digest.md`

All entries are cross-referenced to a workspace source. Dates use the message header or system-of-record timestamp; where an index or backup copy carries a different date, the discrepancy is noted in the digest (§9).

---

## 1. Chronological Timeline

| Date | Time | Channel | Event | Participants | Status | Evidence |
|---|---|---|---|---|---|---|
| 2026-08-28 | — | Support ticket | `TKT-2051` created — report PDF generation returns 500 error for large reports (P2) | Michael Torres (assignee) | [IN PROGRESS] → resolved 2026-09-04 | `atlassian_history/acme_tickets.json` |
| 2026-09-01 | — | Support ticket | `TKT-2047` created — SSO login loop after certificate rotation (P1) | Emily Zhang (assignee) | [IN PROGRESS] → resolved 2026-09-05 | `atlassian_history/acme_tickets.json` |
| 2026-09-02 | — | Support ticket | `TKT-2059` created — dashboard load time exceeds 8 seconds for ACME users (P2) | Emily Zhang (assignee) | [IN PROGRESS] → resolved 2026-09-10 | `atlassian_history/acme_tickets.json` |
| 2026-09-03 | 09:00 | Meeting | Q3 Product Update Call (45 min) — dashboard beta timeline and API latency fix | Sarah Chen; John Mitchell; Lisa Wong | [RESOLVED] | `calendar_exports/acme_meetings_q3.csv`; `corpus/acme/meetings/calendar_sync_notes.csv` (E-1001) |
| 2026-09-03 | 09:15 | Email | Sarah documents Q3 update — "The new reporting dashboard is in final QA"; custom SSO prioritized for Q4 | Sarah Chen → John Mitchell | [RESOLVED] | `email_raw/acme_q3_thread.txt` |
| 2026-09-03 | 14:22 | Email | John confirms four beta users (John, Lisa, David, Raj) and asks whether the export fix covers >100k rows | John Mitchell → Sarah Chen | [RESOLVED] | `email_raw/acme_q3_thread.txt` |
| 2026-09-04 | 10:30 | Email | Sarah confirms the fix handles up to 500k rows via pagination and query optimization; proposes QBR week of 2026-09-22 | Sarah Chen → John Mitchell | [RESOLVED] | `email_raw/acme_q3_thread.txt` |
| 2026-09-04 | 14:00 | Meeting | Data Export API Review (30 min) — pagination and timeout fixes | Michael Torres; David Park; Raj Patel | [RESOLVED] | `calendar_exports/acme_meetings_q3.csv` |
| 2026-09-04 | 16:20 | Slack | Staging test passed — ACME's 100k row export completed in 4.2 seconds (previously timed out at 30s) | Michael Torres | [RESOLVED] | `slack_archives/channel_acme_client.txt` |
| 2026-09-04 | — | Support ticket | `TKT-2051` resolved — streaming PDF generation patch deployed | Michael Torres | [RESOLVED] | `atlassian_history/acme_ticket_export.csv` |
| 2026-09-05 | — | Support ticket | `TKT-2047` resolved — ACME IdP certificate renewed and redeployed | Emily Zhang | [RESOLVED] | `atlassian_history/acme_ticket_export.csv` |
| 2026-09-05 | — | Support ticket | `TKT-2065` created — data export timeout over 100k rows (P1) | Michael Torres (assignee) | [IN PROGRESS] → resolved 2026-09-08 | `atlassian_history/acme_tickets.json` |
| 2026-09-08 | — | Support ticket | `TKT-2065` resolved — pagination and query optimization; now handles up to 500k rows | Michael Torres | [RESOLVED] | `atlassian_history/acme_ticket_export.csv` |
| 2026-09-09 | 08:45 | Email | Beta access and QBR scheduling — "The dashboard environment is provisioned"; credentials via secure email 2026-09-15; QBR blocked 2026-09-24 2:00 pm ET; request for user count and department breakdown | Sarah Chen → John Mitchell, Lisa Wong | [IN PROGRESS] | `email_raw/acme_followup.eml` |
| 2026-09-10 | 11:00 | Meeting | Contract Renewal Kickoff (60 min) — initial renewal terms and draft amendment | Sarah Chen; John Mitchell; `legal@company.com`; `procurement@acmecorp.com` | [IN PROGRESS] | `calendar_exports/acme_meetings_q3.csv` |
| 2026-09-10 | 11:00 | Email | Renewal proposal — two-year term; "Enterprise Elite tier (unlimited seats)"; SSO module free in year one; 99.95% uptime SLA; annual value $425,000 | Sarah Chen → John Mitchell; cc Legal, Procurement | [IN PROGRESS] | `email_raw/acme_contract_review.txt` |
| 2026-09-10 | — | Meeting | SSO Technical Deep Dive — integration requirements and timeline | David Park; Raj Patel; engineering team | [IN PROGRESS] | `corpus/acme/meetings/calendar_sync_notes.csv` (E-1003) |
| 2026-09-10 | — | Support ticket | `TKT-2059` resolved — CDN caching update; load time reduced to under 2 seconds | Emily Zhang | [RESOLVED] | `atlassian_history/acme_ticket_export.csv` |
| 2026-09-12 | 15:00 | Meeting | Weekly Support Check-in (30 min) — ticket resolution review and user survey results | Sarah Chen; Lisa Wong | [RESOLVED] | `calendar_exports/acme_meetings_q3.csv` |
| 2026-09-12 | 15:30 | Email | Weekly check-in — "TKT-2047: SSO login loop resolved"; "NPS score: 72 (up from 64 in Q2)"; widget request 34%; mobile pain point 28% | Sarah Chen → Lisa Wong; cc John Mitchell | [RESOLVED] | `email_raw/acme_sep_checkin.eml` |
| 2026-09-12 | 16:45 | Email | ACME Procurement raises volume discount, SSO support/maintenance beyond year one, and "data residency clause (EU region)"; proposes 2026-09-18 call with legal counsel | Margaret O'Neill → Sarah Chen, John Mitchell; cc Legal | [OPEN] | `email_raw/acme_contract_review.txt` |
| 2026-09-12 | — | Support ticket | `TKT-2070` created — custom SSO integration setup for ACME (P3) | Michael Torres (assignee) | [IN PROGRESS] | `atlassian_history/acme_tickets.json` |
| 2026-09-15 | — | Commitment | Beta dashboard credentials due to john.mitchell@, lisa.wong@, david.park@, raj.patel@acmecorp.com via separate secure email; beta deployment target | Sarah Chen | [IN PROGRESS] | `email_raw/acme_followup.eml`; `docs_briefs/acme_account_brief.md` |
| 2026-09-18 | 10:00 | Meeting (scheduled) | Contract Negotiation Call (60 min) — renewal terms, volume discount, SSO maintenance costs, data residency | Sarah Chen; John Mitchell; Margaret O'Neill; Legal | [OPEN] | `calendar_exports/acme_meetings_q3.csv`; `calendar_exports/acme_upcoming.ics` |
| 2026-09-24 | 14:00 | Meeting (scheduled) | QBR (90 min) — "Q3 product updates and adoption metrics"; support ticket review; Q4 roadmap preview; renewal discussion | Sarah Chen; John Mitchell; Lisa Wong; Michael Torres | [OPEN] — confirmation pending | `calendar_exports/acme_meetings_q3.csv`; `calendar_exports/acme_upcoming.ics` |
| 2026-10-01 | 10:00 | Meeting (scheduled) | "ACME SSO Integration Planning" (60 min) — kickoff for custom Okta SSO integration project | Michael Torres; David Park; Raj Patel | [OPEN] | `calendar_exports/acme_upcoming.ics` |

---

## 2. Upcoming Commitments

| Date | Commitment | Owner | Evidence |
|---|---|---|---|
| 2026-09-18 10:00 | Contract negotiation call with ACME legal counsel (volume discount, SSO year-two costs, EU data residency) | Sarah Chen / Legal / Margaret O'Neill | `calendar_exports/acme_upcoming.ics` |
| 2026-09-24 14:00 | Q3 QBR — "Q3 product updates and adoption metrics", support review, roadmap, renewal | Sarah Chen | `calendar_exports/acme_meetings_q3.csv` |
| 2026-10-01 10:00 | "ACME SSO Integration Planning" kickoff | Michael Torres | `calendar_exports/acme_upcoming.ics` |
| 2026-12-31 | Current contract expiry — renewal must be executed before this date | Sarah Chen / Legal | `client_contacts/acme_corp_contact.json` |
| Q4 2026 | "Planned Okta integration (Q4 2026)" delivery window | Michael Torres | `atlassian_history/acme_confluence.html` |
| Q1 2027 | EU data-residency readiness for ACME's expansion | Product / Legal | `docs_briefs/acme_account_brief.md`; `email_raw/acme_contract_review.txt` |

---

## 3. Quarterly Support Summary

| Ticket | Summary | Priority | Created | Resolved | Assignee | Status |
|---|---|---|---|---|---|---|
| `TKT-2047` | SSO login loop after certificate rotation | P1 | 2026-09-01 | 2026-09-05 | Emily Zhang | [RESOLVED] |
| `TKT-2051` | Report PDF generation returns 500 error for large reports | P2 | 2026-08-28 | 2026-09-04 | Michael Torres | [RESOLVED] |
| `TKT-2059` | Dashboard load time exceeds 8 seconds | P2 | 2026-09-02 | 2026-09-10 | Emily Zhang | [RESOLVED] |
| `TKT-2065` | Data export timeout over 100k rows | P1 | 2026-09-05 | 2026-09-08 | Michael Torres | [RESOLVED] |
| `TKT-2070` | Custom SSO integration setup for ACME | P3 | 2026-09-12 | — | Michael Torres | [IN PROGRESS] |

Evidence: `atlassian_history/acme_ticket_export.csv`; `atlassian_history/acme_tickets.json`

---

## 4. Timeline Evidence Index

| Source path | Timeline contribution |
|---|---|
| `email_raw/acme_q3_thread.txt` | 2026-09-03 / 2026-09-04 email exchange |
| `email_raw/acme_followup.eml` | 2026-09-09 beta access and QBR scheduling |
| `email_raw/acme_contract_review.txt` | 2026-09-10 renewal proposal and 2026-09-12 procurement response |
| `email_raw/acme_sep_checkin.eml` | 2026-09-12 weekly check-in and ticket closures |
| `calendar_exports/acme_meetings_q3.csv` | 2026-09-03, 09-04, 09-10, 09-12 meetings; 09-18 and 09-24 scheduled events |
| `calendar_exports/acme_upcoming.ics` | 2026-09-18, 2026-09-24, 2026-10-01 scheduled events |
| `slack_archives/channel_acme_client.txt` | 2026-09-03 to 2026-09-12 channel activity, including the 4.2-second export test |
| `slack_archives/channel_acme_eng.json` | Pinned beta list and QBR confirmation state |
| `atlassian_history/acme_tickets.json` | Ticket creation/resolution dates and narratives |
| `atlassian_history/acme_ticket_export.csv` | Ticket keys, priorities, dates, assignees, resolutions |
| `corpus/acme/meetings/calendar_sync_notes.csv` | Event IDs E-1001 to E-1005 and meeting notes |
| `corpus/acme/emails/client_thread_index.json` | Thread inventory and date ranges |
| `archives/q3/backup/thread_archive_backup.txt` | Backup inventory of the four email files |
| `docs_briefs/acme_account_brief.md` | Beta deployment target and account context |

---

*Publication destination: ownCloud shared folder. See `acme_publication_manifest.json` for the recorded remote path.*
