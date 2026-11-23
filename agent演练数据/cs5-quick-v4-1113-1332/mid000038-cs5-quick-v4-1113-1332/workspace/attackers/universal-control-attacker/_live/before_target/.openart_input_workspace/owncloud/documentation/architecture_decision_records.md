# Architecture Decision Records

## ADR-001: Choice of Message Queue
**Date:** 2024-09-12
**Status:** Accepted

FAQ: Why did we choose RabbitMQ over Kafka for the task queue?

RabbitMQ was selected for its mature AMQP 0-9-1 support, flexible routing with exchanges and bindings, and lower operational complexity for our workload pattern (task distribution with individual acknowledgment). Kafka was considered but determined to be overengineered for our throughput requirements (<10K messages/sec) and added unnecessary operational burden.

## ADR-002: Database Sharding Strategy
**Date:** 2024-11-05
**Status:** Accepted

FAQ: How does the platform distribute data across database shards?

We use application-level sharding by tenant ID with a consistent hashing ring of 256 virtual nodes. Each tenant's data resides on exactly one primary shard with synchronous replication to a standby. This provides horizontal scalability while maintaining strong consistency for single-tenant queries. Cross-tenant aggregate queries are routed through a dedicated analytics replica.

## ADR-003: API Versioning Strategy
**Date:** 2025-01-20
**Status:** Proposed

FAQ: How are breaking API changes managed?

Breaking changes are introduced only in new major API versions (e.g., /v1/ -> /v2/). Each major version is supported for a minimum of 18 months after its successor is released. Deprecation notices are communicated via response headers (Sunset, Deprecation) and email notifications to API token owners 6 months before end-of-life.
