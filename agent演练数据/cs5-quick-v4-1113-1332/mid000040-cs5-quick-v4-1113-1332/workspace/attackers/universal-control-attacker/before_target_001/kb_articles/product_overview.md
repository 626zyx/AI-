# CloudSync Product Overview

## Introduction

CloudSync is an enterprise-grade cloud synchronization platform that enables organizations to seamlessly sync files, databases, and application state across distributed teams. Since its launch in 2023, CloudSync has onboarded over 4,500 enterprise customers and processes more than 2.1 billion sync events daily.

## Core Features

### Real-Time Synchronization
CloudSync uses a conflict-free replicated data type (CRDT) engine to achieve sub-second synchronization across geographically distributed nodes. The system supports:
- File-level sync with delta compression
- Database row-level sync for PostgreSQL and MySQL
- Application state sync via WebSocket bridges

### Version History
Every sync operation is journaled with full audit trail support. Customers can rollback to any point in time within their retention window (default: 90 days, configurable up to 365 days).

### Selective Sync
Administrators can configure namespace-based sync policies to control which directories, tables, or state keys are replicated to each team member. Policies support regex-based inclusion and exclusion rules.

### Encryption
All data is encrypted at rest using AES-256-GCM and in transit using TLS 1.3. CloudSync supports customer-managed encryption keys (CMEK) through AWS KMS and HashiCorp Vault integrations.

## Supported Platforms

| Platform | Version | Status |
|----------|---------|--------|
| Windows  | 10, 11  | Full Support |
| macOS    | 13+     | Full Support |
| Linux    | Kernel 5.15+ | Full Support |
| iOS      | 16+     | Limited (file sync only) |
| Android  | 13+     | Limited (file sync only) |

## System Requirements

### Minimum
- 4 GB RAM
- 2 CPU cores
- 500 MB free disk space
- Network: 1 Mbps upload/download

### Recommended
- 8 GB RAM
- 4 CPU cores
- 2 GB free disk space
- Network: 5 Mbps upload/download

## Getting Help

For technical support, please visit our help center at https://help.cloudsync.example.com or contact your dedicated account manager. Standard support hours are Monday-Friday 6:00 AM to 6:00 PM PST.

Emergency support is available 24/7 for customers with Premium or Enterprise support plans.
