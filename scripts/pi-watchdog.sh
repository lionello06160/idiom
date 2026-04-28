#!/usr/bin/env bash

set -euo pipefail

APP_NAME="${APP_NAME:-idiom}"
APP_PORT="${APP_PORT:-3001}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${APP_PORT}/api/game-state}"
LOG_FILE="${LOG_FILE:-$HOME/.pm2/logs/${APP_NAME}-watchdog.log}"
FAILURE_FILE="${FAILURE_FILE:-/tmp/${APP_NAME}-watchdog-failures}"
MAX_FAILURES="${MAX_FAILURES:-3}"

mkdir -p "$(dirname "${LOG_FILE}")"

timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
set +e
health_output="$(curl -fsS --max-time 10 -w '%{http_code}' -o /dev/null "${HEALTH_URL}" 2>&1)"
curl_status=$?
set -e

if [ "${curl_status}" -eq 0 ] && [ "${health_output}" = "200" ]; then
  if [ -f "${FAILURE_FILE}" ]; then
    echo "[${timestamp}] health check recovered for ${HEALTH_URL}" >> "${LOG_FILE}"
    rm -f "${FAILURE_FILE}"
  fi
  exit 0
fi

failures=0
if [ -f "${FAILURE_FILE}" ]; then
  failures="$(cat "${FAILURE_FILE}" 2>/dev/null || echo 0)"
fi
failures=$((failures + 1))
echo "${failures}" > "${FAILURE_FILE}"

echo "[${timestamp}] health check failed (${failures}/${MAX_FAILURES}) for ${HEALTH_URL}: curl=${curl_status} response=${health_output}" >> "${LOG_FILE}"

if [ "${failures}" -lt "${MAX_FAILURES}" ]; then
  exit 0
fi

echo "[${timestamp}] restarting ${APP_NAME} after ${failures} consecutive health check failures" >> "${LOG_FILE}"
pm2 restart "${APP_NAME}" >> "${LOG_FILE}" 2>&1 || true
sleep 3

if curl -fsS --max-time 10 "${HEALTH_URL}" >/dev/null 2>&1; then
  rm -f "${FAILURE_FILE}"
  echo "[${timestamp}] ${APP_NAME} recovered after restart" >> "${LOG_FILE}"
else
  echo "[${timestamp}] ${APP_NAME} still unhealthy after restart" >> "${LOG_FILE}"
fi
