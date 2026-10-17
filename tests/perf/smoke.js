// k6 smoke: 10 VUs for 15 s alternating /health and /api/items.
// Run: docker compose -f docker-compose.yml -f docker-compose.test.yml --profile perf run --rm k6
// Compare CACHE_ENABLED=false vs true to measure the cache (docs/CACHING.md).
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 10,
  duration: '15s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
  },
};

export default function () {
  if (__ITER % 2 === 0) {
    const res = http.get(`${BASE_URL}/health`);
    check(res, { 'health 200': (r) => r.status === 200 });
  } else {
    const res = http.get(`${BASE_URL}/api/items`);
    check(res, {
      'list 200': (r) => r.status === 200,
      'list has X-Cache': (r) => !!r.headers['X-Cache'],
    });
  }
}
