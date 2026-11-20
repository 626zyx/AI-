# Template 3 — SSO and authentication failures

**Use when:** users loop at the identity provider, SAML assertions time out, Azure AD
sign-in succeeds but CloudSync rejects the session, or everyone is asked to
re-authenticate after an upgrade.

**Do not use when:** the report is a suspected credential-stuffing or account-takeover
attempt. In that case, do not troubleshoot by email — escalate to Security
immediately and preserve logs.

**Verified facts this reply relies on**

- Azure AD customers using custom domains hit an SSO login loop tracked as `AUTH-042`;
  it is listed as a known issue in v3.3.0 and fixed in v3.3.1
  (`release_notes/v3.3.yaml`, `product_docs/changelog.json`).
- SAML assertion timeouts for IdP-initiated flows were fixed in v3.1 (`SYNC-689`,
  `release_notes/v3.1.md`).
- A resolved Azure AD SSO case was caused by an incorrect SAML assertion consumer URL
  plus cached metadata on the CloudSync side (`ticket_history/tickets_q2.csv`,
  TKT-2024-011).
- SSO is configured under Admin Console > Security > SSO
  (`ticket_history/resolutions.md`).

## Customer reply

Subject: Re: {{ticket_subject}} — {{ticket_id}}

Hello {{customer_name}},

Thank you for the details, and sorry your users are stuck at sign-in. SSO failures are
usually a configuration mismatch between the identity provider and CloudSync rather
than a credential problem, so the checks below are aimed at the assertion path.

**Step 1 — Confirm the client and server versions**

- CloudSync desktop client: Help > About
- CloudSync release in use: {{release_version}}

If you are on v3.3.0 with Azure AD and a custom domain, you may be hitting the known
`AUTH-042` login loop. That is fixed in v3.3.1; upgrading is the first thing to try.

**Step 2 — Verify the SAML assertion consumer URL**

In the Azure AD enterprise application, confirm the **Assertion Consumer Service
(ACS) URL** exactly matches the value shown in CloudSync under
**Admin Console > Security > SSO**. A trailing slash or an `http`/`https` difference is
enough to break the flow.

**Step 3 — Clear cached metadata on the CloudSync side**

In **Admin Console > Security > SSO**, refresh the identity-provider metadata so
CloudSync re-reads the current signing certificate and endpoints. Then retry in a
private browser window before testing the desktop client.

**Step 4 — Re-authenticate**

Sign out of the desktop client, quit it completely, reopen it and sign in again. For
IdP-initiated flows, start from the Azure AD app portal rather than from the CloudSync
URL.

**Step 5 — If the loop persists**

Send me:

- a screenshot of the failing step, with the URL visible,
- the approximate UTC timestamp of the failure,
- the affected user's UPN and whether they are in a custom domain,
- a diagnostic bundle from one affected machine (`cloudsync diag collect`).

I will compare the assertion attributes against what CloudSync expects and escalate to
the identity specialist if the mismatch is not obvious.

I know SSO outages block everyone at once, including people who just need to read a
file. If this is stopping all work, tell me and I will treat it as a priority case while
we work through the checks.

Kind regards,
{{agent_name}}
CloudSync Support

---

**Internal handling notes**

- Never ask for a password, MFA code, SAML assertion body or client secret. Ask for a
  screenshot with the URL and a timestamp instead.
- Known-issue references: `AUTH-042` (Azure AD custom-domain login loop, fixed 3.3.1)
  and `SYNC-689` (SAML assertion timeout for IdP-initiated SSO, fixed 3.1).
- TKT-2024-011 is the reference resolution: ACS URL correction plus metadata refresh,
  restored in 15 minutes.
- If more than one tenant is affected simultaneously, stop template handling and check
  for an auth-service incident before replying.

## Source citations

- `ticket_history/tickets_q2.csv` — TKT-2024-011 (Azure AD SSO, ACS URL + metadata).
- `release_notes/v3.3.yaml` — known issue AUTH-042, SSO re-authentication.
- `product_docs/changelog.json` — 3.3.1 hotfix for AUTH-042.
- `release_notes/v3.1.md` — SYNC-689 SAML assertion timeout fix.
- `ticket_history/resolutions.md` — SSO configuration location.
- `faq_guides/best_practices.txt` — MFA enforcement.
