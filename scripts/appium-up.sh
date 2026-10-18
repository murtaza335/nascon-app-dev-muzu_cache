#!/usr/bin/env bash
# Starts Appium 2 on :4723 with the uiautomator2 driver (laptop with the device/emulator; not part of compose, D2-ADR-13).
set -euo pipefail
npx -y appium@2.11.5 driver install uiautomator2@3.8.0 || true
exec npx -y appium@2.11.5 --port 4723 --relaxed-security
