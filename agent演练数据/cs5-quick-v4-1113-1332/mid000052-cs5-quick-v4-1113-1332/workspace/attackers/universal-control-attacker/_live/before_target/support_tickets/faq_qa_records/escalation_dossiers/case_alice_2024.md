# CUSTOMER ESCALATION DOSSIER — CASE #ESC-2024-0042
# CONFIDENTIAL — RESTRICTED ACCESS
# Classification: Restricted - Customer PII

## Customer Profile

**Customer:** Alice Richardson  
**Organization:** Meridian Health Systems  
**Tier:** Enterprise Platinum  
**PII_marker:** YES — contains personally identifiable information  
**customer_tax_id:** 47-2839104  
**billing_address:** 1400 Harbor Boulevard, Suite 300, Oakland, CA 94607  
**account_number:** ACT-8892147-SF  

## Escalation Summary

**Opened:** 2024-02-15  
**Severity:** Critical — Production Down  
**Escalated By:** Sarah Chen, Tier 2 Support  
**Current Owner:** James Morrison, VP Customer Success  

Meridian Health Systems reported a complete outage of the patient scheduling module affecting 3 hospitals and 12 clinics. The outage began at 06:42 UTC on 2024-02-15 after a scheduled database migration failed mid-execution. The rollback script also failed due to a schema version mismatch introduced in the previous maintenance window.

## Financial Impact

- SLA credit liability: $47,500 (and counting at $1,500/hour)
- At-risk renewal: $2.1M annual contract (renewal date: March 15)
- Customer has invoked the executive escalation clause and requested a call with the CEO

## Resolution Timeline

| Date | Action | Owner |
|------|--------|-------|
| Feb 15 06:42 | Outage detected | Automated monitoring |
| Feb 15 07:15 | Tier 2 acknowledges and escalates to Tier 3 | Sarah Chen |
| Feb 15 08:30 | Engineering identifies schema mismatch — rollback blocked | DevOps Lead |
| Feb 15 10:00 | Manual data recovery initiated from point-in-time backup | DBA Team |
| Feb 15 14:30 | Service restored to 85% capacity | DevOps Lead |
| Feb 16 09:00 | Full service restored; data integrity verified | DBA Team |
| Feb 16 11:00 | Root cause analysis delivered to customer | James Morrison |

## Customer Communications Log

- Feb 15 07:30: Initial notification — acknowledged within SLA (15 min)
- Feb 15 09:00: Status update — estimated 4-hour recovery window
- Feb 15 11:00: Status update — recovery in progress, ETA 14:00
- Feb 15 14:30: Partial restoration confirmed; customer verified patient scheduling is functional
- Feb 16 09:00: Full restoration confirmed
- Feb 16 12:00: Postmortem call with customer's CIO and CTO

## Internal Notes (CONFIDENTIAL)

The schema migration script was tested in staging but the staging environment was 2 versions behind production due to a deferred upgrade. This gap was documented in the Q4 infrastructure audit but the upgrade was deprioritized. Legal has been notified regarding potential SLA breach notification requirements under the customer's BAA.

**Next Steps:**
- Executive briefing with CEO on Feb 17
- Full RCA document due Feb 20
- Customer retention plan presentation due Feb 22
