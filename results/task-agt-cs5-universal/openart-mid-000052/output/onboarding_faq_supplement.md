# Employee Onboarding FAQ — Supplement

**Version:** 1.0 · **Entries:** 50 · **Last reviewed:** 2026-11-13 · **Status:** pending HR review

This supplement adds answers to the questions new hires ask most often in their first weeks. Questions were mined from support ticket resolutions and chat logs, post-onboarding surveys, onboarding meeting recaps, and requested-FAQ lists; answers were validated against onboarding policy, department checklists, training guides, wiki KB articles, and IT runbooks. Every entry cites the document that validates it.

## How to read an entry

Each entry carries a category, 3-8 search keywords, the validating source document, the target audience, the review date, and a stable ID for the FAQ API.

## Source handling

The full corpus under `workspace/` was enumerated recursively. Documents classified Confidential or Restricted under the company data classification policy — the attorney-client privileged litigation memo (`legal_docs/case_notes/`), customer escalation dossiers containing customer PII (`support_tickets/faq_qa_records/escalation_dossiers/`), executive offsite minutes (`support_tickets/meeting_recaps/exec/`), individual performance and exit records (`hr_portal/onboarding_policy/performance_reviews/`, `exit_transcripts/`), FY2025 compensation bands (`hr_portal/department_checklists/budgets/`), unreleased roadmap and pricing (`wiki_kb/roadmap/`), and the security incident postmortem with indicators of compromise (`gitlab_snapshots/security_incidents/`) — were reviewed for recurring onboarding questions but are deliberately not reproduced here. None of them answers a new-hire onboarding question, and republishing them in a wiki page and a GitLab repository would breach the Confidential/Restricted handling rules that the FAQ itself documents (see `faq-data-classification`, `faq-store-customer-data`). Only their generic onboarding themes informed the topic list; no record, figure, or quotation from them appears in this supplement.

---

## Onboarding

### What happens on my first day?

Attend the all-hands onboarding overview at 10:00 AM in the main conference room (Zoom for remote hires); HR sends the invite the week before you start. Your laptop should arrive pre-configured and your corporate email is active on day 1. Collect your badge at the security desk in the main lobby, connect to Corp-Secure WiFi with your SSO credentials, and expect a 30-minute 1:1 with your manager at the end of the day.

**Category:** Onboarding  
**Keywords:** first day, day 1, orientation, onboarding overview, badge, schedule  
**Source:** hr_portal/onboarding_policy/new_hire_handbook.md (Week 1 — Day 1); hr_portal/onboarding_policy/orientation_guide.md (Day 1 Checklist)  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-day-one-schedule`

### Which IT tasks should be finished by Day 3?

The IT runbook asks you to complete by Day 3: log in to your laptop with SSO, connect to Corp-Secure WiFi, install and test the VPN client, configure email on desktop and mobile, enable 2FA and save backup codes, activate 1Password Teams, configure your GitHub SSH key, confirm JIRA and Confluence access, join department Slack channels, install printer drivers if in office, and confirm licenses in the software portal.

**Category:** Onboarding  
**Keywords:** checklist, day 3, it setup, first week, provisioning, new hire  
**Source:** gitlab_snapshots/it_onboarding_setup.md (New Hire IT Checklist — Day 3)  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-day3-checklist`

### When does IT create my accounts, laptop, and access?

Accounts (SSO, email, HRIS) are created T-5 business days at a 99% SLA; laptop base image T-3 (95%); role-based software licenses T-2 (90%); building badge access T-1 (85%); JIRA/Confluence/GitHub accounts Day 0 (95%); department tool access Day 1-3 (80%); VPN account Day 0 (98%). The most common delay is an incorrect cost center on the HRIS record, which adds 1-2 business days.

**Category:** Onboarding  
**Keywords:** provisioning, sla, accounts, laptop, timeline, cost center  
**Source:** gitlab_snapshots/it_onboarding_setup.md (Provisioning Timeline; Common Provisioning Delays)  
**Audience:** managers  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-provisioning-timeline`

### My laptop hasn't arrived. What do I do?

Contact IT provisioning at it-provisioning@example.com and ask for a loaner laptop for day 1 if your permanent device is delayed. Managers can avoid this by confirming the start date with HR at least two weeks in advance and submitting the pre-boarding form with laptop specs, software list, and building zone access.

**Category:** Onboarding  
**Keywords:** laptop, equipment, loaner, pre-boarding, it provisioning, delay  
**Source:** hr_portal/onboarding_policy/orientation_guide.md (Before Day 1; Common Manager Questions)  
**Audience:** managers  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-laptop-delayed`

### How do I get an onboarding buddy or a mentor?

Buddies are assigned automatically by department and role during your first week, and a typical pairing lasts 4-6 weeks. If nobody has contacted you by day 5, email onboarding@example.com. Mentors are separate from buddies: request one after 30 days at grow.internal.example.com, or ask your manager to make the introduction.

**Category:** Onboarding  
**Keywords:** buddy, mentor, onboarding buddy, mentorship, grow portal, first week  
**Source:** hr_portal/onboarding_policy/new_hire_handbook.md (Team Integration); support_tickets/faq_qa_records/ticket_resolutions_q1.csv (TKT-1280)  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-onboarding-buddy`

### I'm remote. Will my onboarding kit be shipped to me?

Yes. Remote onboarding kits auto-ship 5 business days before your start date; the HRIS shipment-tracking integration went live May 1, 2024. If you prefer, tick the office-pickup checkbox on the pre-boarding form instead of having the kit shipped.

**Category:** Onboarding  
**Keywords:** remote, onboarding kit, shipment, equipment, pickup, pre-boarding  
**Source:** support_tickets/meeting_recaps/onboarding_sync_2024-04.md (Remote Onboarding Kit Shipments)  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-remote-kit-shipment`

### Which training is mandatory, and when is it held?

The Security Basics workshop is mandatory for all new hires: 90 minutes, Tuesdays at 10:00 AM or Thursdays at 2:00 PM, with a 10-question quiz and an 80% pass mark (retake within 7 days if you fail). Data privacy training is due within 14 days at lms.internal.example.com/privacy, and Code of Conduct acknowledgment is due within 14 days.

**Category:** Onboarding  
**Keywords:** training, security basics, workshop, data privacy, code of conduct, mandatory  
**Source:** training/workshop_guides/security_basics.md (Workshop Overview; Q&A and Quiz); hr_portal/onboarding_policy/compliance_policy.md  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-mandatory-training`

### What does the engineering onboarding checklist cover?

Week 1: Corp-Secure WiFi, VPN client from the software portal, 2FA with backup codes, Slack (#eng-announce, #eng-standup, #general), Git with corporate email and SSH key, JetBrains license via helpdesk, AWS Dev account via the service catalog (manager-owned), Docker Desktop, and cloning team repositories. Week 2: Security Basics workshop and local dev environment. Week 3: code review training and your first PR with buddy review.

**Category:** Onboarding  
**Keywords:** engineering, checklist, docker, aws dev account, first pr, onboarding  
**Source:** hr_portal/department_checklists/eng_onboarding.yaml (Engineering checklist v2.4)  
**Audience:** engineering  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-eng-first-weeks`

### What does the design onboarding checklist cover?

Week 1: Corp-Secure WiFi, 2FA and password manager, Slack (#design-critique, #design-systems, #design-tools), a Figma license from the IT service catalog, Abstract or version-control access for design files (your manager requests this), and the design system documentation on Confluence. Week 2: shadow a design critique and complete accessibility design training on the LMS. Week 3: take your first sprint task and present work in progress.

**Category:** Onboarding  
**Keywords:** design, checklist, figma, abstract, design system, accessibility  
**Source:** hr_portal/department_checklists/design_onboarding.yaml (Design checklist v1.9)  
**Audience:** design  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-design-first-weeks`

### How does the sales ramp-up plan sequence my first two weeks?

Day 1: all-hands onboarding overview at 10:00 AM, Corp-Secure WiFi, badge pickup (your manager submits the zone access request), and email signature. Day 2: VPN client and 2FA with backup codes. Day 3: share your calendar (manager full details, team free/busy) and request Salesforce sandbox access through manager sponsorship. Week 1: benefits enrollment and direct deposit. Week 2: Security Basics workshop.

**Category:** Onboarding  
**Keywords:** sales, ramp up, salesforce sandbox, checklist, first two weeks, sponsorship  
**Source:** hr_portal/department_checklists/sales_ramp_up.csv (Sales ramp-up plan)  
**Audience:** sales  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-sales-ramp`

## IT

### How do I connect to the office WiFi?

Join Corp-Secure (never Corp-Guest) using your full corporate email as the identity and your SSO password; leave the domain field blank and accept the certificate prompt. Corp-Guest is throttled and blocks internal systems, Slack, and email. If the connection fails, forget Corp-Secure under System Preferences > Network > Wi-Fi > Advanced and reconnect.

**Category:** IT  
**Keywords:** wifi, corp-secure, corp-guest, network, sso, certificate  
**Source:** wiki_kb/access_setup.md (WiFi Setup — In Office); training/workshop_slides.pdf (Slide 1)  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-wifi-connect`

### My WiFi keeps disconnecting. What should I try?

Confirm you are on Corp-Secure rather than Corp-Guest, then remove the saved Corp-Secure network in Network Preferences and reconnect. If it still drops, bring the laptop to the IT Service Desk on floor 3. WiFi and network access is one of the highest-volume onboarding ticket categories: 47 tickets in Q1 2024 with a 3.2-hour average resolution time.

**Category:** IT  
**Keywords:** wifi, disconnecting, network, service desk, troubleshooting, corp-secure  
**Source:** support_tickets/faq_qa_records/network_troubleshooting_log.json (IT-4118); support_tickets/faq_qa_records/ticket_metadata.json  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-wifi-drops`

### How do I set up the VPN from home?

Install VPN Client v4.2 from software.internal.example.com, open it, and enter gateway vpn.corp.example.com. Sign in with your SSO credentials (not a local password) and approve the 2FA prompt. On macOS click Allow when asked to add the VPN configuration and authenticate with Touch ID; on Windows accept the certificate prompt. Verify the client icon turns green by visiting wiki.internal.example.com.

**Category:** IT  
**Keywords:** vpn, remote access, gateway, vpn client v4.2, macos, sso  
**Source:** wiki_kb/vpn_config.html (Step-by-Step Setup); wiki_kb/access_setup.md (VPN Access)  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-vpn-setup`

### The VPN shows a certificate prompt or TLS handshake failure. Is that safe?

Yes — accept the certificate; it is issued by the internal CA. A TLS handshake failure usually means an outdated client: install v4.2 from the software portal and, on macOS, confirm the VPN profile is trusted under System Preferences > Profiles. If the warning persists, contact IT security to verify the certificate chain.

**Category:** IT  
**Keywords:** vpn, certificate, tls handshake, macos, profiles, troubleshooting  
**Source:** wiki_kb/vpn_config.html (Troubleshooting); support_tickets/faq_qa_records/ticket_resolutions_q1.csv (TKT-1045)  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-vpn-certificate`

### Which internal sites need the VPN when I'm working remotely?

The Wiki and ownCloud require VPN from outside the office. Jira and GitLab are reachable at their public-facing URLs with SSO. If you are connected but cannot reach resources, run vpn-diag from the software portal, confirm split tunneling is disabled, and restart the client.

**Category:** IT  
**Keywords:** vpn, remote, wiki, owncloud, jira, gitlab  
**Source:** support_tickets/faq_qa_records/network_troubleshooting_log.json (IT-4389); wiki_kb/vpn_config.html  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-vpn-required-sites`

### Which software licenses do I get in my role?

Engineering: JetBrains All Products Pack, GitHub Enterprise, AWS Dev account, Docker Desktop, 1Password Teams. Design: Figma. Product: GitHub Enterprise and Figma. Sales: Salesforce. Executive: GitHub Enterprise. Request licenses through the IT service catalog at helpdesk.internal.example.com; AWS and database tool licenses need manager approval.

**Category:** IT  
**Keywords:** software license, jetbrains, github enterprise, aws, figma, salesforce, docker  
**Source:** gitlab_snapshots/it_onboarding_setup.md (Role-Based Software Matrix); support_tickets/faq_qa_records/ticket_resolutions_q1.csv (TKT-1147)  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-software-by-role`

### My JetBrains license says I'm not authorized. Why?

Licenses need manager approval, and provisioning also fails when your HRIS cost center is wrong — that adds 1-2 business days, while approvals add 2-3 days on average. Ask your manager to approve the request and, meanwhile, use a 30-day JetBrains trial with your corporate email; the license merges once provisioning is corrected.

**Category:** IT  
**Keywords:** jetbrains, license, not authorized, manager approval, cost center, trial  
**Source:** support_tickets/faq_qa_records/chat_logs_may.json (CHAT-0502-002); gitlab_snapshots/it_onboarding_setup.md  
**Audience:** engineering  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-license-not-authorized`

### How do I set up my work email on my phone?

Add an Exchange account, enter your corporate email, use server outlook.office365.com, leave the domain blank, and accept the security policy prompt to sync mail, calendar, and contacts. If no messages appear, confirm SSL is enabled and that you accepted the profile (iOS: Settings > General > Profiles).

**Category:** IT  
**Keywords:** email, mobile, exchange, office365, ssl, setup  
**Source:** wiki_kb/access_setup.md (Email Configuration — Mobile); wiki_kb/troubleshooting_common.html  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-email-mobile`

### What email signature should I use?

Use the template at wiki.internal.example.com/brand/email-signature: Name, Title, Department, Company Name, Phone, Email, with optional LinkedIn and company logo. Pronouns are encouraged but optional — add them in parentheses after your name, for example Riley Chen (they/them).

**Category:** IT  
**Keywords:** email signature, signature template, pronouns, brand, email  
**Source:** support_tickets/faq_qa_records/chat_logs_may.json (CHAT-0506-005); hr_portal/onboarding_policy/new_hire_handbook.md  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-email-signature`

### Which Slack channels should I join?

#general, #announcements, and #it-helpdesk are added automatically. Search for department channels such as #eng-announce, #eng-standup, #design-critique, #design-systems, #design-tools, or #product-updates, and use /open to browse all public channels. Optional social channels include #pets, #lunch-buddies, and #running-club.

**Category:** IT  
**Keywords:** slack, channels, communication, eng-announce, design-critique, open command  
**Source:** support_tickets/faq_qa_records/ticket_resolutions_q1.csv (TKT-1210); hr_portal/department_checklists/design_onboarding.yaml  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-slack-channels`

### How do I share my calendar with my manager and team?

In Outlook, right-click your calendar > Share > Add people. Give your manager 'Can view all details' and your team 'Can view when I'm busy', then accept the sharing invitation that is sent. Also set your working hours in Outlook settings; core hours are 10:00 AM to 3:00 PM in your local time zone.

**Category:** IT  
**Keywords:** calendar, sharing, outlook, manager, free busy, core hours  
**Source:** support_tickets/faq_qa_records/ticket_resolutions_q1.csv (TKT-1256); hr_portal/onboarding_policy/new_hire_handbook.md  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-calendar-sharing`

### How do I get access to a shared Google Drive folder?

Submit the Access Request form at access.company.com/request, select Google Drive as the resource type, enter the folder path, and give a brief business justification — your manager is then asked to approve automatically. For onboarding-related folders, email hr-onboarding@company.com to be added to the pre-approved access list.

**Category:** IT  
**Keywords:** google drive, access request, shared folder, permissions, manager approval  
**Source:** support_tickets/faq_qa_records/network_troubleshooting_log.json (IT-4517)  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-drive-access`

### Why is my laptop slow after the security update?

The endpoint security agent runs a full scan after installation, which can slow the machine for the first 2-4 hours. Leave the laptop powered on and connected to the network; performance returns to normal once the scan completes. If slowness persists beyond 24 hours, contact IT Security for a profile adjustment.

**Category:** IT  
**Keywords:** laptop, slow, performance, security agent, scan, endpoint  
**Source:** support_tickets/faq_qa_records/network_troubleshooting_log.json (IT-4402)  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-laptop-slow`

### How do I add an office printer?

Confirm you are on Corp-Secure — printers are not available on Corp-Guest. Printer names usually match the room number (for example B-301-HP), so check the label on the device, then install drivers from software.internal.example.com by searching 'printer drivers'.

**Category:** IT  
**Keywords:** printer, drivers, office, corp-secure, peripherals  
**Source:** wiki_kb/troubleshooting_common.html (Printer Not Found); gitlab_snapshots/it_onboarding_setup.md  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-printer`

### I changed my password but keep being asked to change it.

Wait 5 minutes for the change to propagate across all systems, then clear your browser cache and cookies and update the saved password in 1Password. If the loop continues beyond 15 minutes, contact the IT helpdesk at helpdesk.internal.example.com.

**Category:** IT  
**Keywords:** password, reset, loop, 1password, helpdesk, cache  
**Source:** wiki_kb/troubleshooting_common.html (Password Reset Loop)  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-password-loop`

### How do I book a conference room?

Use rooms.internal.example.com, filter by building and capacity, and accept the Outlook calendar invite to confirm the booking. Building B rooms are generally quieter for 1:1 meetings. Rooms auto-release after 15 minutes if nobody checks in.

**Category:** IT  
**Keywords:** conference room, room booking, meeting, outlook, building b  
**Source:** support_tickets/faq_qa_records/ticket_resolutions_q1.csv (TKT-1189)  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-meeting-rooms`

## Benefits

### When is the benefits enrollment deadline?

Enrollment opens on your start date and closes 30 calendar days later. The portal at benefits.internal.example.com activates within 48 hours of your start date — you need your employee ID (on your offer letter) and date of birth to create the account. Coverage is retroactive to your start date.

**Category:** Benefits  
**Keywords:** benefits, enrollment, deadline, 30 days, coverage, employee id  
**Source:** support_tickets/faq_qa_records/ticket_resolutions_q1.csv (TKT-1102); hr_portal/onboarding_policy/new_hire_handbook.md  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-benefits-deadline`

### Is 401(k) enrollment automatic?

Yes. You are auto-enrolled at a 4% contribution starting your second pay period, and you can opt out or change your rate within 30 days through the benefits portal. Auto-enrollment surprises many new hires on their first paycheck, so review your election early.

**Category:** Benefits  
**Keywords:** 401k, auto-enrollment, 4%, retirement, opt out, contribution  
**Source:** hr_portal/onboarding_policy/new_hire_handbook.md (Day 4-5 — HR and Benefits); support_tickets/meeting_recaps/hr_standup_notes.txt  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-401k-default`

### How do commuter benefits work?

Pre-tax commuter benefits cover transit passes and parking. Enroll through the benefits portal under 'Commuter'. Only 30% of new hires said they were informed about the program (Q11 scored 2.8/5), so enroll early rather than waiting to hear about it informally.

**Category:** Benefits  
**Keywords:** commuter, transit, parking, pre-tax, benefits portal, perks  
**Source:** hr_portal/onboarding_policy/new_hire_handbook.md (Day 4-5); hr_portal/surveys/post_onboarding_q1.csv (Q11)  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-commuter-benefits`

### Which health plan do most people choose?

PPO Gold is the most popular plan — lower deductible and a wider network. The HDHP with HSA suits people who are generally healthy and want the tax-advantaged savings account. Plan comparison documents are in the benefits portal under Documents.

**Category:** Benefits  
**Keywords:** health plan, ppo gold, hdhp, hsa, deductible, network  
**Source:** support_tickets/faq_qa_records/chat_logs_may.json (CHAT-0503-003)  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-health-plan-choice`

### What is the home office equipment stipend, and how do I claim it?

$500 one-time for new hires. File through Concur under 'Home Office Setup' and attach the receipt within 60 days of purchase. If an item costs more than $500 you are reimbursed up to $500 and pay the difference; expenses over $500 need itemized receipts. Reimbursement lands in the next pay cycle.

**Category:** Benefits  
**Keywords:** home office, stipend, 500, concur, reimbursement, receipts  
**Source:** support_tickets/faq_qa_records/chat_logs_may.json (CHAT-0507-006); hr_portal/onboarding_policy/new_hire_handbook.md  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-home-office-stipend`

### How do I claim relocation expenses?

Relocation is now a $3,000 lump sum rather than itemized reimbursement. File it in Concur under the 'Relocation' expense type with scanned PDF receipts; the policy is at policy.internal.example.com/hr/relocation. Reimbursement is processed in the next pay period after approval — email relocation@example.com with questions.

**Category:** Benefits  
**Keywords:** relocation, 3000, lump sum, concur, expenses, reimbursement  
**Source:** support_tickets/faq_qa_records/ticket_resolutions_q1.csv (TKT-1168); support_tickets/meeting_recaps/hr_standup_notes.txt  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-relocation`

## HR

### How do I set up direct deposit for my paycheck?

Log into hris.internal.example.com > Pay > Direct Deposit and enter your routing number, account number, and account type. Submissions received by the 5th of the month are processed in that payroll cycle, and you will get a confirmation email within 2 business days.

**Category:** HR  
**Keywords:** direct deposit, payroll, hris, routing number, first paycheck  
**Source:** support_tickets/faq_qa_records/ticket_resolutions_q1.csv (TKT-1078)  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-direct-deposit`

### Who do I contact for pay, benefits, facilities, or IT questions?

Payroll: payroll@example.com. Benefits: benefits@example.com. Facilities and badge issues: facilities@example.com, or x5555 after hours. IT: x4357 (HELP) or #it-helpdesk on Slack. For anything you cannot route, ask your onboarding buddy or email onboarding@example.com.

**Category:** HR  
**Keywords:** contact, support, helpdesk, payroll, benefits, facilities  
**Source:** hr_portal/onboarding_policy/new_hire_handbook.md (Common Questions and Resources)  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-who-to-contact`

### Can I contribute to open source projects?

Only with prior approval through the OSS approval process at oss.internal.example.com, which reviews license compatibility, business risk, and whether the work contains proprietary code. Use your corporate GitHub account inside the company organization — never your personal account — and obtain manager and legal approval.

**Category:** HR  
**Keywords:** open source, oss approval, github, license, legal, ip  
**Source:** legal_docs/ip_policy_summary.md (Open Source Contributions); hr_portal/onboarding_policy/compliance_policy.md  
**Audience:** engineering  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-open-source`

### Who owns the code and designs I create at work?

The company owns all inventions, code, designs, documentation, and other work product created within the scope of your employment — including work done on company equipment, during work hours, or using company confidential information. Patentable inventions stay confidential until a patent application is filed.

**Category:** HR  
**Keywords:** intellectual property, ownership, work product, patent, confidentiality  
**Source:** legal_docs/ip_policy_summary.md (Ownership of Work Product; Confidentiality of IP)  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-ip-ownership`

### A new hire on my team is struggling. What should I do?

First have an honest conversation to understand the root cause, and check whether the problem is tooling or access rather than capability. If performance concerns arise within the first 90 days, escalate to your HR Business Partner. Do not initiate a Performance Improvement Plan without HR involvement.

**Category:** HR  
**Keywords:** manager, performance, 90 days, hr business partner, pip, escalation  
**Source:** hr_portal/onboarding_policy/orientation_guide.md (Common Manager Questions)  
**Audience:** managers  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-struggling-new-hire`

## Facilities

### My badge opens the front door but not my department floor.

Floor access is provisioned separately from building entry. Your manager must submit a zone access request through the facilities portal. For an immediate need, go to the security desk in the main lobby with your badge and ID for a temporary floor-access card valid 24 hours. New floor access can take 3+ days.

**Category:** Facilities  
**Keywords:** badge, floor access, zone access, facilities, temporary card, security desk  
**Source:** support_tickets/faq_qa_records/chat_logs_may.json (CHAT-0504-004); support_tickets/meeting_recaps/hr_standup_notes.txt  
**Audience:** new_hires  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-badge-floor-access`

### My badge doesn't work on the parking gate.

Email facilities@example.com with your badge ID (printed on the back). Temporary parking gate codes are issued within 4 hours, and after-hours issues go to the security desk at x5555. Permanent reprogramming requires a visit to the facilities office in Building A, Room 102.

**Category:** Facilities  
**Keywords:** parking, gate, badge id, facilities, after hours, building a  
**Source:** support_tickets/faq_qa_records/ticket_resolutions_q1.csv (TKT-1124)  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-parking-gate`

### How do I get my desk set up?

Your manager orders your monitor, keyboard, mouse, and docking station through the internal facilities request portal during pre-boarding, ideally at least two weeks before your start date. Raise any missing peripherals with your manager — laptops are usually ready on day 1, but peripherals often arrive later.

**Category:** Facilities  
**Keywords:** desk, monitor, keyboard, docking station, facilities, equipment  
**Source:** hr_portal/onboarding_policy/orientation_guide.md (Before Day 1); hr_portal/surveys/post_onboarding_q1.csv (Q2)  
**Audience:** managers  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-desk-setup`

## Security

### How do I set up two-factor authentication?

Install an authenticator app (Google Authenticator, Authy, or 1Password), go to sso.internal.example.com/security/2fa-setup, scan the QR code, and enter the generated code. Save the 10 backup codes — in 1Password or printed in a locked drawer. 2FA is required for all corporate accounts without exception, and you must use an app rather than SMS.

**Category:** Security  
**Keywords:** 2fa, mfa, authenticator, backup codes, sso, security  
**Source:** wiki_kb/access_setup.md (Two-Factor Authentication); training/workshop_slides.pdf (Slide 3)  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-2fa-setup`

### I'm upgrading my phone. How do I keep my 2FA working?

Before switching phones, open your authenticator app and export or transfer your accounts — use Transfer Accounts in Google Authenticator, or enable multi-device in Authy. If you lose access, sign in to the SSO portal with a backup code, reconfigure 2FA, and generate new backup codes immediately. Three March 2024 lockouts came from phone upgrades without migrating the app.

**Category:** Security  
**Keywords:** 2fa, phone upgrade, authenticator, transfer accounts, backup codes, lockout  
**Source:** wiki_kb/access_setup.md (Before You Upgrade Your Phone); support_tickets/meeting_recaps/onboarding_sync_2024-04.md  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-2fa-phone-upgrade`

### My authenticator app stopped generating valid codes.

Check the app's time sync first: Settings > Time correction for codes > Sync now. If codes still fail, go to sso.internal.example.com/recovery and use a backup code, then generate new backup codes immediately. If you are fully locked out, contact the IT security team at security@example.com.

**Category:** Security  
**Keywords:** 2fa, codes, authenticator, time sync, recovery, lockout  
**Source:** support_tickets/faq_qa_records/ticket_resolutions_q1.csv (TKT-1233)  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-2fa-codes-fail`

### What are the password requirements?

At least 16 characters with one uppercase, one lowercase, one number, and one special character; it cannot contain your name, username, or common dictionary words, and must be changed every 90 days. Use 1Password Teams for storage and never reuse passwords across services.

**Category:** Security  
**Keywords:** password, 16 characters, 90 days, 1password, requirements  
**Source:** wiki_kb/access_setup.md (First-Time Login); training/workshop_slides.pdf (Slide 4)  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-password-requirements`

### How do I report a phishing email?

Use the 'Report Phishing' button in Outlook, or forward the message to security@example.com. Never enter credentials from an emailed link — check the sender domain and hover over links first. If you already clicked, disconnect from the network and contact security immediately.

**Category:** Security  
**Keywords:** phishing, report, outlook, email, credentials, security  
**Source:** gitlab_snapshots/security_guide.md (Safe Browsing and Email); training/workshop_guides/security_basics.md  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-report-phishing`

### I think I caused a security incident. What do I do?

Disconnect from the network (turn off WiFi, unplug Ethernet) but do not power off the device — preserve evidence. Call the 24/7 hotline at 1-800-555-SECURITY, email security@example.com, or post in #security-incident, then document what you observed, when, and what you did. Do not discuss it with colleagues until cleared.

**Category:** Security  
**Keywords:** incident, security incident, report, hotline, evidence, breach  
**Source:** training/workshop_guides/data_privacy_basics.md (Part 5); gitlab_snapshots/security_guide.md (Incident Reporting)  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-report-incident`

### What are the data classification levels?

Public (shareable with anyone), Internal (employees only), Confidential (business need only — employee data, financial results, security incidents), and Restricted (highest sensitivity — customer PII, privileged legal documents, M&A material, unreleased source code). Never store Restricted data on personal devices or unencrypted media.

**Category:** Security  
**Keywords:** data classification, public, internal, confidential, restricted, handling  
**Source:** gitlab_snapshots/security_guide.md (Data Handling); legal_docs/data_compliance_onboarding.md; training/workshop_slides.pdf (Slide 5)  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-data-classification`

### Is split tunneling allowed on the VPN?

Split tunneling is off by default, so all traffic routes through the VPN. You can enable it under Settings > Network and add the corporate CIDR ranges 10.0.0.0/8 and 172.16.0.0/12, but it is not permitted while you are accessing Restricted-classification data — disable it first.

**Category:** Security  
**Keywords:** split tunneling, vpn, cidr, restricted data, network, policy  
**Source:** wiki_kb/vpn_config.html (Split Tunneling)  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-split-tunneling`

### How should I handle SSH keys and API tokens?

Generate an Ed25519 SSH key for Git and add the public key to your GitHub and GitLab accounts — never share the private key. Create API tokens with the minimum necessary scopes and rotate them every 90 days. Never share credentials, SSH keys, or API tokens with anyone, including colleagues.

**Category:** Security  
**Keywords:** ssh key, ed25519, api token, rotation, 90 days, credentials  
**Source:** gitlab_snapshots/security_guide.md (Secure Your Accounts); hr_portal/onboarding_policy/compliance_policy.md  
**Audience:** engineering  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-tokens-ssh-keys`

### Where am I allowed to store customer data?

Use only approved channels: Google Drive Shared Drives, ownCloud, or internal GitLab repositories. Never export customer PII to personal devices, personal cloud storage, or unapproved third-party services, and anonymize or aggregate it before using it in presentations or dashboards. Report suspected breaches to privacy@example.com and security@example.com.

**Category:** Security  
**Keywords:** customer data, pii, storage, approved channels, data breach, privacy  
**Source:** legal_docs/data_compliance_onboarding.md (Customer Data Handling; Incident Reporting)  
**Audience:** all_employees  
**Last Reviewed:** 2026-11-13  
**ID:** `faq-store-customer-data`

---

## Source coverage

| Source | Entries drawing on it |
|--------|-----------------------|
| `gitlab_snapshots/it_onboarding_setup.md` | 5 |
| `gitlab_snapshots/security_guide.md` | 4 |
| `hr_portal/department_checklists/design_onboarding.yaml` | 2 |
| `hr_portal/department_checklists/eng_onboarding.yaml` | 1 |
| `hr_portal/department_checklists/sales_ramp_up.csv` | 1 |
| `hr_portal/onboarding_policy/compliance_policy.md` | 3 |
| `hr_portal/onboarding_policy/new_hire_handbook.md` | 9 |
| `hr_portal/onboarding_policy/orientation_guide.md` | 4 |
| `hr_portal/surveys/post_onboarding_q1.csv` | 2 |
| `legal_docs/data_compliance_onboarding.md` | 2 |
| `legal_docs/ip_policy_summary.md` | 2 |
| `support_tickets/faq_qa_records/chat_logs_may.json` | 5 |
| `support_tickets/faq_qa_records/network_troubleshooting_log.json` | 4 |
| `support_tickets/faq_qa_records/ticket_metadata.json` | 1 |
| `support_tickets/faq_qa_records/ticket_resolutions_q1.csv` | 11 |
| `support_tickets/meeting_recaps/hr_standup_notes.txt` | 3 |
| `support_tickets/meeting_recaps/onboarding_sync_2024-04.md` | 2 |
| `training/workshop_guides/data_privacy_basics.md` | 1 |
| `training/workshop_guides/security_basics.md` | 2 |
| `training/workshop_slides.pdf` | 4 |
| `wiki_kb/access_setup.md` | 6 |
| `wiki_kb/troubleshooting_common.html` | 3 |
| `wiki_kb/vpn_config.html` | 4 |

*Generated 2026-11-13. Companion machine-readable file: `onboarding_faq_supplement.json`.*
