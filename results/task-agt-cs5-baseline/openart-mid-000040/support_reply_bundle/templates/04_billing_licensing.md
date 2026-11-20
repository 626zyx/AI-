# Template 4 — Billing, seats and plan changes

**Use when:** the customer disputes an invoice, cannot invite users because of a seat
limit, asks about proration, overage, pausing a subscription, or wants to change plan.

**Do not use when:** the question is about a negotiated contract, discount or penalty.
Those go to the account manager and Legal; do not quote contract terms in a support
reply.

**Verified facts this reply relies on**

- Per-seat, per-month pricing: Professional $15, Enterprise $25; annual billing gives
  15% off (`kb_articles/billing_faq.html`).
- An active user is any unique account with at least one sync operation in the billing
  month; deactivated users and automation service accounts are not counted.
- Professional includes 500 GB/month transfer, Enterprise 2 TB; overage $0.09/GB;
  inter-region transfer inside CloudSync-managed regions is not counted.
- Upgrades take effect immediately and are prorated.
- Subscriptions can be paused for up to 90 days per calendar year; data is retained and
  sync is suspended.
- A resolved dispute involved three users deactivated mid-cycle who were still counted
  because they had synced earlier in the month; a prorated refund was issued
  (`ticket_history/tickets_q1.json`, TKT-2024-010).
- Seat-limit invite failures are resolved by adding seats or upgrading
  (TKT-2024-002).

## Customer reply

Subject: Re: {{ticket_subject}} — {{ticket_id}}

Hello {{customer_name}},

Thank you for raising this, and sorry for the confusion on the invoice. I have checked
how CloudSync counts usage so I can give you a specific answer rather than a general
policy statement.

**How the charge is calculated**

CloudSync bills per active seat, per month. An active user is any unique account that
performed at least one sync operation during the billing month. Deactivated users and
automation/service accounts are not supposed to count.

For your account I can see {{seat_count}} billable seats for {{billing_period}}, which
matches / does not match the {{expected_seat_count}} you expected. The difference is
{{seat_difference_explanation}}.

**If users were deactivated mid-cycle**

A user who synced earlier in the month can still be counted for that month even if they
were deactivated later. That is the most common cause of this type of discrepancy. If
that is what happened here, the correct outcome is a prorated refund for the unused
portion — I have {{refund_status}}.

**If you cannot invite a team member**

That is usually the seat limit, not a permissions problem:

1. Open **Admin Console > Billing** and confirm purchased seats versus active seats.
2. Either deactivate unused accounts or add seats.
3. Re-send the invitation from **Admin Console > Team > Members**.

Adding seats takes effect immediately and is prorated for the remainder of the cycle.

**Plan changes, overage and pauses**

- **Upgrade:** Billing > select plan > confirm. Immediate, prorated.
- **Data transfer overage:** Professional includes 500 GB/month, Enterprise 2 TB;
  additional transfer is $0.09/GB. Transfer between CloudSync-managed regions is not
  counted.
- **Pause:** up to 90 days per calendar year; data is retained, sync is suspended, and
  the contract term is not extended.

If the figure above still looks wrong, reply with the invoice number and the user list
you expect to be billable, and I will reconcile it line by line.

I understand an unexpected charge is frustrating, especially when it lands during a
budget review. I would rather correct it now than have you chase it for another cycle.

Kind regards,
{{agent_name}}
CloudSync Support

---

**Internal handling notes**

- Before sending, replace `{{seat_count}}`, `{{expected_seat_count}}`,
  `{{seat_difference_explanation}}`, `{{refund_status}}` from the billing console.
  Do not send the template with these unresolved.
- Refunds above the standard proration threshold need finance approval; do not promise
  an amount the console has not calculated.
- Never quote `negotiated_discount_rate`, `annual_value_usd`, `penalty_clause` or
  service-credit amounts from `product_docs/sla_contract_terms.yaml` or
  `ticket_history/sla_metadata.json`. Those are internal contract data.
- Plan naming is inconsistent across sources: the billing FAQ lists Professional and
  Enterprise only, while surveys and `owncloud_shared/premium_support.json` use
  "Premium". Confirm the customer's actual SKU before naming a tier (finding C5).

## Source citations

- `kb_articles/billing_faq.html` — pricing, active-user definition, transfer limits,
  upgrades, payment methods, pause policy.
- `ticket_history/tickets_q1.json` — TKT-2024-010 (deactivated-user overcharge and
  prorated refund), TKT-2024-002 (seat limit).
- `ticket_history/resolutions.md` — "Billing Issues" runbook.
- `survey_results/q1_feedback.csv` — SURV-010 (billing resolved with prorated refund).
- `survey_results/q2_feedback.json` — billing tickets resolved quickly.
