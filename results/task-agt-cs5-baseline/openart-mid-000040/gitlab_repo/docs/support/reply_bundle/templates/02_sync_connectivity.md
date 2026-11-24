# Template 2 — Sync connectivity and files not reaching some users

**Use when:** the agent shows "Disconnected", logs contain `SYNC-401`, files appear for
some team members but not others, or sync silently stops with no error in the UI.

**Do not use when:** the customer reports deletion or corruption (Template 8), or a
whole region is down (escalate immediately and use the incident wording).

**Verified facts this reply relies on**

- `SYNC-401` / "Disconnected" causes: firewall blocking TCP 8443, expired client
  certificate, DNS failure for `sync.cloudsync.example.com`
  (`kb_articles/troubleshooting.json`, TROUBLE-001).
- Files visible to some members only: namespace policy, client version mismatch or a
  corrupted local index (TROUBLE-003).
- Minimum compatible client version is v3.1+ (`release_notes/v3.3.yaml`).
- Selective-sync exclusions remain available on demand through the web interface
  (`faq_guides/onboarding.md`).

## Customer reply

Subject: Re: {{ticket_subject}} — {{ticket_id}}

Hello {{customer_name}},

Thank you for flagging this, and sorry for the disruption. When files reach some
people but not others, the cause is almost always one of three things: connectivity,
a namespace policy, or the local index. The checks below separate them quickly.

**Step 1 — Confirm the agent is running**

Check the tray/menu-bar icon and the agent status:

```
cloudsync status
```

If the agent is stopped, start it and watch whether it stays connected for more than a
few minutes.

**Step 2 — Test connectivity**

```
cloudsync diag network
nslookup sync.cloudsync.example.com
cloudsync cert status
```

- Outbound TCP **443** and **8443** must be allowed.
- `cloudsync cert status` must show a valid, unexpired certificate. An expired client
  certificate produces exactly the `SYNC-401` pattern.
- If DNS resolves to an unexpected address, check for a split-horizon DNS or VPN
  configuration on the affected machines.

**Step 3 — Check the client version**

Every client must be on **v3.1 or later**. Mixed versions are a common reason a file
appears for one person and not another. Send me the output of:

```
cloudsync --version
```

**Step 4 — Check namespace policy and group membership**

In the admin console, go to **Team > Policies** and confirm the member's group is
included in the namespace policy. If selective sync is in use, confirm the directory
is not excluded for that member. Excluded files are still reachable through the web
interface, which is a useful cross-check.

**Step 5 — Rebuild the local index on one affected client**

```
cloudsync index rebuild
```

Then re-register the client if it still will not attach:

```
cloudsync register --force
```

**Step 6 — If it is still failing**

Send me a diagnostic bundle from one working and one failing machine:

```
cloudsync diag collect
```

Comparing the two usually identifies the difference in one pass.

I realise this is disruptive when a whole team cannot see the same files. If the
connectivity checks pass and the rebuild does not help, say so in your reply and I will
escalate with both bundles attached rather than asking you to repeat the steps.

Kind regards,
{{agent_name}}
CloudSync Support

---

**Internal handling notes**

- Ask for one working and one failing machine. A single bundle from a failing machine
  cannot show the delta.
- If `cloudsync cert status` shows expiry, do not ask the customer to regenerate the
  certificate themselves; issue the replacement through the normal registration flow.
- `cloudsync index rebuild` is the documented verb here, but Template 1 uses
  `index clear` + `start --index-rebuild-priority high`. Confirm the build's CLI before
  combining the two templates (finding C4).
- Files "missing" for one user can also be a licensing/seat problem; check Template 4
  before deep troubleshooting if the affected person was recently added.

## Source citations

- `kb_articles/troubleshooting.json` — TROUBLE-001, TROUBLE-003.
- `ticket_history/resolutions.md` — "Sync Connectivity Issues" runbook.
- `ticket_history/tickets_q1.json` — TKT-2024-003 (namespace regex correction).
- `release_notes/v3.3.yaml` — minimum client version v3.1+.
- `faq_guides/onboarding.md` — selective sync and on-demand web access.
- `faq_guides/best_practices.txt` — namespace organisation.
