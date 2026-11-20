# Template 5 — Account and user management

**Use when:** the customer asks how to invite or remove users, change roles, hand over
workspace ownership, enforce MFA, review API keys, or onboard a new team.

**Do not use when:** the request is an urgent offboarding due to a security incident —
that follows the security escalation path, not standard account handling.

**Verified facts this reply relies on**

- Invitations arrive by email; MFA is required for all accounts
  (`faq_guides/onboarding.md`).
- Roles and membership are managed in Admin Console > Team > Members / Roles;
  SSO in Security > SSO; API keys in Settings > API Keys
  (`ticket_history/resolutions.md`).
- Best practice is read-only first, then read-write after training; MFA enforced;
  API keys rotated every 90 days; access logs reviewed weekly
  (`faq_guides/best_practices.txt`).
- Seat limits can block invitations (TKT-2024-002).

## Customer reply

Subject: Re: {{ticket_subject}} — {{ticket_id}}

Hello {{customer_name}},

Happy to help with the account changes. Here is the standard sequence so that access
is granted at the right level and nothing is left behind.

**Invite a new member**

1. Confirm there is a free seat under **Admin Console > Billing**.
2. Go to **Admin Console > Team > Members > Invite**.
3. Enter the work email address and choose the initial role.
4. Ask the member to accept the invitation and enrol MFA on first sign-in.

If the invitation fails, it is almost always the seat limit rather than a permissions
error — check Billing before retrying.

**Change a role**

1. **Admin Console > Team > Roles**.
2. Select the member, choose the new role, save.
3. Allow 30–60 seconds for the change to propagate to clients.

**Offboard a member**

1. Deactivate the account in **Team > Members**.
2. Remove them from any namespace policies and groups.
3. Revoke their personal API keys in **Settings > API Keys**.
4. Reassign ownership of any files or namespaces they owned.
5. Confirm the seat count drops in Billing.

Deactivation stops future sync but does not delete the data they contributed. If the
customer needs the data removed as well, handle that as a separate retention request
and confirm it in writing.

**Enforce MFA and review keys**

- MFA can be required for all accounts under **Security**.
- API keys should be rotated at least every 90 days and never shared by email or chat.
- Review access logs weekly for unusual sign-in or key-use patterns.

**Onboarding a team**

Start new members read-only and upgrade them after training. Point them at the
onboarding guide before granting write access so they understand selective sync and
conflict handling first.

If you tell me the exact change you need — for example, "move three people from
read-only to read-write" or "remove a departing contractor" — I can give you the
specific console path and confirm the expected effect.

I know access changes are time-sensitive, particularly for departures. If this is tied
to someone leaving today, mark the ticket urgent and I will prioritise the revocation
steps.

Kind regards,
{{agent_name}}
CloudSync Support

---

**Internal handling notes**

- Never ask for the user's password or an API key value. Refer to key *names* and last
  four characters only.
- A deactivated user who synced earlier in the billing month may still be billable;
  cross-check Template 4 before telling the customer the seat count is wrong.
- Ownership transfer is the step most often missed. Confirm it explicitly before
  closing the ticket.
- Do not publish or attach the employee or credential files from `gitlab_repo`; they
  are internal-only and contain personal and secret data.

## Source citations

- `faq_guides/onboarding.md` — invitation, MFA, roles, selective sync, sharing.
- `faq_guides/best_practices.txt` — least privilege, key rotation, access review.
- `ticket_history/resolutions.md` — "Account Management" runbook.
- `ticket_history/tickets_q1.json` — TKT-2024-002 (seat limit on invitations).
- `kb_articles/billing_faq.html` — active-user definition for seat counts.
