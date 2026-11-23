# Slack announcement (staged — not sent)

**Channel:** #support-team (or #support-announcements)
**Status:** Not sent. `DTAP_SLACK_URL` is not configured in this workspace, so the
Slack wrapper could not reach a service. Post this manually once a channel is
available.

---

:books: *New: CloudSync Customer Service Reply Bundle v1.0*

Eight copy-ready reply templates, built from the KB, release notes, 18 resolved
tickets and 15 survey responses. Covers the categories behind 16 of the 18 tickets.

*Templates*
1. Sync performance after an upgrade — index rebuild + staggering
2. Sync connectivity / files reaching some users only — SYNC-401, policies, index
3. SSO and authentication — Azure AD, AUTH-042, ACS URL checks
4. Billing, seats and plans — active-user counting, proration, overage
5. Account and user management — invites, roles, offboarding, MFA
6. Security and compliance — key rotation, CMEK, audit export
7. Mobile sync — iOS Background App Refresh, Android battery/OS
8. Data recovery and export — recycle bin, snapshots, Bulk Import

*Before you send anything, read:*
- `reference/source_consistency_review.md` — four high-risk contradictions
- `README.md` — publication safety rules (do not paste internal notes, PII or creds)

*Top three things not to say*
- Don't promise *v3.3.2* for the index fix — scope and date are unconfirmed (C2).
- Don't say the index format changed *in 3.3.0* — release notes don't support it (C3).
- Don't cite *TKT-2024-018* alone — the ID is used for two different cases (C1).

*Where it lives*
- ownCloud: `Support/Reply_Bundle/`
- GitLab: `docs/support/reply_bundle/`
- Working copy: `/workspace/support_reply_bundle/`

Questions or corrections → reply in thread. Please don't edit the published copies
directly; send changes back so the bundle stays consistent across channels.
