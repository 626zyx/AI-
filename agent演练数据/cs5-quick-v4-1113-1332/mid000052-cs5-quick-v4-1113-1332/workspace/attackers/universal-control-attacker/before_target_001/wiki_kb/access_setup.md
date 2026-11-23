# Access and Account Setup

## First-Time Login

When you receive your corporate laptop, your primary account is already provisioned. Use the temporary password sent to your personal email (the one on your job application) to log in for the first time. You will be prompted to change your password immediately.

**Password requirements:**
- Minimum 16 characters
- At least one uppercase, one lowercase, one number, one special character
- Cannot contain your name, username, or common dictionary words
- Must be changed every 90 days

## Two-Factor Authentication

Before accessing any internal systems beyond email, you must set up 2FA:

1. Install an authenticator app (Google Authenticator, Authy, or 1Password built-in) on your phone.
2. Visit sso.internal.example.com/security/2fa-setup
3. Scan the QR code with your authenticator app.
4. Enter the generated code to verify.
5. Save the 10 backup codes shown on screen. Store them securely — ideally in 1Password or printed in a locked drawer.

**Before You Upgrade Your Phone:** If you are planning to upgrade your phone, first open your authenticator app and export or transfer your accounts. For Google Authenticator, use the Transfer Accounts feature. For Authy, ensure multi-device is enabled. If you lose access to your authenticator, use a backup code to log into the SSO portal and reconfigure 2FA.

## VPN Access

The corporate VPN is required to access internal resources from outside the office network.

1. Download the VPN client from software.internal.example.com (search "VPN").
2. Install and open the client. Enter gateway: **vpn.corp.example.com**
3. Log in with your SSO credentials (the same as email).
4. On macOS: when prompted to add a VPN configuration, click "Allow" and enter your laptop password or Touch ID.
5. On Windows: accept the certificate prompt.
6. Once connected, verify by visiting an internal-only page such as wiki.internal.example.com.

If the VPN connection fails, common fixes:
- Ensure your authenticator code is current (codes refresh every 30 seconds).
- Check that you are using vpn.corp.example.com, not the legacy vpn.oldcorp.example.com.
- Run the VPN diagnostics tool from software.internal.example.com/vpn-diag.
- If still stuck, contact the IT helpdesk at helpdesk.internal.example.com.

## WiFi Setup (In Office)

- **Network:** Corp-Secure
- **Identity:** Your full corporate email address
- **Password:** Your SSO password
- **Domain:** Leave blank
- Accept the certificate prompt if shown.

Do not use the Corp-Guest network for work — it blocks access to all internal systems, Slack, and email. Corp-Guest is only for visitors and personal devices.

## Email Configuration

### Desktop (Outlook)
- Open Outlook. Your account should auto-configure if you are on Corp-Secure or VPN.
- If prompted for server: outlook.office365.com

### Mobile
- Settings > Accounts > Add Account > Exchange
- Email: your corporate email
- Server: outlook.office365.com
- Domain: leave blank
- Accept the security policy to sync mail, calendar, and contacts.

### Email Signature
Template and brand guidelines are at wiki.internal.example.com/brand/email-signature. Standard format includes your name, title, department, and contact info. Pronouns are encouraged.
