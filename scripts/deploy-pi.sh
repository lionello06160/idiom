#!/usr/bin/env bash

set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-ben@pi-home}"
REMOTE_DIR="${REMOTE_DIR:-/home/ben/apps/idiom}"
APP_NAME="${APP_NAME:-idiom}"
APP_PORT="${APP_PORT:-3001}"
APP_HOST="${APP_HOST:-0.0.0.0}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Deploying ${APP_NAME} to ${REMOTE_HOST}"
echo "    Remote dir: ${REMOTE_DIR}"
echo "    Port: ${APP_PORT}"

ssh -o BatchMode=yes "${REMOTE_HOST}" "mkdir -p '${REMOTE_DIR}'"

echo "==> Syncing project files"
rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude .DS_Store \
  --exclude data \
  --exclude .codex-screenshots \
  "${ROOT_DIR}/" "${REMOTE_HOST}:${REMOTE_DIR}/"

echo "==> Installing dependencies and building"
ssh "${REMOTE_HOST}" "
  set -euo pipefail
  cd '${REMOTE_DIR}'
  npm ci
  npm run build
  chmod +x '${REMOTE_DIR}/scripts/pi-watchdog.sh'
"

echo "==> Restarting PM2 app"
ssh "${REMOTE_HOST}" "
  set -euo pipefail
  pm2 delete '${APP_NAME}' >/dev/null 2>&1 || true
  cd '${REMOTE_DIR}'
  pm2 start npm --name '${APP_NAME}' -- run start -- --port '${APP_PORT}' --hostname '${APP_HOST}'
  pm2 save
"

echo "==> Installing watchdog cron"
ssh "${REMOTE_HOST}" "
  set -euo pipefail
  tmp_cron=\$(mktemp)
  crontab -l 2>/dev/null | grep -v '# ${APP_NAME}-watchdog' > \"\${tmp_cron}\" || true
  echo \"* * * * * APP_NAME='${APP_NAME}' APP_PORT='${APP_PORT}' '${REMOTE_DIR}/scripts/pi-watchdog.sh' # ${APP_NAME}-watchdog\" >> \"\${tmp_cron}\"
  crontab \"\${tmp_cron}\"
  rm -f \"\${tmp_cron}\"
"

echo "==> Health check"
ssh "${REMOTE_HOST}" "
  set -euo pipefail
  for _ in 1 2 3 4 5; do
    if curl -fsS -I 'http://127.0.0.1:${APP_PORT}/api/game-state' >/tmp/${APP_NAME}-health.txt 2>/dev/null; then
      head -n 1 /tmp/${APP_NAME}-health.txt
      exit 0
    fi
    sleep 1
  done
  echo 'Health check failed after 5 attempts' >&2
  exit 1
"

echo
echo "Deployment complete."
echo "URL: http://${REMOTE_HOST#*@}:${APP_PORT}"
