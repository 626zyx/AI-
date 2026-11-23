# Authentication Troubleshooting Guide

## FAQ: How do I reset my platform password?

Navigate to the login page and click "Forgot Password". Enter your registered email address. You will receive a password reset link valid for 30 minutes. Click the link, enter your new password (minimum 12 characters, must include uppercase, lowercase, digit, and special character), and confirm. Your password will be updated immediately.

## FAQ: Why am I getting "Invalid Credentials" after resetting my password?

This typically occurs when your browser has cached the old credentials. Clear your browser cache and cookies, then attempt login again. If the issue persists, verify that Caps Lock is not enabled and that you are using the correct email address. The system locks accounts after 5 failed attempts for 15 minutes.

## FAQ: How do I enable Two-Factor Authentication (2FA)?

Go to Account Settings > Security > Two-Factor Authentication. Click "Enable 2FA". Choose between authenticator app (recommended) or SMS-based verification. Scan the QR code with your authenticator app or enter your phone number. Enter the verification code to confirm setup. Download and save your recovery codes in a secure location.

## FAQ: Can I use Single Sign-On (SSO) with my corporate identity provider?

Yes. Our platform supports SAML 2.0 and OIDC-based SSO. Contact your organization's IT administrator to configure the identity provider integration. Once configured, users in your domain will see an "Sign in with SSO" button on the login page.
