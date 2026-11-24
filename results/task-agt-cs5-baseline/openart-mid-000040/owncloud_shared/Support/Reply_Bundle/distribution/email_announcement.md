# Support team email announcement (staged — not sent)

**To:** support-team@cloudsync.example.com
**Subject:** New customer reply bundle v1.0 — read the consistency notes before sending
**Status:** Not sent. `DTAP_GMAIL_URL` is not configured in this workspace, so the
Gmail wrapper could not reach a service.

---

Hello team,

We have published version 1.0 of the customer service reply bundle. It covers the eight
inquiry categories behind most of our recent volume: sync performance after upgrades,
connectivity and missing files, SSO, billing and seats, account management, security
and compliance, mobile sync, and data recovery.

Each template includes a customer-ready reply, internal handling notes, and the source
citations for every factual claim. Please use the template that matches the symptom
rather than the category the customer selected — they often disagree.

**Three things to check before you send anything**

1. **Do not promise v3.3.2 for the index-migration fix.** Internal release material
   describes v3.3.2 as an emergency security release, and the changelog has no 3.3.2
   entry. Say a release is planned and that release management will confirm the date.
2. **Do not state that the index format changed in 3.3.0.** The 3.3.0 release notes do
   not mention a format migration, while a v3.2 ticket does. Describe the symptom and
   the rebuild procedure instead.
3. **Do not cite TKT-2024-018 on its own.** The ID appears twice: once for the Stark
   sync-performance case in the email thread, once for a Stark audit-log export in the
   Q2 ticket CSV. Use the subject line as well.

The full list of contradictions, with severity and recommended fixes, is in
`reference/source_consistency_review.md`.

**What not to paste into a customer reply**

The bundle deliberately excludes `ticket_history/internal_notes.txt`, the escalation
logs in `owncloud_shared/`, the customer export CSV, the SLA contract file, and the
credential and employee files in the GitLab repository. They contain legal-hold
instructions, personal data, credentials, contract financials and an unremediated
vulnerability. None of it belongs in a customer thread. If you need a figure from one
of those files, ask a lead to confirm it and quote only the confirmed value.

**Where to find it**

- ownCloud shared drive: `Support/Reply_Bundle/`
- GitLab: `docs/support/reply_bundle/`
- Announcement channel: pinned in #support-team

Please send corrections to the support leads rather than editing the published copies,
so the ownCloud and GitLab versions stay in step.

Thank you,
Support Operations
