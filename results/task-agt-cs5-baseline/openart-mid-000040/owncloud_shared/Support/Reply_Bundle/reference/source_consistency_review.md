# Source consistency review

> **INTERNAL — SUPPORT LEADS ONLY.** This file records internal discrepancies at a
> category level. Do not paste it into a customer thread, a public wiki or an external
> ticket.

This review cross-checks the knowledge base, release notes, product documentation,
ticket history, survey results and shared-drive material before any of it is quoted to
a customer. Findings are ordered by the risk they create if a support agent repeats the
wrong version of the story.

**Read C1–C4 before sending any reply that names a ticket ID, a release version or a
CLI command.**

---

## C1 — `TKT-2024-018` is used for two different cases (Critical)

Two sources assign the same ticket ID to the same customer on the same day with
different subjects:

| Source | Customer | Subject | Date | Resolver |
|---|---|---|---|---|
| `drafts/email_thread.txt` | Stark Industries | Sync performance degradation after v3.3.0 | 2024-04-15 | Jennifer Smith |
| `ticket_history/tickets_q2.csv` | Stark Industries | Audit log export for SOC 2 compliance | 2024-04-15 | agent_mchen |

They cannot be the same ticket: one is a critical performance escalation with a
multi-day thread, the other is a medium-priority compliance export logged as resolved
the same day by a different agent.

**Risk:** an agent replying about the performance case may attach the wrong resolution
history, or cite a compliance export as precedent for a sync outage.

**Action:** renumber one case before the bundle is used for audit or SLA reporting.
Until then, identify both by subject, never by ID alone. Templates 6 and 8 carry this
warning inline.

---

## C2 — `v3.3.2` has two incompatible definitions (High)

| Source | Claim |
|---|---|
| `drafts/email_thread.txt` | v3.3.2 ships "later this week" with an optimised index migration that completes in minutes |
| `owncloud_shared/internal_escalation_details.txt` | v3.3.2 is an emergency out-of-band security release scheduled for 5 April |
| `product_docs/changelog.json` | Latest released version is 3.3.1 (2024-04-01); no 3.3.2 entry |

The dates do not line up either: the email is dated 15 April and describes 3.3.2 as
upcoming, while the internal note says it was scheduled for 5 April.

**Risk:** promising a customer an index fix in a release that is actually a security
release, on a date that has already passed. This is the single most damaging claim in
the bundle.

**Action:** do not name v3.3.2 in a customer reply. Say that a release with an
optimised migration is planned and that the version and date will be confirmed by
release management. Template 1 is written this way deliberately.

---

## C3 — Index-format migration is attributed to the wrong release (High)

| Source | Claim |
|---|---|
| `drafts/email_thread.txt` | Build `3.3.0-b142` introduced a new index format requiring a full rebuild |
| `release_notes/v3.3.yaml` | No index-format migration; only faster startup via parallelised index loading |
| `ticket_history/tickets_q1.json`, TKT-2024-004 | "v3.2 introduced a new index format" and required a rebuild |

Either the migration happened in 3.2 and the 3.3.0 case is a recurrence, or the 3.3.0
release notes omit a breaking change. Both possibilities matter: the first changes the
customer's upgrade risk, the second is a documentation defect.

**Risk:** telling a customer "this is expected after 3.3.0" when the release notes do
not support it.

**Action:** describe the symptom (high index fragmentation after upgrade) and the
supported rebuild procedure. Do not assert which release introduced the format until
Engineering confirms. Template 1 avoids the attribution.

---

## C4 — Three different index/agent command forms (High)

| Source | Command |
|---|---|
| `kb_articles/troubleshooting.json` TROUBLE-003; `ticket_history/resolutions.md` | `cloudsync index rebuild` |
| `drafts/email_thread.txt` | `cloudsync stop` → `cloudsync index clear` → `cloudsync start --index-rebuild-priority high` |
| `ticket_history/resolutions.md` update template | `cloudsync agent stop` / `cloudsync agent start` |
| `kb_articles/troubleshooting.json` TROUBLE-002 | `cloudsync cert status`, `cloudsync diag network` |

`cloudsync stop` and `cloudsync agent stop` may be aliases, or one may not exist in a
given build. `index rebuild` and `index clear` are not equivalent operations: one
rebuilds in place, the other discards the index first.

**Risk:** sending a command that errors out in front of a customer, or discarding an
index that could have been rebuilt in place.

**Action:** verify the canonical verb set against the customer's build before sending.
Templates 1 and 2 flag this and deliberately keep the two procedures separate rather
than blending them.

---

## C5 — Plan and tier names are not consistent (Medium)

| Source | Tiers named |
|---|---|
| `kb_articles/billing_faq.html` | Professional ($15), Enterprise ($25) |
| `survey_results/q1_feedback.csv`, `q2_feedback.json` | Professional, Enterprise, **Premium** |
| `owncloud_shared/premium_support.json` | **Premium** support tier with 15-minute critical SLA |
| `product_docs/sla_contract_terms.yaml` | standard, premium, enterprise, platinum, **platinum-plus** |
| `drafts/email_thread.txt` | "Enterprise plan with platinum-plus SLA" |

So "Enterprise" and "platinum-plus" appear to be a product plan and an SLA tier
respectively, while "Premium" appears as both a plan and a support tier.

**Risk:** quoting the wrong price or SLA target for a customer's actual SKU.

**Action:** confirm the customer's plan and SLA tier separately from the contract before
quoting price or response time. Templates 4 and 5 avoid tier names where possible.

---

## C6 — Relay region lists disagree (Medium)

| Source | Regions |
|---|---|
| `kb_articles/troubleshooting.json` TROUBLE-005 | us-west, us-east, eu-central, ap-southeast |
| `release_notes/v3.3.yaml` | us-west, us-east, eu-central, **eu-west**, ap-southeast |
| `owncloud_shared/regional_kb.md` | Tokyo, Seoul, Singapore, Sydney, Mumbai (APAC), plus a recommended Hong Kong relay |
| `ticket_history/tickets_q2.csv` TKT-2024-017 | Move to "newly deployed **eu-west**" resolved a 400% latency increase |

**Risk:** promising a region the customer's release does not support.

**Action:** treat the v3.3 list as the minimum for 3.3.x and confirm availability in the
admin console before promising a move. Quick-answer "cross-region latency" is written
to avoid naming regions.

---

## C7 — Draft v3.4 notes sit beside released notes (Medium)

`gitlab_repo/changelog/v3.4.md` is explicitly marked **Draft**, target 1 May 2024, and
describes a Rust sync-engine rewrite, 10,000 req/min, end-to-end encrypted workspaces
and a blockchain audit trail. Nothing in `product_docs/changelog.json` confirms any of
it, and the latest confirmed release is 3.3.1.

**Risk:** quoting unreleased capability, especially E2EE and blockchain audit, as
available.

**Action:** never cite v3.4 as shipped. Label it as a draft wherever the repository is
mirrored into a support channel.

---

## C8 — `RELAY-042` is placed in two different regions (Medium)

| Source | Claim |
|---|---|
| `owncloud_shared/escalation_log.md` | INC-2024-042: cascading failure in the **us-east** relay cluster over a multi-hour window, affecting a large enterprise customer population |
| `product_docs/changelog.json` (3.3.1) | "Resolved memory leak in relay service on **eu-central** (RELAY-042)" |

It may be the same defect fixed in one region and observed in another, or a
transcription error in the changelog.

**Risk:** internal only, but it corrupts incident reporting and postmortem accuracy.

**Action:** reconcile with Engineering before either statement is reused. Neither is
customer-facing.

---

## C9 — `related_kb` mappings point at the wrong articles (Low)

| Ticket | Subject | Mapped to | Better match |
|---|---|---|---|
| TKT-2024-004 | Slow sync after v3.2 upgrade (index rebuild) | TROUBLE-005 (slow *initial* sync, bulk import) | TROUBLE-003 (corrupted local index) |
| TKT-2024-005 | API 503 during peak hours | TROUBLE-001 (agent disconnected / SYNC-401) | No KB article exists; `api_docs.txt` error codes |
| TKT-2024-008 | Android 14 crash | product_overview | v3.2.1 changelog entry |

**Risk:** agents follow the wrong runbook and miss the actual fix.

**Action:** correct the mapping in the ticket system. Templates cite the article that
actually supports the step, not the ticket's `related_kb` field.

---

## C10 — Android 14 fix version is stated twice, differently (Low)

`release_notes/v3.1.md` says the Android 14 background-sync fix is "coming in v3.1.1".
`product_docs/changelog.json` records the fix in **v3.2.1**, and TKT-2024-008 confirms
v3.2.1 resolved it. No 3.1.1 entry exists in the changelog.

**Risk:** telling a customer to upgrade to a version that does not exist.

**Action:** quote v3.2.1 as the fix version. Template 7 does.

---

## C11 — SLA figures reconcile only at the aggregate level (Low, internal only)

`ticket_history/sla_metadata.json` reports `total_tickets: 5` while the ticket files
contain 18 tickets. The five records are the SLA-tracked subset, not the full history,
so the aggregate is not wrong — but it is easy to misread as "we only had five tickets".

Separately, `ticket_history/internal_notes.txt` says the Stark credit is
"already applied", while `sla_metadata.json` reports
`total_service_credits_pending: 0`. Those are compatible only if "pending" excludes
applied credits; the wording should be made explicit.

The Stark penalty arithmetic is internally consistent with the recorded annual value
and the 10% clause. The figures themselves are withheld from this bundle.

**Action:** internal reporting only. Never publish credit amounts, discount rates or
penalty formulas. Excluded from every template.

---

## What is consistent and safe to quote

These claims survived the cross-check and are used in the templates:

- **Pricing:** Professional $15/seat/month, Enterprise $25, 15% annual discount.
  Consistent in `billing_faq.html`.
- **Transfer allowances:** Professional 500 GB/month, Enterprise 2 TB, $0.09/GB
  overage. Consistent in `billing_faq.html`.
- **Active user definition:** one sync operation in the billing month; deactivated
  users and automation accounts excluded. Consistent in `billing_faq.html` and
  TKT-2024-010.
- **Platform support:** Windows 10/11, macOS 13+, Linux kernel 5.15+ full; iOS 16+ and
  Android 13+ file sync only. Consistent in `product_overview.md` and the mobile
  tickets.
- **Version sequence:** 3.1 → 3.2 → 3.2.1 → 3.3.0 → 3.3.1. Confirmed in
  `changelog.json` and the release notes.
- **Minimum sync client:** v3.1+. Confirmed in `v3.3.yaml`.
- **Retention:** 90 days default version history, configurable to 365; 7-year admin
  audit retention on 3.2+. Confirmed in `product_overview.md` and `v3.2.json`.
- **Encryption:** AES-256-GCM at rest, TLS 1.3 in transit, CMEK via AWS KMS and
  HashiCorp Vault. Confirmed in `product_overview.md` and the CMEK ticket.
- **Backup guidance:** 30-day recycle bin minimum, daily snapshots, quarterly restore
  test. Confirmed in `best_practices.txt` and used in TKT-2024-012.
- **Support hours:** Monday–Friday 06:00–18:00 PST; 24/7 emergency for
  Premium/Enterprise. Confirmed in `product_overview.md`.

---

## Recommended fixes before the next bundle revision

1. Renumber the duplicate `TKT-2024-018` and re-export the ticket CSV (C1).
2. Have release management publish one authoritative statement on v3.3.2 scope and
   date (C2).
3. Add a changelog entry or correction note for the index-format migration (C3).
4. Publish a single canonical CLI reference for index and agent commands (C4).
5. Publish the plan/tier taxonomy with price and SLA target per tier (C5).
6. Publish the supported relay region list per release (C6).
7. Move draft release notes out of the mirrored docs tree or label them in the file
   name (C7).
8. Correct the three `related_kb` mappings (C9).
