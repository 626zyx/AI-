# Email thread summary — TKT-2024-018 (Stark Industries sync performance)

Hand-written summary of `drafts/email_thread.txt`. The automated summarizer
(`source_summaries/email_thread_summary.md`) returned no action items for this thread,
which is incorrect; this summary supersedes it.

**Thread:** 4 messages, 2024-04-15 08:30 UTC → 2024-04-16 14:00 UTC.
**Participants:** Tony Stark (CTO, Stark Industries), Jennifer Smith (Senior Support
Engineer).
**Outcome:** resolved; customer confirmed normal performance and asked to close.

## Timeline and action items

| # | When (UTC) | Owner | Action | Status |
|---|---|---|---|---|
| 1 | 04-15 08:30 | Customer | Report latency 2 s → 45–60 s, stuck "Syncing", 95% CPU, 850 GB / 12 namespaces / 200 users | Done |
| 2 | 04-15 09:15 | Support | Create ticket at critical priority; request 5 diagnostic bundles, exact build, policy-change check, `index stats` | Done |
| 3 | 04-15 09:15 | Support | Commit to an update within the hour | Met (11:30) |
| 4 | 04-15 10:00 | Customer | Provide 5 bundles, build `3.3.0-b142`, no policy changes in 30 days, 78% index fragmentation | Done |
| 5 | 04-15 10:00 | Customer | Ask for an ETA; Friday release is at risk | Carried to #7 |
| 6 | 04-15 11:30 | Support | Identify background index rebuild as cause; issue stop → index clear → priority rebuild workaround; advise staggering | Done |
| 7 | 04-15 11:30 | Support | Promise priority access to v3.3.2 with an optimised migration | **Unverified — see below** |
| 8 | 04-16 14:00 | Customer | Staggered by floor, all 200 machines rebuilt within 24 h, performance normal | Done |
| 9 | 04-16 14:00 | Customer | Request ticket closure | **No closure confirmation in thread** |
| 10 | — | Support | Add the resolution to the internal knowledge base | Claimed in #6, not evidenced |

## Decisions

1. **Severity:** critical priority, on the basis of team size, workspace size and sprint
   impact.
2. **Root cause as stated:** build `3.3.0-b142` introduced a new index format requiring
   a full rebuild; the background rebuild on 850 GB had not completed on most clients.
3. **Workaround:** stop the agent, clear the index, restart with
   `--index-rebuild-priority high`. Rebuild takes 30–60 minutes per client.
4. **Rollout method:** stagger rebuilds across the team so the relay is not saturated.
   Implemented by floor; all 200 machines completed within 24 hours.
5. **Long-term fix:** v3.3.2 with an optimised index migration, with priority access
   for this customer.

Decisions 2 and 5 conflict with other sources; see
`reference/source_consistency_review.md` findings C2 and C3. Do not repeat them as
fact.

## Unresolved questions

1. **Permanent-fix ETA.** The customer's engineering director asked for one at 10:00.
   The reply promised "later this week" but gave no date. No date appears anywhere in
   the thread.
2. **Is v3.3.2 the index release?** Internal release material describes v3.3.2 as an
   emergency security release scheduled for 5 April. The changelog has no 3.3.2 entry.
   Unresolved and material.
3. **Was the ticket actually closed?** The customer asked; the thread ends there. The
   ticket system should be checked rather than assumed.
4. **Was the KB article created?** The agent said the resolution was added to the
   internal knowledge base. No article ID is given and no matching KB entry exists in
   `kb_articles/`. The closest is TROUBLE-003, which covers a corrupted index, not this
   upgrade path.
5. **Did every client recover?** "All affected clients" and "all 200 machines" are the
   customer's words; there is no per-client verification record.

## Response pattern worth reusing

The thread is a good model for a critical performance case:

- **Acknowledge with specifics, not platitudes.** The first reply names the team size,
  the velocity impact and the critical priority.
- **Ask for a bounded diagnostic set.** Five bundles, one build number, one policy
  check, one stats command — not "send logs".
- **Give a cadence commitment and meet it.** "Update within the hour" → reply at 11:30.
- **Separate immediate workaround from long-term fix.** The workaround is concrete and
  sequenced; the long-term fix is stated separately.
- **Warn about the side effect.** Staggering is presented as a way to avoid saturating
  the relay, which is why the customer adopted it by floor.
- **Close the loop on verification.** The final customer message is the verification;
  a support-side confirmation is still missing.

## Reusable phrasing

> "A slowdown that starts right after an upgrade usually comes from the local sync
> index rather than from the relay, so I would like to confirm that first and then get
> you back to normal sync speed."

> "I know a 200-person team cannot absorb an outage quietly. If the pilot group does
> not recover, reply with the bundles and I will escalate the case with your workspace
> details attached."

Both are used, adapted, in Template 1.
