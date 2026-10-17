#!/usr/bin/env bash
# Machine readiness report: OK / WARN / MISSING. Never fails hard; read the output.
set -euo pipefail

G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'
ok()   { printf '%s[OK]%s      %s\n' "$G" "$N" "$*"; }
warn() { printf '%s[WARN]%s    %s\n' "$Y" "$N" "$*"; }
miss() { printf '%s[MISSING]%s %s\n' "$R" "$N" "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }
first_line() { "$@" 2>&1 | head -1 || true; }

echo "== Docker"
if have docker; then
  ok "docker: $(first_line docker --version)"
  if docker compose version >/dev/null 2>&1; then ok "compose: $(first_line docker compose version)"; else miss "docker compose plugin"; fi
  if id -nG | tr ' ' '\n' | grep -qx docker; then ok "user is in the docker group"; else warn "user not in docker group (sudo usermod -aG docker \$USER, then re-login)"; fi
  if docker info >/dev/null 2>&1; then ok "docker daemon reachable"; else miss "docker daemon not reachable (sudo systemctl start docker)"; fi
else
  miss "docker"
fi

echo "== Git"
if have git; then
  ok "git: $(first_line git --version)"
  b="$(git config --global init.defaultBranch || true)"
  if [[ -n "$b" ]]; then ok "init.defaultBranch=$b"; else warn "init.defaultBranch unset (git config --global init.defaultBranch main)"; fi
  if [[ -n "$(git config --global user.email || true)" ]]; then ok "git user.email set"; else warn "git user.email unset"; fi
else
  miss "git"
fi

echo "== Node / Python"
if have node; then
  v="$(node -v)"; major="${v#v}"; major="${major%%.*}"
  if (( major > 22 )); then warn "node $v (containers use Node 20: run nvm use 20 before generating lockfiles)"; else ok "node $v"; fi
else
  miss "node"
fi
if have npm; then ok "npm $(npm -v 2>/dev/null)"; else miss "npm"; fi
if have python3; then
  ok "python3: $(first_line python3 --version)"
  if python3 -c 'import venv, ensurepip' >/dev/null 2>&1; then ok "python3 venv available"; else warn "python3 venv/ensurepip missing (run-tests.sh --docker works without it)"; fi
else
  miss "python3"
fi

echo "== Android / mobile"
if have adb; then
  ok "adb: $(first_line adb version)"
  devs="$(adb devices 2>/dev/null | tail -n +2 | grep -v '^$' || true)"
  if [[ -z "$devs" ]]; then warn "adb: no devices attached (plug in the phone, enable USB debugging)"
  else
    while read -r serial state; do
      case "$state" in
        device) ok "adb device $serial" ;;
        unauthorized) warn "adb device $serial unauthorized (accept the prompt on the phone)" ;;
        *) warn "adb device $serial: $state (no permissions: add a udev rule / check cable mode)" ;;
      esac
    done <<< "$devs"
  fi
else
  miss "adb (install Android platform-tools or add ~/Android/Sdk/platform-tools to PATH)"
fi
if [[ -n "${JAVA_HOME:-}" ]]; then ok "JAVA_HOME=$JAVA_HOME"; else warn "JAVA_HOME unset"; fi
if have java; then ok "java: $(java -version 2>&1 | grep -v "^Picked up" | head -1 || true)"; else miss "java"; fi
android_home="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -n "$android_home" && -d "$android_home" ]]; then ok "ANDROID_HOME=$android_home"
elif [[ -d "$HOME/Android/Sdk" ]]; then warn "ANDROID_HOME unset but ~/Android/Sdk exists (export ANDROID_HOME=\$HOME/Android/Sdk)"
else miss "ANDROID_HOME / Android SDK"; fi
if [[ -n "${_JAVA_OPTIONS:-}" ]]; then
  warn "_JAVA_OPTIONS=${_JAVA_OPTIONS} applies to EVERY JVM (Gradle daemon + workers + Metro tools). Unset it or lower it: unset _JAVA_OPTIONS"
else
  ok "_JAVA_OPTIONS not set"
fi
if [[ -d "$HOME/.gradle/wrapper/dists" ]]; then ok "Gradle wrapper cache present (~/.gradle/wrapper/dists)"; else warn "Gradle cache not warmed (see docs/MOBILE.md step 2)"; fi
if have appium; then
  ok "appium $(appium -v 2>/dev/null || echo '?')"
  if appium driver list --installed 2>&1 | grep -qi uiautomator2; then ok "appium uiautomator2 driver"; else warn "appium uiautomator2 driver missing (appium driver install uiautomator2)"; fi
else
  warn "appium not installed (optional: npm i -g appium@2)"
fi

echo "== System"
if have getenforce; then
  se="$(getenforce 2>/dev/null || true)"
  if [[ "$se" == "Enforcing" ]]; then warn "SELinux Enforcing: bind mounts need :z (already used in this repo)"; else ok "SELinux: $se"; fi
fi
w="$(cat /proc/sys/fs/inotify/max_user_watches 2>/dev/null || echo 0)"
if (( w < 200000 )); then
  warn "fs.inotify.max_user_watches=$w (Metro ENOSPC risk): echo fs.inotify.max_user_watches=524288 | sudo tee /etc/sysctl.d/99-inotify.conf && sudo sysctl --system"
else
  ok "fs.inotify.max_user_watches=$w"
fi
if have free; then
  avail="$(free -m | awk '/^Mem:/ {print $7}')"
  if (( avail < 3000 )); then warn "available RAM ${avail} MB (close browsers/IDEs)"; else ok "available RAM ${avail} MB"; fi
fi
ips="$(hostname -I 2>/dev/null | xargs || true)"
ok "LAN IPs (share with teammates): ${ips:-none}"

echo "== GitHub SSH"
if have ssh; then
  out="$(timeout 10 ssh -o BatchMode=yes -o ConnectTimeout=5 -T git@github.com 2>&1 || true)"
  if grep -q "successfully authenticated" <<< "$out"; then ok "ssh git@github.com (port 22)"
  else warn "ssh git@github.com (port 22) failed: $(head -1 <<< "$out")"; fi
  out="$(timeout 10 ssh -o BatchMode=yes -o ConnectTimeout=5 -p 443 -T git@ssh.github.com 2>&1 || true)"
  if grep -q "successfully authenticated" <<< "$out"; then ok "ssh git@ssh.github.com (port 443)"
  else warn "ssh over 443 failed: $(head -1 <<< "$out") (see docs/TEAM.md)"; fi
else
  miss "ssh"
fi

echo "== Docker images"
if have docker && docker info >/dev/null 2>&1; then
  for img in postgres:16-alpine redis:7-alpine node:20-alpine python:3.12-slim \
             grafana/k6:0.54.0 selenium/hub:4.24.0 selenium/node-chrome:4.24.0 selenium/node-firefox:4.24.0 \
             selenium/node-edge:4.24.0 rabbitmq:3.13-management-alpine \
             nats:2.10-alpine bluenviron/mediamtx:1.9.1 livekit/livekit-server:v1.7.2 binwiederhier/ntfy:v2.11.0 \
             prom/prometheus:v2.54.1 grafana/grafana:11.2.0; do
    if docker image inspect "$img" >/dev/null 2>&1; then ok "image $img"
    elif [[ "$img" == minio/* ]] && docker image inspect "quay.io/$img" >/dev/null 2>&1; then ok "image quay.io/$img"
    else warn "image $img not pulled (scripts/pull-images.sh)"; fi
  done
fi
echo "Done."
