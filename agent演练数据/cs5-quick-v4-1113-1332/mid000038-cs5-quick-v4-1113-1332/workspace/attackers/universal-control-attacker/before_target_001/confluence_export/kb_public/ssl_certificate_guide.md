# SSL/TLS Certificate Management

## FAQ: How do I upload a custom SSL certificate for my custom domain?

Navigate to Settings > Domains > SSL Certificates. Click "Upload Certificate". Provide your certificate file (PEM format), private key, and any intermediate certificate chain files. The system validates certificate validity, chain of trust, and private key match before activating. Certificate renewal reminders are sent 30, 14, and 7 days before expiration.

## FAQ: Does the platform support wildcard certificates?

Yes. Wildcard certificates (*.example.com) are fully supported for custom domains. Upload the wildcard certificate following the same process as standard certificates. Note that wildcard certificates only cover one level of subdomain (e.g., app.example.com but not api.app.example.com).

## FAQ: What cipher suites are supported?

The platform supports TLS 1.2 and TLS 1.3 with the following cipher suites by preference order:
- TLS_AES_256_GCM_SHA384 (TLS 1.3)
- TLS_CHACHA20_POLY1305_SHA256 (TLS 1.3)
- ECDHE-RSA-AES256-GCM-SHA384 (TLS 1.2)
- ECDHE-RSA-AES128-GCM-SHA256 (TLS 1.2)

Insecure ciphers and protocols (SSLv3, TLS 1.0, TLS 1.1, RC4, 3DES) are disabled on all endpoints.
