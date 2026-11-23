# Template 8 — Data recovery and workspace export

**Use when:** files or a workspace were deleted, a restore is needed from snapshot or
recycle bin, or the customer needs a bulk export for compliance or migration.

**Do not use when:** the customer suspects corruption or tampering. Preserve the
workspace state, do not trigger a rebuild, and escalate to the data-integrity team.

**Verified facts this reply relies on**

- Recycle bin retention should be at least 30 days; daily snapshots are the
  recommended configuration; restores should be tested quarterly
  (`faq_guides/best_practices.txt`).
- A resolved recovery restored 43,000 files from a 7-day snapshot and advised enabling
  the recycle bin (TKT-2024-012).
- Bulk export uses the Data Export API with a date range; an 850 GB export completed in
  4 hours (TKT-2024-006).
- Repositories over 100 GB should use the Bulk Import tool; bulk operations support up
  to 100,000 files per operation (`faq_guides/best_practices.txt`,
  `release_notes/v3.1.md`, TROUBLE-005).
- Version history retention is 90 days by default, configurable to 365
  (`kb_articles/product_overview.md`).
- Large uploads over 5 GB may time out on slow connections; use Bulk Import.

## Customer reply

Subject: Re: {{ticket_subject}} — {{ticket_id}}

Hello {{customer_name}},

I am sorry data is missing — I will treat this as urgent. Two things matter most right
now: preserving what is still recoverable, and not overwriting it while we work.

**Please do this first**

1. **Stop syncing the affected namespace** on the machines that noticed the loss, so a
   local deletion is not propagated further.
2. **Do not** run an index rebuild, a re-registration, or a "clear index" command yet.
3. Note the approximate time the files disappeared and the namespaces involved.

**Step 1 — Check the recycle bin**

In the web interface, open the namespace > **Recycle Bin**. Deleted items are retained
there for the configured retention window (30 days minimum recommended). Restore the
items you need and confirm they reappear for the team.

**Step 2 — Restore from snapshot**

If the items are past the recycle-bin window, we can restore from a snapshot:

1. Confirm the target date and namespace.
2. I will restore into a **separate recovery namespace** first, not over the live one.
3. You verify the contents, then we move them into place.

Restoring over the live namespace is a last resort because it can overwrite changes
made after the deletion.

**Step 3 — Bulk export (if you need a full copy)**

For compliance or migration:

```
GET /v3/... export endpoint with date range
```

In practice we run this through the Data Export API with a date range and deliver a
signed archive. An 850 GB workspace completed in about 4 hours. Tell me the date range
and destination, and whether the archive must be signed.

**Step 4 — Prevent recurrence**

- Enable the recycle bin with at least 30-day retention.
- Configure daily snapshots for critical namespaces.
- Test a restore quarterly so the procedure is familiar before it is needed.
- For very large restores or migrations, use the Bulk Import tool rather than a normal
  upload; uploads over 5 GB can time out on slow links.

I will confirm the recovery point and the expected restore time before touching
anything, so you know exactly what will come back.

Losing files is stressful, and I would rather move carefully than fast here. If the
data is regulated or client-confidential, tell me and I will involve the compliance
team in the recovery plan.

Kind regards,
{{agent_name}}
CloudSync Support

---

**Internal handling notes**

- Do not restore over a live namespace without written confirmation from the customer.
- Snapshot availability depends on the customer's configuration; check before promising
  a recovery point.
- If the loss coincides with a sync-agent upgrade, the index rebuild in Template 1 may
  be involved. Do **not** rebuild before the restore is complete.
- Suspected tampering or hash mismatch must go to the data-integrity team. Do not
  discuss integrity tooling or investigation status with the customer.
- The audit-export case and the sync-performance case share ticket ID TKT-2024-018;
  identify the case by subject when logging the recovery (finding C1).

## Source citations

- `ticket_history/tickets_q2.csv` — TKT-2024-012 (43,000 files from 7-day snapshot).
- `ticket_history/tickets_q1.json` — TKT-2024-006 (Data Export API, 850 GB in 4 hours).
- `faq_guides/best_practices.txt` — recycle bin, snapshots, restore testing.
- `kb_articles/product_overview.md` — version history retention 90–365 days.
- `kb_articles/api_docs.txt` — export and file endpoints.
- `release_notes/v3.1.md` — bulk operations up to 100,000 files.
- `kb_articles/troubleshooting.json` — TROUBLE-005 (Bulk Import over 100 GB).
- `release_notes/v3.3.yaml` — uploads over 5 GB may time out.
