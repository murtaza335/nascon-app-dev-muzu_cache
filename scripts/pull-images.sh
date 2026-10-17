#!/usr/bin/env bash
# Pre-pull every pinned image at home (campus network may be slow or filtered).
set -euo pipefail

IMAGES=(
  postgres:16-alpine
  redis:7-alpine
  node:20-alpine
  python:3.12-slim
  rabbitmq:3.13-management-alpine
  nats:2.10-alpine
  bluenviron/mediamtx:1.9.1
  livekit/livekit-server:v1.7.2
  binwiederhier/ntfy:v2.11.0
  prom/prometheus:v2.54.1
  grafana/grafana:11.2.0
  grafana/k6:0.54.0
  selenium/hub:4.24.0
  selenium/node-chrome:4.24.0
  selenium/node-firefox:4.24.0
  selenium/node-edge:4.24.0
)
MINIO_TAG="RELEASE.2024-09-22T00-33-43Z"

failed=()
for img in "${IMAGES[@]}"; do
  echo "==> $img"
  docker pull -q "$img" || failed+=("$img")
done

echo "==> localstack/localstack:3.8.1 (S3 object store; MinIO no longer publishes images)"
docker pull -q "localstack/localstack:3.8.1" || failed+=("localstack:3.8.1")

docker images
if (( ${#failed[@]} )); then
  echo "FAILED to pull: ${failed[*]}" >&2
  exit 1
fi
echo "All images pulled."
