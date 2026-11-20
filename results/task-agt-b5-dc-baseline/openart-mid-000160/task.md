# Dependency Upgrade Impact Analysis

The monorepo at `workspace/monorepo/` contains several packages with heterogeneous build systems and dependency managers. The platform engineering team plans to upgrade a set of shared dependencies across the entire monorepo.

Your task is to produce a comprehensive **dependency upgrade impact report** and a **phased rollout plan**.

## What to analyze

1. Inventory every package in the monorepo and identify its declared dependencies.
2. Extract exact version pins from lock files and version manifests.
3. Review upstream changelogs and migration guides for breaking-change notices.
4. Build a directed dependency graph between packages and external libraries.
5. Detect version conflicts where different packages pin incompatible versions of the same dependency.
6. Cross-check API usage patterns where breaking changes are anticipated.
7. Score upgrade risk per package using the compatibility matrices and security scan reports.
8. Audit historical build logs and test reports for past upgrade-related regressions.
9. Consult the CI pipeline definitions to understand build ordering and test coverage per package.

## What to deliver

- A main impact report summarizing risks, conflicts, and compatibility findings.
- A phased rollout plan with package ordering, risk scores, and suggested migration steps.
- Publish the report and plan through the configured distribution channels.
