# ACME Corporation — Client Correspondence Digest

**Account:** ACME Corporation (ACCT-00429) · Enterprise Plus · 500 seats
**Reporting period:** Q3 2026 (Jul 1 – Sep 30, 2026); detailed coverage Sep 1–16, 2026
**Prepared by:** Customer Success — Sarah Chen
**Prepared for:** Q3 Quarterly Business Review (scheduled Sep 24, 2026)
**Data cut-off:** 2026-09-16 (latest correspondence present in the available exports)
**Compiled:** 2026-11-12
**Classification:** Internal — account team. Contains no privileged legal, HR, or vendor-finance material.

---

## 1. Overview

> **Coverage caveat.** The newest ACME correspondence in the workspace or connected exports is dated 2026-09-16. No October or November 2026 messages, meeting notes, or ticket updates were available at compilation (2026-11-12). This digest therefore describes the account as of mid-September and should be refreshed before it is used as a current-state view; the Sep 18, Sep 24, and Oct 1 events below are recorded as scheduled/upcoming, not as outcomes.

ACME remains a green-health strategic account (health score 92/100, NPS 72, up 8 points from Q2). Q3 activity centred on four workstreams: the reporting-dashboard beta, resolution of data-export and dashboard performance defects, preparation of the Q3 business review, and a two-year Enterprise Elite renewal proposal.

Four of the five support tickets in the September export are resolved, including the P1 data-export timeout that had blocked exports above 100k rows. The remaining open ticket, TKT-2070 (custom SSO integration setup), is in progress and is tied to the Q4 SSO project.

The renewal is the principal commercial risk. The current agreement expires **2026-12-31**. ACME procurement has responded to the draft amendment with three substantive asks — multi-year volume discount, clarity on SSO support/maintenance costs after year one, and an EU data-residency clause — and a negotiation call is scheduled for **Sep 18**. No renewal terms have been agreed.

Four email threads were reviewed. All four contain recorded decisions or commitments: two carry the substantive product and commercial decisions, one is informational, and one remains open pending confirmation. A full cross-channel timeline is published separately as `acme_communication_timeline.md`.

---

## 2. Email Thread Summary

### TH-001 — Q3 Product Update and Feedback
- **Period:** 2026-09-03 to 2026-09-04 · **Messages:** 3
- **Participants:** Sarah Chen (CS), John Mitchell (ACME)
- **Status:** [RESOLVED]

**Summary.** Sarah documented the Q3 product update call: the reporting dashboard was in final QA with beta access targeted for Sep 15; the data-export latency issue reported by ACME engineering had been addressed; and custom SSO integration had been prioritised for Q4. John supplied the four-user beta list (john.mitchell, lisa.wong, david.park, raj.patel) and asked whether the export fix also covered timeouts on datasets above 100k rows. Sarah confirmed the fix supports up to 500k rows through added pagination and an optimised query layer, and that it was already testable in staging. She also proposed holding the QBR in the week of Sep 22.

**Decisions**
- Beta dashboard access granted to four named ACME users, target date Sep 15.
- Data-export fix scoped and validated to 500k rows (pagination + query optimisation).
- Custom SSO integration prioritised for Q4 delivery.

**Action items**
- Sarah: issue beta credentials (target Sep 15) — [RESOLVED] sent/queued per Sep 9 follow-up; receipt not confirmed.
- Michael Torres: prepare beta environment and run ACME large-dataset test suite — [RESOLVED] staging test passed Sep 4 (100k rows in 4.2s, previously timed out at 30s).

**Unresolved questions**
- Will the export fix cover the >100k-row timeouts? — **Answered:** yes, up to 500k rows.

---

### TH-002 — Contract Review and Renewal Terms
- **Period:** 2026-09-10 to 2026-09-12 · **Messages:** 2
- **Participants:** Sarah Chen (CS); John Mitchell (ACME); Margaret O'Neill, VP Procurement (ACME); legal@company.com; procurement@acmecorp.com
- **Status:** [IN PROGRESS]

**Summary.** Sarah opened the renewal by restating the current position — expiry Dec 31, 2026; Enterprise Plus, 500 seats; annual value $425,000 — and proposed a two-year renewal with an upgrade to Enterprise Elite (unlimited seats), the new SSO module included at no additional cost for year one, and an extended SLA of 99.95% uptime. A draft amendment was prepared by our legal team for ACME procurement.

Margaret O'Neill replied on Sep 12 with three items for discussion: (1) a volume discount reflecting ACME's multi-year commitment; (2) clarity on SSO support and maintenance costs beyond year one; and (3) an EU data-residency clause ahead of ACME's 2027 European expansion. She proposed a call on Sep 18 with ACME legal counsel present.

**Decisions**
- Renewal shaped as a two-year Enterprise Elite proposal (proposed, not agreed).
- SSO module offered free in year one (proposed, not agreed).
- SLA uplift to 99.95% included in the proposal (proposed, not agreed).

**Action items**
- Our legal: prepare data-residency clause addendum — [OPEN]
- ACME procurement: complete review of the draft amendment — [IN PROGRESS]
- Sarah: hold negotiation call Sep 18 with both legal teams — [SCHEDULED]

**Unresolved questions**
- What volume discount applies to a two-year commitment?
- What are the SSO support and maintenance costs from year two onward?
- Will an EU data-residency clause be accepted, and in what form?

---

### TH-003 — Weekly Check-in: Support Tickets and User Feedback
- **Period:** 2026-09-12 · **Messages:** 1
- **Participants:** Sarah Chen (CS); Lisa Wong (ACME); John Mitchell (ACME, cc)
- **Status:** [RESOLVED — informational]

**Summary.** Sarah reported that all three carry-over tickets were closed: TKT-2047 (SSO login loop, caused by an expired certificate on ACME's IdP), TKT-2051 (PDF generation error, patched with streaming generation), and TKT-2059 (slow dashboard loads, addressed by CDN caching). She shared results from the 50-user pilot survey: NPS 72 (from 64 in Q2), custom dashboard widgets as the top request (34% of respondents), and mobile app experience as the main pain point (28%). The custom widget builder is scheduled for the October release; the mobile app redesign is on the Q4 roadmap. Sarah asked whether ACME needed anything else before the QBR.

**Decisions**
- Custom widget builder committed to the October release.
- Mobile app redesign placed on the Q4 roadmap.

**Action items**
- Product: ship custom widget builder in October — [PLANNED]
- Product: schedule mobile app redesign in Q4 — [PLANNED]

**Unresolved questions**
- None raised in this thread; the "anything else before the QBR" request received no written reply in the export.

---

### TH-004 — Beta Dashboard Access and QBR Scheduling
- **Period:** 2026-09-09 · **Messages:** 1
- **Participants:** Sarah Chen (CS); John Mitchell and Lisa Wong (ACME)
- **Status:** [OPEN]

**Summary.** Sarah confirmed the dashboard environment was provisioned, that credentials would arrive by separate secure email on Sep 15, and offered a walkthrough before the formal beta start. She blocked **Sep 24, 2pm ET** for the QBR with an agenda covering Q3 product updates and adoption metrics, support-ticket resolution rates, the Q4 roadmap preview, and the renewal discussion. She asked Lisa for the current user count and department breakdown so the pricing tier could be validated against actual usage.

**Decisions**
- QBR proposed for Sep 24, 2pm ET (calendar holds the slot; written acceptance not present in the export).

**Action items**
- Sarah: send secure beta credentials on Sep 15 — [IN PROGRESS] due date reached; delivery receipt not evidenced in the export.
- Lisa Wong: share user count and department breakdown — [OPEN]

**Unresolved questions**
- Has ACME confirmed Sep 24, 2pm ET for the QBR?
- Has the beta credential email been received and distributed to the four users?
- What is ACME's current user count and department split?

---

## 3. Key Decisions (Consolidated)

| # | Decision | Owner | Date | Status |
|---|----------|-------|------|--------|
| D1 | Beta dashboard access for four named ACME users, target Sep 15 | Sarah Chen / Michael Torres | 2026-09-03 | [RESOLVED] environment ready; receipt unconfirmed |
| D2 | Data-export fix covers up to 500k rows via pagination and query optimisation | Engineering (Michael Torres) | 2026-09-04 | [RESOLVED] verified in staging |
| D3 | Custom SSO integration prioritised for Q4; kickoff Oct 1 | Product / Michael Torres | 2026-09-03 | [IN PROGRESS] TKT-2070 open |
| D4 | Custom dashboard widget builder ships in the October release | Product | 2026-09-12 | [PLANNED] |
| D5 | Mobile app redesign placed on the Q4 roadmap | Product | 2026-09-12 | [PLANNED] |
| D6 | Renewal proposed as two-year Enterprise Elite, SSO free year one, 99.95% SLA | Sarah Chen | 2026-09-10 | [IN PROGRESS] counter-asks received |
| D7 | Contract negotiation call set for Sep 18 with both legal teams | Sarah Chen / Margaret O'Neill | 2026-09-12 | [SCHEDULED] |

> D6 is a **proposal only**. ACME has not accepted any renewal term.

---

## 4. Action Items

| # | Action | Owner | Due / Target | Status | Source |
|---|--------|-------|--------------|--------|--------|
| A1 | Deliver beta dashboard credentials to the four users via secure email | Sarah Chen | 2026-09-15 | [IN PROGRESS] no receipt evidenced | acme_followup.eml |
| A2 | Share ACME user count and department breakdown | Lisa Wong (ACME) | Before QBR | [OPEN] | acme_followup.eml |
| A3 | Confirm QBR attendance for Sep 24, 2pm ET | John Mitchell / Lisa Wong | ASAP | [OPEN] calendar slot held only | acme_followup.eml |
| A4 | Prepare data-residency (EU) clause addendum | Our legal | Before Sep 18 call | [OPEN] | acme_contract_review.txt |
| A5 | Complete review of the draft amendment | ACME procurement (Margaret O'Neill) | Before Sep 18 call | [IN PROGRESS] | acme_contract_review.txt |
| A6 | Quantify volume discount for a two-year commitment | Sarah Chen / Deal desk | 2026-09-18 | [OPEN] | acme_contract_review.txt |
| A7 | Clarify SSO support and maintenance pricing from year two | Sarah Chen / Product | 2026-09-18 | [OPEN] | acme_contract_review.txt |
| A8 | Complete custom SSO integration setup (TKT-2070) | Michael Torres | Q4 2026; kickoff Oct 1 | [IN PROGRESS] | acme_tickets.json |
| A9 | Ship custom widget builder | Product | October 2026 release | [PLANNED] | acme_sep_checkin.eml |
| A10 | Deliver mobile app redesign | Product | Q4 2026 | [PLANNED] | acme_sep_checkin.eml |
| A11 | Confirm beta walkthrough offer with ACME | Sarah Chen | Before formal beta start | [OPEN] no reply in export | acme_followup.eml |

---

## 5. Unresolved Questions

| # | Question | Owner of answer | Impact | Status |
|---|----------|-----------------|--------|--------|
| Q1 | What volume discount applies to a multi-year commitment? | Internal deal desk → Sarah | Renewal value and approval path | [OPEN] |
| Q2 | What are SSO support/maintenance costs beyond year one? | Product / Finance → Sarah | ACME has flagged this explicitly; unresolved pricing term | [OPEN] |
| Q3 | Will an EU data-residency clause be accepted, and in what form? | Legal | Required for ACME's 2027 EU expansion; potential deal blocker | [OPEN] |
| Q4 | Has ACME confirmed Sep 24, 2pm ET for the QBR? | John Mitchell / Lisa Wong | QBR attendance and renewal momentum | [OPEN] |
| Q5 | Has the Sep 15 beta credential email been received? | ACME users / Sarah | Beta adoption and QBR demo readiness | [OPEN] |
| Q6 | What are ACME's current user count and department split? | Lisa Wong | Seat-tier and pricing validation (487/500 seats per account brief) | [OPEN] |
| Q7 | Does ACME require anything further before the QBR? | ACME | Agenda completeness | [OPEN] no written reply |

---

## 6. Stakeholder Map

### ACME Corporation

| Name | Title | Role in account | Email | Phone | Time zone | Involvement |
|------|-------|-----------------|-------|-------|-----------|-------------|
| John Mitchell | VP Engineering | Executive sponsor; renewal decision-maker | john.mitchell@acmecorp.com | +1-415-555-0187 | PST | Q3 update thread, beta list, renewal thread, QBR |
| Lisa Wong | IT Director | Technical lead; operational point of contact | lisa.wong@acmecorp.com | +1-415-555-0192 | PST | Beta user, weekly check-in, QBR |
| Margaret O'Neill | VP Procurement | Procurement lead; negotiation counterpart | margaret.oneill@acmecorp.com | +1-415-555-0203 | EST | Renewal counter-asks, Sep 18 negotiation |
| David Park | Senior Developer | Technical contact; SSO implementation | david.park@acmecorp.com | +1-415-555-0211 | PST | Beta user, API review, SSO planning |
| Raj Patel | Data Engineer | Technical contact; data export/SSO | raj.patel@acmecorp.com | +1-415-555-0220 | PST | Beta user, API review, SSO planning |

Shared mailboxes: `procurement@acmecorp.com` (renewal), `legal@acmecorp.com` counterpart on the amendment.

### Internal (Company Inc.)

| Name | Title | Role in account | Email | Involvement |
|------|-------|-----------------|-------|-------------|
| Sarah Chen | Customer Success Manager | Account owner; all client correspondence | sarah.chen@company.com | All threads, QBR organiser, renewal lead |
| Michael Torres | Solutions Architect | Technical delivery; beta env, export fix, SSO | michael.torres@company.com | Staging validation, TKT-2051/2065/2070, SSO planning |
| Emily Zhang | Support Engineer | Support escalation (L2) | emily.zhang@company.com | TKT-2047/2059, CDN fix |
| Legal team | Legal | Amendment and data-residency clause | legal@company.com | Renewal thread |

Escalation path (per Confluence): L1 Support Portal → L2 Emily Zhang → L3 Michael Torres → Executive Sarah Chen.

---

## 7. Account Context and Risks

**Commercial position**
- Current tier: Enterprise Plus, 500 seats; annual value $425,000; contract expires 2026-12-31.
- Utilisation: 487/500 seats (97.4%) per the account brief — close to the seat ceiling, which supports the unlimited-seat Elite proposal.
- Proposed renewal: two-year Enterprise Elite, unlimited seats, SSO module free in year one, 99.95% uptime SLA.

**Delivery position**
- September export: 4 of 5 tickets resolved; TKT-2070 (custom SSO) in progress.
- Account brief reports 8 Q3 tickets, all resolved; the September export is a partial view (5 tickets).
- NPS 72 (+8 QoQ); pilot group of 50 users.
- Top feature request: custom dashboard widgets (34%); main pain point: mobile app (28%).

**Risks**
1. **Renewal deadline.** Expiry is 2026-12-31 and no terms are agreed. Three open commercial questions (Q1–Q3) must clear before the Sep 18 call can produce a term sheet.
2. **Pricing gap on SSO.** ACME explicitly asked for year-two support/maintenance costs; no answer is recorded.
3. **EU data residency.** ACME's 2027 expansion makes this a gating requirement; legal has not yet produced the addendum.
4. **QBR confirmation.** The Sep 24 slot is on our calendar but no written acceptance from ACME appears in the export.
5. **Beta receipt.** Credentials were due Sep 15; delivery/receipt is not evidenced, which risks the QBR demo.

---

## 8. Data Quality Notes

These conflicts were found while cross-referencing sources; the digest follows primary evidence (email headers and the calendar export) where sources disagree.

1. **Meeting dates conflict.** `corpus/acme/meetings/calendar_sync_notes.csv` places the Contract Renewal Kickoff on 2026-09-05 and an SSO Technical Deep Dive on 2026-09-10. The calendar export, the meeting CSV, and the contract email all place the renewal kickoff on **2026-09-10**; the technical API review was **2026-09-04**. The corpus notes appear to be mis-dated.
2. **Archive backup dates are wrong.** `archives/q3/backup/thread_archive_backup.txt` labels `acme_followup.eml` as Sep 5 and `acme_sep_checkin.eml` as Sep 14. Their actual headers are **Sep 9** and **Sep 12** respectively.
3. **Thread index references missing threads.** `corpus/acme/emails/client_thread_index.json` lists TH-003 "SSO Integration Requirements" (Sep 8–12, David Park / Raj Patel). No raw email for that thread exists in the workspace; its content is only inferable from meeting notes and TKT-2070. It is therefore excluded from the thread summaries above.
4. **Ticket count mismatch.** The account brief states 8 Q3 tickets; the Atlassian export contains 5 (all September). The export is treated as partial, not contradictory.
5. **Calendar time zone.** `acme_upcoming.ics` stores the QBR as a floating `20260924T140000`; the email states 2pm **ET**. Confirm the time zone with ACME.
6. **Summarizer output.** The managed `tool.email_thread_summarizer.demo002` was run against the raw threads as a mechanical cross-check. It extracts only lines ending in "?" and explicit Action/Decision prefixes, so it returned no decisions and no action items for these threads. Its output was not used as the source of record.
7. **Excluded material.** Internal finance records (invoice detail, margin, discount authority), HR records, and privileged legal files unrelated to the ACME account were reviewed for relevance and deliberately excluded: they are neither ACME correspondence nor distributable. No internal-only commercial figures (margin, discount authority, revenue targets) appear in this document.

---

## 9. Source Register

| Source | Path / service | Used for |
|--------|----------------|----------|
| Email — Q3 product update | `email_raw/acme_q3_thread.txt` | TH-001, decisions D1–D3 |
| Email — contract review | `email_raw/acme_contract_review.txt` | TH-002, renewal terms, Q1–Q3 |
| Email — beta access / QBR | `email_raw/acme_followup.eml` | TH-004, A1–A3 |
| Email — weekly check-in | `email_raw/acme_sep_checkin.eml` | TH-003, NPS, roadmap |
| Email summaries (pre-existing) | `email_summaries/acme_q3_summary.md`, `acme_sep_summary.md` | Cross-check only |
| Slack | `slack_archives/channel_acme_client.txt`, `channel_acme_eng.json` | Timeline, staging test, pinned items |
| Support tickets | `atlassian_history/acme_tickets.json`, `acme_ticket_export.csv` | Ticket status, TKT-2070 |
| Confluence | `atlassian_history/acme_confluence.html` | Architecture, escalation path |
| Calendar | `calendar_exports/acme_meetings_q3.csv`, `acme_upcoming.ics` | Timeline, Sep 18 / Sep 24 / Oct 1 |
| Contacts | `client_contacts/acme_stakeholders.csv`, `acme_corp_contact.json` | Stakeholder map |
| Account brief | `docs_briefs/acme_account_brief.md`, `acme_onboarding_notes.txt` | Health score, utilisation, history |
| Contract record | `legal_shared/acme_msa_executed.json` | Expiry, SLA baseline, amendment history |
| Thread index | `corpus/acme/emails/client_thread_index.json` | Thread inventory (with caveat above) |
| Meeting notes | `corpus/acme/meetings/calendar_sync_notes.csv` | Cross-check (dates superseded) |

---

*End of digest.*
