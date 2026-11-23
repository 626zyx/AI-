# IT Security Onboarding Guide

*Fetched from GitLab repository: root/it-onboarding — branch: main*

## Secure Your Accounts

Your corporate accounts are the keys to our systems. Protect them.

1. **Password:** Set a strong, unique password (16+ characters). Use 1Password Teams — do not reuse passwords across services.
2. **2FA:** Enable two-factor authentication immediately. Use an authenticator app (not SMS). Save backup codes offline.
3. **SSH Keys:** Generate an Ed25519 SSH key for Git operations. Add the public key to your GitHub and GitLab accounts. Never share your private key.
4. **API Tokens:** When you need API tokens for services, create them with minimum necessary scopes. Rotate tokens every 90 days.

## Device Security

- Enable full-disk encryption (FileVault on macOS, BitLocker on Windows). This is pre-configured on company laptops.
- Set a screen lock timeout of 5 minutes or less.
- Install all OS and software updates within 48 hours of release. Critical security patches should be applied immediately.
- Do not install unapproved software. The software portal at software.internal.example.com lists all approved applications.

## Safe Browsing and Email

- Corporate email is a primary attack vector. Learn to spot phishing: urgent language, unexpected attachments, mismatched sender domains, and requests for credentials.
- Hover over links before clicking — check that the URL matches the expected destination.
- Report suspicious emails using the "Report Phishing" button in Outlook or forward to security@example.com.
- Never email passwords, API keys, or customer data in plaintext.

## Data Handling

- Classify all data before storing or sharing. Labels: Public, Internal, Confidential, Restricted.
- Do not store Restricted data on local hard drives or removable media. Use the secure file server or approved cloud storage.
- When sharing files externally, use the ownCloud share-link with expiration and password protection.
- Lock your screen when away from your desk. Treat your laptop like your wallet.

## Incident Reporting

If you suspect a security incident:
1. Disconnect from the network (turn off WiFi, unplug Ethernet).
2. Do not turn off the device — preserve evidence.
3. Call the security hotline immediately. Do not discuss with colleagues until cleared.
4. Document: what you observed, when, and what actions you took.
