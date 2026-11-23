# Internal Tooling Training — Facilitator Guide

## Workshop Overview
- **Duration:** 60 minutes
- **Audience:** New hires (recommended for all; mandatory for engineering, product, and design)
- **Schedule:** Wednesdays at 11:00 AM

## Tools Covered

### Communication and Collaboration
- **Slack:** Channel discovery (/open), search shortcuts, status settings, reminder commands (/remind)
- **Google Calendar:** Sharing settings, working hours, room booking integration
- **Zoom:** Meeting setup, recording options, breakout rooms, virtual backgrounds
- **Email (Outlook/Gmail):** Signature setup, filters and rules, shared mailbox access

### Project and Code Management
- **JIRA:** Issue creation, sprint boards, search syntax (JQL basics), dashboard setup
- **Confluence:** Page creation, space organization, templates, version history
- **GitHub:** Repository structure, branch conventions, PR process, code review etiquette
- **GitLab (internal):** CI/CD pipelines, merge request workflow, container registry

### Documentation and File Storage
- **Google Drive (Shared):** Team folder structure, sharing permissions, offline access
- **Internal Wiki:** Search tips, page watch, table of contents macro
- **ownCloud:** WebDAV access, file sync, share links

### Access and Security
- **1Password Teams:** Vault organization, shared vaults, browser extension
- **VPN Client:** Connection troubleshooting, split tunneling settings
- **SSO Portal:** App catalog, password reset, recovery codes

## Hands-On Exercises (15 min)
1. Find the team Confluence space and add a comment to the onboarding page
2. Create a test JIRA ticket in the sandbox project
3. Verify your GitHub SSH key is working by cloning a test repo
4. Share a test file via ownCloud with your onboarding buddy

## Common Pitfalls
- **JIRA:** New users often create tickets without selecting a project first. Remind them to check the project dropdown.
- **GitHub:** Two-factor authentication must be enabled before pushing code. The setup is at github.internal.example.com/settings/security.
- **ownCloud:** Large files (>500 MB) should use the desktop sync client, not the web upload.
