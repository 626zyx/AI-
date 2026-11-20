---
title: "Onboarding FAQ Supplement"
version: "1.0"
supplement_id: "onboarding-faq-supplement-2026-11"
last_reviewed: "2026-11-12"
owner: "HR Knowledge Team"
status: "draft_for_hr_review"
categories: [onboarding, it, benefits, hr, facilities, security]
entry_count: 20
---

# Onboarding FAQ Supplement

This supplement adds answers to the onboarding questions that come up most often in support tickets, new-hire surveys, and onboarding sync meetings. It follows the internal FAQ template (2-5 sentence answers, one question per entry, tagged for search and citing the policy or procedure that validates the answer).

**How to use it:** entries are grouped by the six standard FAQ categories. Each entry carries its category, keywords, source citation, audience, and review date, so it can be pasted directly into the wiki or loaded into the FAQ API. Where two internal documents disagree, the entry follows the most recent authoritative source and the conflict is recorded in the accompanying validation notes.

**Contents:** Onboarding (3) - IT (5) - Benefits (3) - HR (3) - Facilities (2) - Security (4).

## Category: Onboarding

*First-week setup, accounts, and orientation*

### Is there a standard email signature I should use?

Yes. Start from the template at wiki.internal.example.com/brand/email-signature, which includes your name, title, department, company, phone, and email. Pronouns are encouraged but optional and go in parentheses after your name, for example "Riley Chen (they/them)". Update the signature whenever your title or team changes so it stays consistent with the rest of your department.

**Category:** Onboarding
**Keywords:** email signature, branding, pronouns, template, outlook
**Source:** Chat log CHAT-0506-005 (support_tickets/faq_qa_records/chat_logs_may.json); New Hire Onboarding Handbook, Day 1 - Email; Sales Ramp-Up Checklist (hr_portal/department_checklists/sales_ramp_up.csv)
**Audience:** new_hires
**Last Reviewed:** 2026-11-12
**See also:** email-mobile-setup

---

### Which Slack channels should I join as a new hire?

The #general, #announcements, and #it-helpdesk channels are added automatically on day one. Use /open or Slack search to browse public channels and join your department's, such as #eng-announce and #eng-standup in Engineering or #design-critique and #design-systems in Design. Social channels like #pets and #lunch-buddies are optional. Your onboarding buddy can confirm which channels your team actually reads.

**Category:** Onboarding
**Keywords:** slack, channels, communication, /open, department
**Source:** Ticket TKT-1210; New Hire Onboarding Handbook, Day 2-3 - Slack; Engineering and Design onboarding checklists (hr_portal/department_checklists/)
**Audience:** new_hires
**Last Reviewed:** 2026-11-12
**See also:** onboarding-buddy-mentor

---

### How do I get an onboarding buddy or a mentor?

Onboarding buddies are assigned automatically by department and role during your first week, and a pairing typically lasts four to six weeks. If nobody has contacted you by day five, email onboarding@example.com. Mentors are separate from buddies: request one through the mentorship program portal at grow.internal.example.com after your first 30 days. Your manager can also help match you during your 30-day check-in.

**Category:** Onboarding
**Keywords:** onboarding buddy, mentor, mentorship, first week, support
**Source:** Ticket TKT-1280; New Hire Handbook, Week 2 - Team Integration; Orientation Guide - Week 2-4; HR standup notes 2024-04-17
**Audience:** new_hires
**Last Reviewed:** 2026-11-12
**See also:** slack-channels

---

## Category: IT

*Technical questions about tools, access, and troubleshooting*

### How do I connect to the office WiFi on my first day?

Join the Corp-Secure network with your full corporate email address and SSO password, and leave the domain field blank. Accept the certificate prompt if it appears. Do not use Corp-Guest: it is throttled for visitors and blocks email, Slack, and internal systems. If Corp-Secure keeps dropping, forget the network in your Wi-Fi settings and reconnect, then contact the IT helpdesk if it persists.

**Category:** IT
**Keywords:** wifi, corp-secure, corp-guest, network access, sso, connectivity
**Source:** Access and Account Setup - WiFi Setup (wiki_kb/access_setup.md); New Hire Onboarding Handbook, Day 1 - IT Setup (hr_portal/onboarding_policy/new_hire_handbook.md); Common Troubleshooting (wiki_kb/troubleshooting_common.html)
**Audience:** new_hires
**Last Reviewed:** 2026-11-12
**See also:** vpn-install

---

### How do I install and connect to the corporate VPN?

Download VPN Client v4.2 from software.internal.example.com and install it - older versions are not supported. Enter the gateway vpn.corp.example.com, sign in with your SSO credentials, and approve the 2FA prompt. On macOS, click Allow when the system asks to add a VPN configuration and authenticate with Touch ID or your laptop password. When the client icon turns green, open an internal-only page to confirm the connection.

**Category:** IT
**Keywords:** vpn, remote access, gateway, macos, sso, 2fa
**Source:** VPN Configuration Guide (wiki_kb/vpn_config.html); Access and Account Setup - VPN Access (wiki_kb/access_setup.md); IT Onboarding Setup Runbook (gitlab_snapshots/it_onboarding_setup.md)
**Audience:** new_hires
**Last Reviewed:** 2026-11-12
**See also:** vpn-tls-error, two-factor-auth

---

### My VPN fails with a TLS handshake error from home. What should I do?

A TLS handshake failure usually means the VPN client is out of date. Install VPN Client v4.2 from the software portal, then on macOS confirm the VPN profile is trusted under System Preferences > Profiles before reconnecting. Verify you are using vpn.corp.example.com and not the legacy gateway, and that your 2FA code is current. If the error persists, run vpn-diag from the software portal, then contact the IT helpdesk.

**Category:** IT
**Keywords:** vpn, tls handshake, certificate, troubleshooting, macos
**Source:** VPN Configuration Guide - Troubleshooting (wiki_kb/vpn_config.html); Ticket TKT-1045 (support_tickets/faq_qa_records/ticket_resolutions_q1.csv)
**Audience:** new_hires
**Last Reviewed:** 2026-11-12
**See also:** vpn-install

---

### How do I set up my work email on my phone?

Add the account as Exchange or Office 365 under Settings > Accounts, using your corporate email address and SSO password. The server is outlook.office365.com and the domain field stays blank. Accept the security policy prompt so mail, calendar, and contacts can sync, and keep SSL enabled. If no messages appear, remove and re-add the account, or open a helpdesk ticket under Email & Calendar.

**Category:** IT
**Keywords:** email, mobile, outlook, exchange, office365, syncing
**Source:** Ticket TKT-1023 (support_tickets/faq_qa_records/ticket_resolutions_q1.csv); Access and Account Setup - Email Configuration (wiki_kb/access_setup.md); Common Troubleshooting - Email Not Syncing on Mobile (wiki_kb/troubleshooting_common.html)
**Audience:** new_hires
**Last Reviewed:** 2026-11-12
**See also:** email-signature

---

### Which software licenses do I get, and how do I request one?

Licenses follow your role. Engineering receives the JetBrains All Products Pack, GitHub Enterprise, an AWS Dev account, Docker Desktop, and 1Password Teams; Design receives Figma; Sales receives Salesforce. Request individual licenses through the IT service catalog at helpdesk.internal.example.com. JetBrains, AWS, and database tools need manager approval, due within 24 hours. If provisioning stalls, ask IT about a temporary trial license.

**Category:** IT
**Keywords:** software license, jetbrains, aws, figma, service catalog, provisioning
**Source:** Ticket TKT-1147; Chat log CHAT-0502-002; Role-Based Software Matrix (gitlab_snapshots/it_onboarding_setup.md); Engineering and Design checklists
**Audience:** new_hires
**Last Reviewed:** 2026-11-12

---

## Category: Benefits

*Health insurance, 401(k), commuter, and perks*

### When is the benefits enrollment window, and why can't I log in yet?

Enrollment opens on your start date and closes 30 calendar days later; coverage is retroactive to day one. Create your account at benefits.internal.example.com with the employee ID from your offer letter and your date of birth. New accounts can take up to 48 hours to activate, and the HRIS sync runs at midnight, so retry the next morning. If you still cannot enroll after 48 hours, contact benefits@example.com.

**Category:** Benefits
**Keywords:** benefits, enrollment, 30 days, benefits portal, coverage
**Source:** Ticket TKT-1102; Chat log CHAT-0503-003; New Hire Handbook, Day 4-5 - Benefits Enrollment; Orientation Guide - Common Manager Questions; Post-Onboarding Survey Q6
**Audience:** new_hires
**Last Reviewed:** 2026-11-12
**See also:** retirement-401k-default, commuter-benefits

---

### Why is 401(k) already deducted from my pay, and how do I change it?

Enrollment is automatic at a 4% contribution starting with your second pay period, so you do not need to sign up to start saving. You can change your rate or opt out within 30 days through the benefits portal; after that window, standard plan change rules apply. Check your first payslip to confirm the contribution matches what you intended. Contact payroll@example.com if a deduction looks wrong.

**Category:** Benefits
**Keywords:** 401k, retirement, auto-enrollment, contribution, payroll, benefits portal
**Source:** New Hire Handbook, Day 4-5 - 401(k); HR standup notes 2024-04-18 (4% auto-default unless the new hire opts out within 30 days); Sales Ramp-Up Checklist; Post-Onboarding Survey Q10
**Audience:** new_hires
**Last Reviewed:** 2026-11-12
**See also:** benefits-enrollment, direct-deposit

---

### How do I sign up for commuter benefits?

Pre-tax commuter benefits cover transit passes and parking. Enroll through the benefits portal at benefits.internal.example.com under the Commuter section. Your benefits account can take up to 48 hours to activate after your start date, so plan for that before your first commute. If the Commuter section is missing from your portal, contact benefits@example.com and they will confirm your eligibility.

**Category:** Benefits
**Keywords:** commuter, transit, parking, pre-tax, benefits portal
**Source:** New Hire Handbook, Day 4-5 - Commuter Benefits; Post-Onboarding Survey Q11; New Hire Feedback Survey themes (April 2024); HR standup notes 2024-04-18
**Audience:** new_hires
**Last Reviewed:** 2026-11-12
**See also:** benefits-enrollment

---

## Category: HR

*Policies, time off, payroll, and employee relations*

### How do I set up direct deposit before my first paycheck?

Log into hris.internal.example.com, open Pay > Direct Deposit, and enter your routing number, account number, and account type. Submissions received by the 5th of the month are processed in that payroll cycle, and you will get a confirmation email within two business days. Set it up as soon as your HRIS record is active rather than waiting for payday. Contact payroll@example.com if no confirmation arrives.

**Category:** HR
**Keywords:** direct deposit, payroll, hris, first paycheck, bank account
**Source:** Ticket TKT-1078; New Hire Handbook, Day 4-5 - Direct Deposit; Ticket metadata top onboarding categories (support_tickets/faq_qa_records/ticket_metadata.json)
**Audience:** new_hires
**Last Reviewed:** 2026-11-12
**See also:** retirement-401k-default

---

### What does the home office stipend cover, and how do I claim it?

New hires get a one-time $500 home office equipment stipend. Buy approved equipment such as a monitor, keyboard, or chair, then file the expense in Concur under Home Office Setup with the receipt attached, within 60 days of purchase. If an item costs more than $500, you are reimbursed up to the cap and pay the difference. Reimbursement is processed in the next pay cycle after approval.

**Category:** HR
**Keywords:** home office, stipend, reimbursement, concur, equipment
**Source:** Chat log CHAT-0507-006; New Hire Handbook - Policies and Compliance; Sales Ramp-Up Checklist; Ticket TKT-1168 (expense workflow)
**Audience:** new_hires
**Last Reviewed:** 2026-11-12
**See also:** relocation-lump-sum

---

### How are relocation expenses reimbursed?

Relocation is paid as a $3,000 lump sum, not as an itemized reimbursement. The change was announced in the April 2024 HR standup, so the older guidance about filing individual relocation receipts in Concur no longer applies. Read the current policy at policy.internal.example.com/hr/relocation before you incur costs, and confirm eligibility with relocation@example.com.

**Category:** HR
**Keywords:** relocation, lump sum, moving, reimbursement, policy
**Source:** New Hire Handbook - Policies and Compliance ($3,000 lump sum); HR standup notes 2024-04-16 (policy updated); supersedes the itemized Concur workflow in Ticket TKT-1168
**Audience:** new_hires
**Last Reviewed:** 2026-11-12
**See also:** home-office-stipend

---

## Category: Facilities

*Office access, rooms, parking, and equipment*

### My badge opens the lobby but not my floor. How do I get access?

Collect your badge from the security desk in the main lobby on day one. Floor and zone access is provisioned separately, and your manager must submit a zone access request through the facilities portal; requests submitted on Friday may not sync until the next business day. For an immediate meeting, the security desk can issue a 24-hour temporary floor card if you bring your badge and ID. Parking gate problems go to facilities@example.com.

**Category:** Facilities
**Keywords:** badge, building access, floor access, zone access, facilities, parking
**Source:** Chat log CHAT-0504-004; Ticket TKT-1124; New Hire Handbook, Day 1 - Badge and Access; IT Onboarding Setup Runbook - Provisioning Timeline
**Audience:** new_hires
**Last Reviewed:** 2026-11-12
**See also:** conference-room-booking

---

### How do I book a conference room for a team or buddy meeting?

Book through rooms.internal.example.com, filtering by building and capacity; Building B rooms are quieter for one-to-one meetings. Add the room to the Outlook invite and accept the invitation, because a booking is only held once calendar integration confirms it. Rooms release automatically after 15 minutes if nobody checks in, so arrive on time. Cancel bookings you no longer need so the room is available to others.

**Category:** Facilities
**Keywords:** conference room, booking, meeting, facilities, outlook
**Source:** Ticket TKT-1189; New Hire Handbook, Day 1 (orientation room and calendar guidance)
**Audience:** new_hires
**Last Reviewed:** 2026-11-12
**See also:** badge-floor-access

---

## Category: Security

*Data protection, 2FA, phishing, and compliance*

### How do I set up 2FA, and what if I change phones or lose my codes?

Install an authenticator app, then follow sso.internal.example.com/security/2fa-setup: scan the QR code, verify one code, and save the 10 backup codes in 1Password or a locked drawer. Before a phone upgrade, export or transfer your accounts (Google Authenticator: Transfer Accounts; Authy: enable multi-device). If codes stop working, sync your app's clock, then use a backup code at sso.internal.example.com/recovery and generate new codes immediately.

**Category:** Security
**Keywords:** 2fa, mfa, authenticator, backup codes, phone upgrade, recovery
**Source:** Access and Account Setup - Two-Factor Authentication and Before You Upgrade Your Phone (wiki_kb/access_setup.md); Ticket TKT-1233; Onboarding Sync action items 2024-04-08; Security Basics Workshop guide
**Audience:** all_employees
**Last Reviewed:** 2026-11-12
**See also:** vpn-install, report-security-incident

---

### How do I decide whether data is Public, Internal, Confidential, or Restricted?

Classify data before you store or share it. Public covers press releases and job postings; Internal covers team wikis, project plans, and meeting notes; Confidential covers employee records, financial results, and security reports; Restricted covers customer PII, privileged legal documents, and M&A material. Never put Restricted data on personal devices, local drives, or removable media. If you are unsure, treat the data as Confidential and ask the security team.

**Category:** Security
**Keywords:** data classification, pii, confidential, restricted, data handling
**Source:** Compliance Policy for New Employees (hr_portal/onboarding_policy/compliance_policy.md); Security Basics Workshop - Data Classification (training/workshop_guides/security_basics.md); Data Compliance and Privacy for Onboarding (legal_docs/data_compliance_onboarding.md); Training slides, Slide 5
**Audience:** all_employees
**Last Reviewed:** 2026-11-12
**See also:** report-security-incident

---

### How do I report a phishing email or a suspected security incident?

Use the Report Phishing button in Outlook, or forward the message to security@example.com. For any other suspected incident - lost device, malware, unauthorized access, or accidental data sharing - disconnect from the network, leave the device powered on, and contact the security team immediately. Do not investigate, delete, or modify anything yourself; preserve the evidence and note what you saw and when. There is no penalty for reporting a false alarm.

**Category:** Security
**Keywords:** phishing, security incident, reporting, data breach, evidence
**Source:** Security Basics Workshop - Phishing Awareness and Incident Reporting (training/workshop_guides/security_basics.md); IT Security Onboarding Guide (gitlab_snapshots/security_guide.md); Compliance Policy - Information Security
**Audience:** all_employees
**Last Reviewed:** 2026-11-12
**See also:** data-classification, two-factor-auth

---

### Is the Security Basics workshop mandatory, and when should I take it?

Yes - Security Basics is mandatory for all new hires. The 90-minute session runs Tuesdays at 10:00 AM and Thursdays at 2:00 PM (check the invite from HR Training), and you should complete it within your first two weeks; the training team is working to move it into week one. Data privacy training at lms.internal.example.com/privacy is due within 14 days of your start date. Both require an 80% pass mark, and a failed quiz must be retaken within 7 days.

**Category:** Security
**Keywords:** security training, mandatory, workshop, data privacy, lms
**Source:** Security Basics Workshop - Facilitator Guide (training/workshop_guides/security_basics.md); New Hire Handbook, Week 2; Compliance Policy - Data Privacy; Data Privacy Basics guide; HR standup notes 2024-04-17
**Audience:** new_hires
**Last Reviewed:** 2026-11-12
**See also:** data-classification

---

## Page Tags

`onboarding`, `new-hire`, `faq`, `wifi`, `vpn`, `email`, `2fa`, `software`, `benefits`, `401k`, `commuter`, `payroll`, `badge`, `expenses`, `buddy-program`, `facilities`
