# Template 6 — Security and compliance requests

**Use when:** the customer asks about API key rotation, customer-managed encryption
keys (CMEK), audit-log export, SOC 2 / ISO evidence, retention, or data residency.

**Do not use when:** the customer reports a suspected breach, leaked key, or
vulnerability. Route those to Security immediately; do not confirm or deny details and
do not speculate about scope.

**Verified facts this reply relies on**

- AES-256-GCM at rest, TLS 1.3 in transit, CMEK via AWS KMS and HashiCorp Vault
  (`kb_articles/product_overview.md`).
- Audit log streaming to SIEM via Syslog and HTTP webhook in v3.3; audit retention in
  the admin console extended to 7 years in v3.2
  (`release_notes/v3.3.yaml`, `release_notes/v3.2.json`).
- API keys are generated in Settings > API Keys; Enterprise rate limit 5000 req/min
  (`kb_articles/api_docs.txt`).
- Zero-downtime key rotation runbook: create new key, deploy to staging, verify,
  deploy to production, revoke old key after 24 hours
  (TKT-2024-015).
- CMEK rotation: create a new key version in KMS, update the CloudSync key alias,
  trigger the re-encryption job (TKT-2024-007; 3 hours for a 120 GB workspace).
- Audit export was delivered as signed JSON over secure file transfer after
  completeness verification by the customer's auditor (TKT-2024-018, audit-export
  variant — see the ticket-ID collision note).
- Premium/Enterprise compliance scope includes SOC 2 Type II, ISO 27001, GDPR and
  HIPAA (`owncloud_shared/premium_support.json`).

## Customer reply

Subject: Re: {{ticket_subject}} — {{ticket_id}}

Hello {{customer_name}},

Thank you for the detailed security request. I would rather give you an accurate,
auditable answer than a quick one, so below are the supported procedures and what I
need from you to complete each.

**Rotating API keys with zero downtime**

1. Create a new key in **Admin Console > Settings > API Keys**. Keep the old key
   active.
2. Deploy the new key to staging and run your integration tests.
3. Deploy it to production, one service at a time.
4. Observe for 24 hours; confirm no `401` or `403` spikes.
5. Revoke the old key.

Do not revoke first and deploy second — that is the usual cause of a rotation outage.
Assign the minimum scopes the integration needs rather than reusing an admin key.

**Rotating a customer-managed encryption key (CMEK)**

1. Create a new key version in AWS KMS or HashiCorp Vault.
2. Update the CloudSync key alias to point at the new version.
3. Trigger the re-encryption job from the admin console and monitor it to completion.

For planning, a 120 GB workspace took about 3 hours. Re-encryption runs in the
background; sync continues, but expect some I/O load.

**Audit log and compliance export**

- For ongoing monitoring, configure **Integrations > Audit Log Streaming** to Syslog or
  an HTTPS webhook. Delivery is real-time.
- For a point-in-time export, use the Data Export API with a date range. We deliver
  signed JSON and can verify completeness against your auditor's sample.
- Admin-console audit retention is 7 years on current releases.

**What I need from you**

- The workspace ID and the exact date range.
- Whether the export must be signed and delivered over a specific secure channel.
- Any control framework you are mapping to (SOC 2, ISO 27001, HIPAA, GDPR), so the
  evidence matches the control.

I will confirm the delivery method and expected completion time before starting, so
there is no ambiguity about chain of custody.

Security requests carry a different kind of pressure — you may be answering to an
auditor or a customer. If you have a deadline, tell me the date and I will sequence the
work around it.

Kind regards,
{{agent_name}}
CloudSync Support

---

**Internal handling notes**

- **Suspected breach or leaked key:** stop, do not use this template, escalate to
  Security and Legal. Do not confirm whether an incident exists, do not name internal
  incident IDs, and do not state that a customer was or was not affected.
- Never ask the customer to send an API key, private key or decryption material by
  email. Use the console or the approved secure transfer channel.
- TKT-2024-018 is used twice in the sources: once for the Stark sync-performance case
  in `drafts/email_thread.txt` and once for a Stark audit-log export in
  `ticket_history/tickets_q2.csv`. Cite the subject, not just the ID
  (finding C1).
- Do not reference remediation status, legal hold or vulnerability identifiers from
  internal escalation files in any customer-facing text.

## Source citations

- `kb_articles/product_overview.md` — encryption, CMEK, audit trail, retention.
- `kb_articles/api_docs.txt` — API keys, scopes, rate limits, error codes.
- `release_notes/v3.3.yaml` — audit log streaming, SIEM integrations.
- `release_notes/v3.2.json` — 7-year audit retention, Compliance Lock.
- `ticket_history/tickets_q2.csv` — TKT-2024-015 (key rotation), TKT-2024-018
  (audit export).
- `ticket_history/tickets_q1.json` — TKT-2024-006 (data export), TKT-2024-007 (CMEK).
- `owncloud_shared/premium_support.json` — compliance certifications for premium tier.
- `faq_guides/best_practices.txt` — key rotation and access-log review cadence.
