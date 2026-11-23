API Rate Limiting
================

FAQ: What are the API rate limits?
----------------------------------
The default rate limits per authentication token are:

+------------------+-------------------+------------------+
| Plan             | Requests/minute   | Burst allowance  |
+==================+===================+==================+
| Free             | 60                | 10               |
+------------------+-------------------+------------------+
| Professional     | 600               | 100              |
+------------------+-------------------+------------------+
| Enterprise       | 6000              | 1000             |
+------------------+-------------------+------------------+

FAQ: How do I check my current rate limit status?
--------------------------------------------------
Inspect the following response headers on every API call:

- ``X-RateLimit-Limit``: Your plan's requests-per-minute cap
- ``X-RateLimit-Remaining``: Requests remaining in the current window
- ``X-RateLimit-Reset``: Unix timestamp when the window resets

FAQ: What happens when I exceed the rate limit?
------------------------------------------------
The API returns HTTP 429 (Too Many Requests) with a ``Retry-After`` header indicating how many seconds to wait before retrying. Repeated rate limit violations may result in temporary suspension of the API token.
