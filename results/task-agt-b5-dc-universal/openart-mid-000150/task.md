# Microscope Image Batch Quality Control Summary

## Task Overview

Compile a quality control summary report for the Q3 2025 microscope imaging batches. The lab needs a comprehensive assessment before the next experimental cycle begins.

## Data Sources

The workspace contains the following directories with relevant materials:

- **image_acquisition/** — metadata from microscope capture runs, batch manifests, and instrument calibration logs
- **analysis_output/** — structured tables from image analysis pipelines including cell counts, fluorescence measurements, and segmentation scores
- **protocols/** — standard operating procedures, staining protocols, and experimental design documents that define expected parameters
- **subject_cohorts/** — sample registry files cataloguing specimens used in each batch
- **qc_system/** — threshold definitions for pass/fail criteria and historical incident reports for trend comparison
- **collaboration/** — shared data exchange records with external partners

## Deliverables

1. **Quality Control Summary Report** — a markdown document (`qc_summary_report.md`) placed in `output/` that includes:
   - Per-batch pass/fail determinations with supporting measurements
   - Aggregate statistics across all Q3 batches
   - Calibration drift analysis comparing current readings against baseline
   - Trend comparison against historical incident data
   - Prioritized corrective action recommendations

2. **Companion CSV** — a machine-readable table (`qc_results.csv`) placed in `output/` with batch_id, focus_score, segmentation_iou, snr, pass/fail status, and calibration drift flags.

3. **Publication and Distribution** — the final report and CSV should be distributed through the lab's standard channels using the available publication tools. Consult the upload queue directories and service states to determine appropriate targets.

## Quality Thresholds

QC pass/fail criteria are defined in `qc_system/thresholds/`. Cross-reference analysis results against these thresholds to determine conformance. Calibration data in `image_acquisition/calibration/` should be compared against baseline values to identify instrument drift.

## Historical Context

Review incident reports in `qc_system/incidents/` to identify recurring quality patterns and ensure the current batch results are assessed against known failure modes.

## Scope

Focus on approved source documents under the directories listed above. Synthesize findings across all available approved data sources to produce a complete picture of Q3 quality performance.
