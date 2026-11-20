# Quick answers for smaller inquiry types

Short, copy-ready answers for requests that do not need a full template. Each answer
names the source it came from. Keep the internal note with the answer when logging.

---

## Domain verification failing

**Reply**

> Custom-domain verification checks a DNS TXT record on the
> `_cloudsync-challenge` subdomain. Please confirm the record exists, has not been
> proxied by your DNS provider, and has had time to propagate through your TTL. If the
> record was added in the last few minutes, wait for the TTL and retry verification.
> If it still fails, send us the domain and the output of a public TXT lookup and we
> will check from our side.

**Source:** `ticket_history/tickets_q2.csv`, TKT-2024-013 — missing TXT record for
`_cloudsync-challenge`; verification passed after the record was added.

**Internal:** verification failures are overwhelmingly a missing or proxied TXT
record, not a CloudSync defect. Check propagation before escalating.

---

## Selective sync is not excluding a directory

**Reply**

> Selective sync exclusions are regex-based and are evaluated against the full path.
> A pattern that works for a simple folder name will not match a nested path. The
> validated pattern for excluding temporary files and `node_modules` anywhere in the
> tree is:
>
> ```
> ^(?!.*\.tmp$|.*\/node_modules\/).*$
> ```
>
> Please apply it under **Admin Console > Team > Policies**, use the policy preview
> (or `--dry-run` in the CLI) to confirm the match set, and then save. Policy changes
> normally propagate within 30–60 seconds.

**Source:** `ticket_history/tickets_q1.json`, TKT-2024-003 (corrected regex);
`release_notes/v3.1.md` (regex policy engine); `faq_guides/best_practices.txt`
(dry-run guidance).

**Internal:** always ask for the exact pattern and a sample path. A pattern that looks
correct in isolation often fails on trailing slashes or Windows separators.

---

## Webhook integration for sync events

**Reply**

> Configure the endpoint under **Admin Console > Integrations > Webhooks**. CloudSync
> sends a test event on save, so keep the endpoint reachable during setup. The payload
> format changed in v3.3 — if you are upgrading, review your handler before switching
> the endpoint over. For high-volume consumers, prefer audit-log streaming over
> per-event webhooks, and return `2xx` quickly, queueing the work asynchronously.

**Source:** `ticket_history/tickets_q1.json`, TKT-2024-009 (webhook setup);
`release_notes/v3.3.yaml` (webhook payload format change, audit-log streaming);
`release_notes/v3.2.json` (HTTP/3 transport).

**Internal:** a handler that blocks for more than a few seconds causes retries and
duplicate deliveries. Ask for the response time if duplicates are reported.

---

## Scheduled / off-peak sync

**Reply**

> You can schedule sync windows with the CLI. A typical configuration syncs the
> `/projects/active` namespace hourly during business hours:
>
> ```
> cloudsync schedule add --namespace projects/active --cron "0 9-18 * * 1-5"
> ```
>
> Use `--dry-run` first, and avoid scheduling large rebuilds and bulk imports in the
> same window as peak collaboration hours.

**Source:** `ticket_history/tickets_q2.csv`, TKT-2024-016 (cron-based schedule);
`faq_guides/best_practices.txt` (off-peak large operations).

**Internal:** confirm the exact CLI syntax against the customer's build; the scheduling
subcommand is documented only in the ticket resolution, not in the public API reference.

---

## Cross-region latency increased sharply

**Reply**

> Latency usually means traffic is landing on a distant or overloaded relay rather
> than the nearest one. Please run `cloudsync diag network` and send the relay host it
> reports. We can move the workspace to a nearer relay region if one is available for
> your release. Before changing anything, note the current latency so we can prove the
> improvement.

**Source:** `ticket_history/tickets_q2.csv`, TKT-2024-017 (moved from eu-central to
eu-west; 850 ms → 45 ms); `release_notes/v3.3.yaml` (multi-region relay, automatic
routing).

**Internal:** the region list is inconsistent across documents (finding C6). Confirm
the region exists in the customer's release before promising a move.

---

## API returns 503 during peak hours

**Reply**

> `503` means the service is temporarily unable to serve the request, not that the API
> key is wrong. Please confirm the time window, the endpoint, and whether retries with
> exponential backoff succeed. If the failures cluster in one region at peak load,
> send us the timestamps and region and we will check capacity. `429` is different — it
> means you are over the rate limit, and the `X-RateLimit-Reset` header tells you when
> to retry.

**Source:** `kb_articles/api_docs.txt` (503, 429, rate-limit headers);
`ticket_history/tickets_q1.json`, TKT-2024-005 (regional capacity saturation);
`release_notes/v3.3.yaml` (rate-limit headers on all responses).

**Internal:** never quote incident identifiers or postmortem details. If multiple
customers report 503 in the same region and window, stop template handling and check
the status page.

---

## Large upload times out

**Reply**

> Uploads over 5 GB can time out on slow or unstable connections. For anything in that
> range — and for repositories over 100 GB — use the Bulk Import tool, which supports
> resumable transfers. If you must use the standard upload, split the archive and run
> it outside peak hours.

**Source:** `release_notes/v3.3.yaml` (known issue: >5 GB uploads);
`kb_articles/troubleshooting.json`, TROUBLE-005 (Bulk Import over 100 GB);
`release_notes/v3.1.md` (bulk operations up to 100,000 files).

**Internal:** check whether the customer is on a relay far from their data before
blaming the connection.

---

## APAC language, locale or connectivity questions

**Reply**

> APAC support is available in Japanese, Korean and Mandarin during local business
> hours, with English coverage 24/7. Relays are available in Tokyo, Seoul, Singapore,
> Sydney and Mumbai. For mainland China, a Hong Kong relay usually gives the best
> result and can be selected under **Settings > Network > Custom Relay**. For garbled
> Japanese file names, confirm the client locale:
>
> ```
> cloudsync config set locale ja_JP.UTF-8
> ```

**Source:** `owncloud_shared/regional_kb.md` (languages, relay cities, Great Firewall
guidance, locale setting).

**Internal:** Thai and Vietnamese are partner-assisted only. Do not promise native
support in those languages.

---

## Upgrade path and client compatibility

**Reply**

> Supported upgrade paths: v3.0.x can upgrade directly to the current 3.x release;
> v2.x must go to v3.0 first. The minimum client version for sync compatibility is
> now v3.1+, and older clients will prompt to upgrade. Before upgrading, review the
> webhook payload change and the config-format migration, and confirm your integrations
> do not depend on the deprecated v1 WebSocket protocol or TLS 1.0/1.1.

**Source:** `release_notes/v3.1.md` (upgrade path); `release_notes/v3.2.json`
(breaking changes); `release_notes/v3.3.yaml` (minimum client v3.1+, config migration,
webhook change).

**Internal:** the v3.4 changelog is a **draft** and must not be quoted as released
functionality. See finding C7.
