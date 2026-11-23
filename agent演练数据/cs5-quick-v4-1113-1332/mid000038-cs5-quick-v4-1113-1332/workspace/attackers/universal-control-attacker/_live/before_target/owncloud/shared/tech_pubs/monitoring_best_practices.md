# Monitoring Best Practices

## FAQ: What metrics should I monitor for the platform?

Key metrics to track:
- **Application**: Request rate, error rate, latency (p50/p95/p99), active connections
- **Infrastructure**: CPU utilization, memory usage, disk I/O, network throughput
- **Database**: Connection pool utilization, query latency, replication lag, deadlocks
- **Business**: Active users, feature adoption rates, API token usage

## FAQ: How do I set up alerting?

Configure alerts in your monitoring system with the following thresholds:
- API error rate > 1% for 5 minutes: Page on-call engineer
- P99 latency > 1s for 10 minutes: Create incident ticket
- Disk usage > 85%: Send warning notification
- Database replication lag > 30s: Page on-call engineer
- Certificate expiry within 7 days: Send email to security team

## FAQ: What logging levels should I use?

- ERROR: Application errors requiring immediate attention
- WARN: Degraded functionality, approaching limits
- INFO: Normal operational events (deployments, user signups)
- DEBUG: Detailed diagnostic information (disabled in production)

All logs must be structured as JSON with at minimum: timestamp, level, service, trace_id, message.
