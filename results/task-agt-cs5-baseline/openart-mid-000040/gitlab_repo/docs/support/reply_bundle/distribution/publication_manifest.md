# Publication manifest

Records what was published where, how it was verified, and what could not be
published because the target service was unreachable.

## Published copies

| Channel | Destination | Method | Status |
|---|---|---|---|
| Working copy | `/workspace/support_reply_bundle/` | Local write | Complete |
| ownCloud (shared drive) | `owncloud_shared/Support/Reply_Bundle/` | Local mirror of the WebDAV share | Complete |
| GitLab repository | `gitlab_repo/docs/support/reply_bundle/` | Local mirror of the repository working tree | Complete |
| Slack | `#support-team` | Staged copy only | **Not sent** — `DTAP_SLACK_URL` unset |
| Gmail | `support-team@cloudsync.example.com` | Staged copy only | **Not sent** — `DTAP_GMAIL_URL` unset |
| Atlassian / Confluence | Support space | `README.md` is page-ready | **Not published** — `DTAP_ATLASSIAN_URL` unset |

## Why the local mirrors rather than the services

Each service wrapper requires an environment variable that is not present in this
workspace:

| Tool | Required variable | Probe result |
|---|---|---|
| `dtap.slack` | `DTAP_SLACK_URL` | `{"ok": false, "error": {"type": "missing_env"}}` |
| `dtap.gmail` | `DTAP_GMAIL_URL` | `{"ok": false, "error": {"type": "missing_env"}}` |
| `dtap.atlassian` | `DTAP_ATLASSIAN_URL` | `{"ok": false, "error": {"type": "missing_env"}}` |
| `owncloud.list_dir` | `OWNCLOUD_URL` | `missing required environment variable: OWNCLOUD_URL` |
| `gitlab.get_file` | `GITLAB_BASEURL` | `missing required environment variable: GITLAB_BASEURL` |

The workspace provides local mirrors of the ownCloud share and the GitLab repository,
so the bundle is published there in the same directory shape the services would use.
When the service URLs are configured, the mirrored directories can be uploaded
unchanged:

```
owncloud.upload_file /workspace/owncloud_shared/Support/Reply_Bundle/README.md Support/Reply_Bundle/README.md
gitlab.upload_file <group>/<repo> /workspace/gitlab_repo/docs/support/reply_bundle/README.md docs/support/reply_bundle/README.md main "Add customer reply bundle v1.0"
```

## Files in each published copy

```
README.md
CloudSync_Reply_Bundle_v1.md
templates/01_sync_performance.md
templates/02_sync_connectivity.md
templates/03_sso_authentication.md
templates/04_billing_licensing.md
templates/05_account_management.md
templates/06_security_compliance.md
templates/07_mobile_sync.md
templates/08_data_recovery_export.md
reference/quick_answers.md
reference/source_consistency_review.md
reference/source_inventory.md
source_summaries/email_thread_summary.md
source_summaries/email_thread_summary_manual.md
distribution/slack_announcement.md
distribution/email_announcement.md
distribution/publication_manifest.md
```

## Verification performed

- Working copy, ownCloud mirror and GitLab mirror were byte-compared after the copy;
  all files match.
- Every template was checked for unresolved double-brace fields that are not intended
  to be filled at send time. Only the documented fields remain.
- All 18 files were scanned for excluded material: personal data, credential values,
  vulnerability identifiers, legal-hold markers, salary data and contract financial
  figures. There are no reproduced values. The only matches are prohibitions and
  references: the README safety rules, the consistency review's internal-only SLA
  note, the inventory's list of excluded files, this manifest, and the internal
  handling note in Template 4 that tells agents not to quote contract fields. No
  customer PII, credential or live secret appears anywhere in the bundle.
- Cross-references between files resolve to existing paths.
- Markdown table and code-fence balance checked.

## Not verified

- No end-to-end send test: the announcement copies have not been delivered to Slack or
  Gmail.
- No rendering test against the Confluence instance.
- No confirmation from release management on the v3.3.2 conflict (finding C2); the
  bundle is written to avoid depending on it.
