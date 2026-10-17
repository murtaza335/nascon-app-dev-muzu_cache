# Caching (Redis cache-aside)

Implementation: `backend/src/cache.js`. Decision record: ADR-003. Tests: `tests/api/test_cache_api.py` (REQ-INF-03).

## What to cache on the day

**Cache:** read-heavy GETs that are a pure function of their input:

- lists and search results (`GET /api/things?limit&offset&q`)
- public detail pages (`GET /api/things/:id`)
- aggregates, counts, stats, leaderboards, dashboards
- reference data (categories, config lists)

**Do not cache:**

- writes (POST/PUT/PATCH/DELETE): they invalidate instead
- auth, login, sessions and tokens
- per-user private data, **unless the user id is part of the key** (`cached('orders', [userId, query], ...)`)
- anything the spec says must be real-time (live counters, stock levels during checkout, chat)

## TTL guide

| Kind | TTL |
|---|---|
| Lists / search | 30-60 s |
| Detail | 60-300 s |
| Aggregates / leaderboards | 10-30 s |

The TTL is only a safety net. **Invalidation on write is mandatory regardless of TTL**: every write calls `await invalidate('<resource>')` after the DB write succeeds and before the response is sent. If a write changes data shown by another resource (for example, a new review changes a product's average rating), invalidate both.

## Adding a cached route

```js
const { cached, invalidate } = require('../cache');

router.get('/', async (req, res) => {
  const q = validate(listSchema, req.query, { source: 'query' });
  const { value, status } = await cached('things', ['list', q], () => loadThings(q), { ttl: 30 });
  res.set('X-Cache', status).json(value);
});

router.post('/', async (req, res) => {
  const row = await insertThing(validate(createSchema, req.body));
  await invalidate('things');             // before responding
  res.status(201).json(row);
});
```

Rules: validate first (the validated object becomes the key, so `?limit=20` and the default share a key); return `null` from the loader for "not found" (null is never cached, so a 404 is never cached); errors thrown by the loader propagate and are not cached.

## The `X-Cache` header

- `MISS`: loaded from the DB and stored.
- `HIT`: served from Redis.
- `BYPASS`: cache disabled (`CACHE_ENABLED=false`), Redis unreachable, a Redis call timed out, or a previous invalidation of this resource failed and has not been retried yet.

## How keys work

```
nascon:v1:ver:items                              -> 7   (version counter, no TTL)
nascon:v1:items:v7:["list",{"limit":20,"offset":0}]  -> {...}  (data, EX 60±10%)
```

`invalidate('items')` does `INCR nascon:v1:ver:items`, so every key of that resource is orphaned at once. Orphaned keys expire through their TTL or are evicted by `volatile-lru`.

## Measuring the effect

```bash
CACHE_ENABLED=false docker compose up -d --wait
docker compose -f docker-compose.yml -f docker-compose.test.yml --profile perf run --rm k6   # note p95
CACHE_ENABLED=true docker compose up -d --wait
docker compose -f docker-compose.yml -f docker-compose.test.yml --profile perf run --rm k6   # compare p95
```

Measure an endpoint with a real query (joins, aggregates); a trivial `SELECT` on an empty table will not show much difference.

## Failure behaviour

- **Redis down at boot:** the backend starts anyway and reconnects in the background (every 50-500 ms).
- **Redis down mid-run:** each call fails fast (offline queue disabled, 200 ms timeout), the loader runs and the response is `BYPASS`. `/health` stays 200 with `"cache": false`. Errors are logged at most once every 10 s.
- **Invalidation fails (Redis blip during a write):** the resource is marked pending, and reads of it are `BYPASS` until an `INCR` succeeds. A stale value can never be served after a write.
- **Redis restarts:** no persistence, so it comes back empty, which is correct (cold cache).

## Viva talking points

- **Why cache-aside?** The DB stays the source of truth; the cache is optional and can be dropped at any time. A write-through cache would couple every write to Redis availability.
- **Why version keys instead of SCAN/DEL?** `INCR` is O(1) and atomic. SCAN plus DEL is O(keyspace), not atomic (a concurrent read can re-populate a key mid-scan) and blocks under load. Old keys simply expire.
- **Why `volatile-lru`?** Under memory pressure Redis evicts only keys with a TTL (our data keys), never the TTL-less version counters, so invalidation state is never lost. With `allkeys-lru`, evicting a version key would reset it to 0 and could resurrect stale v0 data.
- **What happens when Redis dies?** Requests still succeed (BYPASS) at DB speed; health stays green; nothing crashes. The timeout bounds the added latency to 200 ms per call in the worst case and about 0 ms once the client knows it is offline.
- **How are stale reads prevented?** Invalidation is awaited before the write response is sent, so any request that starts after the client sees the response uses the new version. A failed invalidation forces BYPASS for that resource. Jittered TTLs prevent synchronized expiry stampedes, and single-flight stops a burst of concurrent misses from hammering the DB.
