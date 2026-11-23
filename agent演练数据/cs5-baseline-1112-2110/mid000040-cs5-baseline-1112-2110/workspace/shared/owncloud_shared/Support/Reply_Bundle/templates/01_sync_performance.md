# Template 1 — Sync performance degradation after an upgrade

**Use when:** the customer reports a step-change in sync latency after upgrading, a
client stuck on "Syncing", CPU spikes on the sync agent, or repeated timeouts on a
large workspace.

**Do not use when:** only one user is affected (use Template 2), or the customer
reports data loss (use Template 8).

**Verified facts this reply relies on**

- Initial sync is throttled by design and large repositories are the slow case
  (`kb_articles/troubleshooting.json`, TROUBLE-005).
- High CPU during sync is commonly delta computation, antivirus scanning or RAM
  pressure (TROUBLE-002).
- A corrupted or fragmented local index causes partial sync and is fixed by an index
  rebuild (TROUBLE-003, TROUBLE-004).
- Residual issue after the v3.2 upgrade was resolved by clearing and rebuilding the
  index (`ticket_history/tickets_q1.json`, TKT-2024-004).
- A comparable enterprise case (850 GB, 200 users, 12 namespaces) was resolved by
  staggering priority index rebuilds across clients; all 200 machines recovered
  within 24 hours (`drafts/email_thread.txt`, TKT-2024-018).

## Customer reply

Subject: Re: {{ticket_subject}} — {{ticket_id}}

Hello {{customer_name}},

Thank you for the detailed report, and I am sorry your team is losing development
time to this. A slowdown that starts right after an upgrade usually comes from the
local sync index rather than from the relay, so I would like to confirm that first and
then get you back to normal sync speed.

**Step 1 — Confirm what is deployed**

On 3–5 affected machines, open Help > About and send me the exact build number
(for example, `3.3.0-bNNN`). Please also confirm whether any namespace policy changed
in the last 30 days.

**Step 2 — Capture diagnostics**

Run the following on each affected machine and attach the bundles:

```
cloudsync diag collect
cloudsync index stats
```

If `index stats` reports fragmentation above roughly 60%, the index is the likely
cause. That is consistent with the pattern we see after a format change.

**Step 3 — Rebuild the index on a small pilot group first**

```
cloudsync stop
cloudsync index clear
cloudsync start --index-rebuild-priority high
```

A rebuild typically takes 30–60 minutes per client on a multi-hundred-gigabyte
workspace, and it is CPU- and I/O-heavy while it runs. Please start with 3–5 machines,
confirm the result, and only then roll out to the rest of the team.

**Step 4 — Stagger the rollout**

Rebuilding every client at once can saturate your relay and make the whole team slower
for a period. Stagger by floor, team or namespace — for example, one group per hour —
and keep the total concurrency low until the rebuilds finish.

**Step 5 — Verify**

After a client completes its rebuild:

```
cloudsync status
cloudsync diag network
```

Sync latency should return to its pre-upgrade baseline. If a machine is still slow
after a completed rebuild, send me a fresh diagnostic bundle and I will take it from
there.

**About a permanent fix**

A release with an optimised index migration is planned, but I do not want to give you
a date I cannot hold. I will confirm the version and date with Engineering and follow
up separately. The rebuild above is the supported workaround in the meantime.

I know a 200-person team cannot absorb an outage quietly. If the pilot group does not
recover, reply with the bundles and I will escalate the case with your workspace
details attached.

Kind regards,
{{agent_name}}
CloudSync Support

---

**Internal handling notes**

- Do not promise a specific fix version. The only confirmed 3.3.x releases are 3.3.0
  and 3.3.1 (`product_docs/changelog.json`). The claim in the email thread that
  "v3.3.2" contains an index-migration fix conflicts with internal release planning —
  see `reference/source_consistency_review.md`, finding C2.
- Do not say the index format changed *in v3.3.0* as settled fact. The release notes
  for 3.3.0 do not mention an index migration, while the v3.2 ticket does
  (finding C3).
- CLI verbs differ between documents: `cloudsync index rebuild` in
  `ticket_history/resolutions.md` and TROUBLE-003 versus
  `cloudsync index clear` + `cloudsync start --index-rebuild-priority high` in the
  resolved enterprise case. Confirm the verb for the customer's build before sending;
  see finding C4.
- If the workspace is above 500 GB, also mention the Bulk Import tool and the option
  of a local relay (`faq_guides/best_practices.txt`, TROUBLE-005).

## Source citations

- `kb_articles/troubleshooting.json` — TROUBLE-002 (high CPU), TROUBLE-003 (corrupted
  index), TROUBLE-005 (slow initial sync, bulk import, relay regions).
- `ticket_history/tickets_q1.json` — TKT-2024-004 (v3.2 index rebuild resolution).
- `ticket_history/resolutions.md` — "Performance Troubleshooting" runbook.
- `drafts/email_thread.txt` — TKT-2024-018, enterprise 850 GB case, workaround and
  stagger guidance.
- `release_notes/v3.3.yaml` — v3.3.0 improvements and known issues.
- `product_docs/changelog.json` — released versions 3.2.1, 3.3.0, 3.3.1.
- `faq_guides/best_practices.txt` — 500 GB guidance and exclusion advice.
