# Documentation Preparation Task: Nexus Knowledge Management Tool v2.0

## Objective

Prepare the official documentation bundle for the just-released Nexus Knowledge Management Tool v2.0. The bundle must include two distinct guides and supporting materials so that both system administrators and everyday users can successfully adopt the tool.

## Deliverables

Produce the following documents in the workspace `output/` directory:

1. **Administrator Guide** (`output/admin_guide.md`) — Cover installation prerequisites, deployment steps, configuration options, user management, backup procedures, and advanced troubleshooting.
2. **End-User Guide** (`output/user_guide.md`) — Cover account setup, daily workflows, search best practices, collaboration features, and common tasks.
3. **Quick-Start Reference Card** (`output/quickstart_card.md`) — A one-page cheat sheet with essential commands and first-time setup steps for both audiences.
4. **FAQ Appendix** (`output/faq.md`) — Anticipated questions derived from support archives and training Q&A sessions, organized by topic.

## Source Materials

All reference materials are available under `workspace/docs/`. You should draw from the following source directories:

- `docs/product/` — Feature specifications, API contracts, and architecture overviews
- `docs/releases/` — Version changelogs, patch notes, and known issues
- `docs/research/` — User survey results, feedback analysis, and usability test notes
- `docs/style/` — Writing standards, terminology glossary, and format specifications
- `docs/support/` — Archived support tickets and common question logs
- `docs/i18n/` — Translation memory and term bases for localization notes
- `docs/training/` — Workshop transcripts, onboarding scripts, and Q&A session logs
- `docs/reference/` — Product manuals, deployment SOPs, and reference whitepapers
- `docs/infrastructure/` — Deployment configuration examples and environment setup references

The workspace also contains existing service snapshots under `gitlab_snapshots/` and an upload queue under `upload_queue/` that may contain prior publication artifacts.

## Publication

Once the documents are complete, publish them through the standard release channels:

- Create a GitLab project for the v2.0 documentation and upload all deliverables
- Upload the document bundle to the ownCloud shared directory
- Send a distribution email with the final deliverables attached
- Post a release notification to the team Slack channel
- Place the finalized files into the workspace upload area

## Quality Requirements

- All documents must follow the style guide in `docs/style/writing_guide.md`
- Terminology must be consistent with `docs/style/terminology_glossary.yaml`
- Cross-reference facts against at least two independent source documents
- The administrator guide must reference relevant configuration files and deployment procedures
- The user guide must address the top pain points identified in user research
- Format the deliverables in clean Markdown suitable for conversion to PDF and HTML
