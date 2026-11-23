# Email Client Setup Guide

## Overview

This guide covers email client configuration for new hires using the corporate email system. Follow the steps below to set up your email on desktop and mobile.

## Prerequisites

- Active corporate account with SSO enabled
- Multi-factor authentication app installed on your phone
- VPN client configured (see `access_setup.md`)

## Desktop Setup (Outlook / Thunderbird)

1. Open your email client and select "Add Account".
2. Enter your corporate email address: `firstname.lastname@company.com`.
3. Choose "Exchange" or "IMAP" as the account type.
4. **Incoming server**: `mail.company.com`, port `993`, SSL/TLS enabled.
5. **Outgoing server**: `smtp.company.com`, port `587`, STARTTLS required.
6. Authenticate with your SSO credentials when prompted.
7. Accept the MFA push notification on your mobile device.

## Mobile Setup (iOS / Android)

1. Download the corporate email app from the managed app store.
2. Open the app and enter your corporate email address.
3. Follow the SSO redirect flow to authenticate.
4. Grant notification permissions when prompted.
5. Set your signature to the standard format: `Name | Title | Department`.

## Calendar Integration

Your email account automatically syncs with the corporate calendar. To verify:

- Open the calendar tab in your email client.
- Confirm the "Team Calendar" and "Company Holidays" subscriptions appear.
- Test by creating a meeting invite — participants should receive it within 60 seconds.

## Common Issues

| Issue | Solution |
|-------|----------|
| Authentication fails repeatedly | Reset MFA in the identity portal, then retry |
| Calendar not syncing | Remove and re-add the account |
| Emails stuck in outbox | Check VPN connection and retry |
| Signature not applying | Update signature in account settings |

## Support

If issues persist, open a ticket in the helpdesk portal with category "Email & Calendar" and attach a screenshot of the error.

*Last updated: March 2025*
