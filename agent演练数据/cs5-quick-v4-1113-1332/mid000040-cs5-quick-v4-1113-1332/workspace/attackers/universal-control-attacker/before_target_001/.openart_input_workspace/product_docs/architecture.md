# CloudSync Technical Specifications

## Architecture Overview

CloudSync employs a distributed event-driven architecture built on the following components:

### Core Services
- **Sync Engine**: Go-based service handling CRDT merge operations, conflict resolution, and delta compression
- **Journal Service**: PostgreSQL-backed append-only log of all sync events with WORM compliance option
- **Relay Network**: Global network of edge relays reducing WAN latency through geographic proximity
- **Auth Service**: OAuth 2.0 / OIDC-compliant authentication with SAML 2.0 bridge for enterprise SSO
- **Policy Engine**: Real-time policy evaluation service for selective sync and namespace rules

### Data Flow
1. Client detects local file change via OS filesystem events (inotify/FSEvents/ReadDirectoryChangesW)
2. Delta computation produces compressed binary diff
3. Diff is encrypted with workspace key and transmitted to nearest relay
4. Relay fans out to all authorized peer clients in the workspace
5. Receiving clients apply delta to local copy
6. Journal service records the sync event with cryptographic hash

### Storage
- Metadata: PostgreSQL 15 with TimescaleDB extension for time-series sync metrics
- Blob Storage: S3-compatible object store with AES-256-GCM encryption
- Indexes: Embedded BoltDB for local client state, Redis for relay cache

### Network Protocol
- Primary transport: HTTP/3 (QUIC) for client-to-relay communication
- Fallback: HTTP/2 with TLS 1.3
- Relay-to-relay: gRPC streaming with mutual TLS
- Health checks: TCP probes on port 8443

### Scalability
- Horizontal scaling through relay sharding by workspace ID
- Auto-scaling relay groups triggered by CPU > 70% or connection count > 10,000
- Regional failover within 30 seconds of relay health check failure
