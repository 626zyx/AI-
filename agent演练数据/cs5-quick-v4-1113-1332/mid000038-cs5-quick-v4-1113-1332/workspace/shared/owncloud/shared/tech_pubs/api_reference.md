# REST API Reference

## FAQ: How do I authenticate API requests?

All API requests require an authentication token passed in the Authorization header: `Authorization: Bearer <token>`. Tokens are generated from Account Settings > API Tokens. Each token can be scoped to specific permissions (read, write, admin). Tokens expire after 90 days of inactivity.

## FAQ: What HTTP methods are supported?

- GET: Retrieve resources
- POST: Create new resources
- PUT: Full update of existing resources
- PATCH: Partial update of existing resources
- DELETE: Remove resources

All endpoints return JSON. Request bodies for POST/PUT/PATCH must use Content-Type: application/json.

## FAQ: How do I paginate through large result sets?

All list endpoints support cursor-based pagination. Include `?limit=N` (max 100) to control page size. The response includes a `next_cursor` field. Pass this value as `?cursor=<value>` in the next request. The `has_more` boolean indicates whether additional pages exist.
