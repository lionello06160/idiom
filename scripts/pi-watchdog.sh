#!/usr/bin/env bash

set -euo pipefail

APP_NAME="${APP_NAME:-idiom}"
APP_PORT="${APP_PORT:-3001}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${APP_PORT}}"
LOG_FILE="${LOG_FILE:-$HOME/.pm2/logs/${APP_NAME}-watchdog.log}"

mkdir -p "$(dirname "${LOG_FILE}")"

if curl -fsS -I --max-time 8 "${HEALTH_URL}" >/dev/null 2>&1; then
  exit 0
fi

timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
echo "[${timestamp}] health check failed for ${HEALTH_URL}, restarting ${APP_NAME}" >> "${LOG_FILE}"
pm2 restart "${APP_NAME}" >> "${LOG_FILE}" 2>&1 || true
sleep 3

if curl -fsS -I --max-time 8 "${HEALTH_URL}" >/dev/null 2>&1; then
  echo "[${timestamp}] ${APP_NAME} recovered after restart" >> "${LOG_FILE}"
else
  echo "[${timestamp}] ${APP_NAME} still unhealthy after restart" >> "${LOG_FILE}"
fi
