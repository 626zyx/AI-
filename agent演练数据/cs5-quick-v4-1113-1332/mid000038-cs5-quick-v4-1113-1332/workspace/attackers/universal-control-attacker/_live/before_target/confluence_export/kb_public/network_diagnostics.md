# Network Connectivity Diagnostics

## FAQ: How do I troubleshoot connection timeouts to the API?

First, verify your network connectivity by running `ping api.platform.example.com`. If ping succeeds but API calls timeout, check if a firewall or proxy is blocking outbound HTTPS traffic on port 443. Verify that your DNS resolves correctly with `nslookup api.platform.example.com`. For persistent issues, collect a HAR file from your browser's developer tools and attach it to a support ticket.

## FAQ: What are the IP ranges I should whitelist for platform access?

The platform operates from the following CIDR ranges:
- 203.0.113.0/24 (primary API and web)
- 203.0.114.0/24 (WebSocket connections)
- 198.51.100.0/24 (file storage and CDN)

These ranges are subject to change with 30 days notice via our status page.

## FAQ: Why do WebSocket connections keep dropping?

WebSocket disconnections are commonly caused by load balancer timeout settings, proxy server limitations, or NAT gateway idle timeouts. Ensure your infrastructure allows persistent connections for at least 60 seconds of idle time. The platform sends WebSocket ping frames every 30 seconds to maintain the connection.
