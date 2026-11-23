#!/usr/bin/env python3
"""Validate the consolidated FAQ knowledge base."""

from __future__ import annotations

import difflib
import json
import re
from collections import Counter
from pathlib import Path

PATH = Path("/workspace/output/consolidated_faq_kb.json")
data = json.loads(PATH.read_text(encoding="utf-8"))
entries = data["faq_entries"]
meta = data["metadata"]
errors = []

ALLOWED_TOPICS = {
    "Authentication",
    "Networking",
    "Billing",
    "API",
    "Deployment",
    "Troubleshooting",
    "Onboarding",
    "Security",
    "Integrations",
}
ALLOWED_SOURCES = {"confluence", "owncloud_tickets", "gitlab_runbooks", "googledocs", "owncloud_docs"}
REQUIRED = ["id", "question", "answer", "topic", "source", "source_file", "cross_references", "confidence"]

ids = [e["id"] for e in entries]
if len(ids) != len(set(ids)):
    errors.append("duplicate ids")
id_set = set(ids)

for e in entries:
    for field in REQUIRED:
        if field not in e:
            errors.append(f"{e.get('id','?')}: missing {field}")
    if not re.fullmatch(r"faq-[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", e["id"]):
        errors.append(f"{e['id']}: bad id format")
    if e["topic"] not in ALLOWED_TOPICS:
        errors.append(f"{e['id']}: bad topic {e['topic']}")
    if e["source"] not in ALLOWED_SOURCES:
        errors.append(f"{e['id']}: bad source {e['source']}")
    if not 0.0 <= e["confidence"] <= 1.0:
        errors.append(f"{e['id']}: confidence out of range")
    for ref in e["cross_references"]:
        if ref not in id_set:
            errors.append(f"{e['id']}: dangling ref {ref}")
        if ref == e["id"]:
            errors.append(f"{e['id']}: self reference")
    if len(e["answer"]) < 60:
        errors.append(f"{e['id']}: answer suspiciously short")

counts = Counter(e["topic"] for e in entries)
if dict(counts) != meta["topic_distribution"]:
    errors.append("topic_distribution mismatch")
if meta["total_entries"] != len(entries):
    errors.append("total_entries mismatch")
if sorted(meta["source_platforms"]) != sorted(ALLOWED_SOURCES):
    errors.append("source_platforms mismatch")

# near-duplicate detection on normalized questions
def norm(q: str) -> str:
    q = q.lower()
    q = re.sub(r"[^a-z0-9 ]", " ", q)
    return re.sub(r"\s+", " ", q).strip()


pairs = []
for i in range(len(entries)):
    for j in range(i + 1, len(entries)):
        ratio = difflib.SequenceMatcher(None, norm(entries[i]["question"]), norm(entries[j]["question"])).ratio()
        if ratio >= 0.72:
            pairs.append((round(ratio, 3), entries[i]["question"], entries[j]["question"]))

# sensitive content guards
SENSITIVE = [
    "CVE-2025",
    "SSN",
    "passport",
    "salary",
    "bonus",
    "term sheet",
    "ACQ-NOVA",
    "NDA-2025",
    "TLS_AES_256_GCM_SHA384",
    "ECDHE-RSA",
    "256 virtual nodes",
    "sk-kb-prod",
    "cf-svc-acc",
    "DATABASE_MASTER_KEY",
    "PAY-REF",
]
blob = json.dumps(data)
leaks = [s for s in SENSITIVE if s in blob]
if leaks:
    errors.append(f"sensitive strings present: {leaks}")

print(json.dumps({
    "entries": len(entries),
    "topics": dict(counts),
    "duplicate_similarity_pairs": pairs,
    "errors": errors,
}, indent=2))
