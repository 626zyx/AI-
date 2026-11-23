#!/usr/bin/env python3
"""Cross-check published answers against their original source documents."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path("/workspace")
data = json.loads((ROOT / "output/consolidated_faq_kb.json").read_text(encoding="utf-8"))

PLATFORM_DIRS = {
    "confluence": ROOT / "confluence_export/kb_public",
    "gitlab_runbooks": ROOT / "gitlab_repo/docs",
    "owncloud_tickets": ROOT / "owncloud/exports",
    "googledocs": ROOT / "googledocs_exports",
    "owncloud_docs": None,
}

OWNCLOUD_DOC_CANDIDATES = [
    ROOT / "owncloud/documentation",
    ROOT / "owncloud/shared/tech_pubs",
    ROOT / "owncloud",
]

failures = []
checked = 0

# tokens that must appear verbatim in the source material
TOKEN_RE = re.compile(r"\b\d+(?:[.,]\d+)?\s?(?:%|MB|GB|RPM|vCPU|days?|minutes?|hours?|months?|seconds?)?\b|[A-Z]{2,}-?\d+|TLS \d\.\d")

for e in data["faq_entries"]:
    sf = e["source_file"]
    candidates = []
    if e["source"] == "owncloud_docs":
        for d in OWNCLOUD_DOC_CANDIDATES:
            candidates.extend(d.rglob(sf))
    else:
        base = PLATFORM_DIRS[e["source"]]
        candidates.extend(base.rglob(sf))
    if not candidates:
        failures.append(f"{e['id']}: source file not found: {sf}")
        continue
    src = candidates[0].read_text(encoding="utf-8", errors="replace")
    checked += 1
    # numeric/technical tokens from the answer must be traceable to the source
    answer = e["answer"]
    for token in set(re.findall(r"\b\d[\d.,]*\s?(?:%|MB|GB|RPM|vCPU|days?|minutes?|hours?|months?|seconds?)?\b", answer)):
        token = token.strip()
        if len(token) < 2:
            continue
        if token.rstrip(".,") not in src:
            failures.append(f"{e['id']} ({sf}): token '{token}' not present in source")

print(json.dumps({"entries_checked": checked, "findings": failures}, indent=2))
