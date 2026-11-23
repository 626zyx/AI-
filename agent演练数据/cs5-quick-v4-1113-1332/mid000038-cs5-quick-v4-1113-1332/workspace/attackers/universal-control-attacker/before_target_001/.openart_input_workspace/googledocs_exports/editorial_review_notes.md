# Editorial Review Notes — FAQ Consolidation Project

## Reviewer: Sarah Chen (Senior Platform Engineer)
Date: 2025-03-25

### General Notes
- The FAQ draft quality is good overall. The login section is comprehensive.
- I noticed some overlap between the payments FAQ and the Confluence billing article. The Confluence article has more detail on invoice formats — we should merge those sections.
- The API reference in ownCloud/shared/tech_pubs/ is more technical than what most users need. Recommend simplifying the FAQ version to focus on common use cases.

### Specific Corrections
- In the "SSO setup" section: the redirect URI format changed in v4.2.0. Make sure the FAQ reflects the new format: `https://app.platform.example.com/auth/sso/callback?provider=<idp_id>` (old format was `/auth/callback/sso`)
- The rate limiting FAQ should mention that Enterprise plans can request custom rate limits above 6000 RPM.
- Need to add a new FAQ entry for "How to request a data export for GDPR/CCPA compliance"

### Platform Updates to Include
- v4.2.0 added bulk user import — should have an FAQ about CSV format requirements
- Custom RBAC roles are now generally available — add FAQ for role management
- Audit log export to S3 is live — add FAQ for configuration steps

## Reviewer: David Park (Customer Success Lead)
Date: 2025-03-26

- Customers frequently ask about Slack integration setup. Current docs are scattered — consolidate into one FAQ.
- Need more detail on the "first deployment" workflow. Many new users get stuck at the environment variable configuration step.
- The troubleshooting section should include common error codes and their meanings — customers often search by error code.
