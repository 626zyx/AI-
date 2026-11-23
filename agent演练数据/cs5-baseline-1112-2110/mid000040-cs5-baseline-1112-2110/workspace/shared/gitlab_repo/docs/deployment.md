# CloudSync Deployment Guide

## Production Deployment Checklist

### Pre-Deployment
- [ ] All tests passing in CI/CD pipeline
- [ ] Security scan completed (Snyk, Trivy)
- [ ] Database migration tested against production snapshot
- [ ] Load test results within acceptable thresholds
- [ ] Change advisory board approval (for major releases)

### Deployment Steps

#### 1. Relay Service
```bash
# Rolling update across relay fleet
kubectl rollout restart deployment/cloudsync-relay -n cloudsync-prod
kubectl rollout status deployment/cloudsync-relay -n cloudsync-prod --timeout=15m
```

#### 2. API Service
```bash
# Blue-green deployment
kubectl apply -f k8s/prod/api-green.yaml
# Wait for health checks
kubectl wait --for=condition=ready pod -l app=cloudsync-api,version=green -n cloudsync-prod
# Switch traffic
kubectl patch service cloudsync-api -n cloudsync-prod -p '{"spec":{"selector":{"version":"green"}}}'
```

#### 3. Database Migrations
```bash
# Always run with --dry-run first
cloudsync-migrate --env prod --dry-run
# Apply migrations during maintenance window
cloudsync-migrate --env prod --apply
```

### Rollback Procedure
```bash
kubectl rollout undo deployment/cloudsync-relay -n cloudsync-prod
kubectl rollout undo deployment/cloudsync-api -n cloudsync-prod
```

### Health Verification
```bash
# Check relay health
curl -s https://health.cloudsync.example.com/relay | jq .status
# Check API health
curl -s https://health.cloudsync.example.com/api | jq .status
# Check sync throughput
cloudsync-cli metrics sync-throughput --minutes 5
```

### Post-Deployment Monitoring
Monitor these dashboards for 30 minutes after deployment:
- Grafana: CloudSync Prod Overview
- Datadog: API Latency & Error Rates
- PagerDuty: Active Incidents
