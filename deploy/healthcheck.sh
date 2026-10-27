#!/usr/bin/env bash
# =============================================================================
# Proton healthcheck — cron + UptimeRobot push monitor friendly
# =============================================================================
# Checks, in order (each failure prints a specific message and exits 1):
#   1. GET /health          -> status=ok and workflow=postgres
#   2. GET /health/ai       -> status=ok; configured=false is fatal in real mode
#   3. Postgres             -> SELECT 1 through the API container + DATABASE_URL
#   4. Free disk            -> must be > MIN_FREE_DISK_PCT (default 10)
#   5. Free RAM             -> must be > MIN_FREE_RAM_PCT  (default 10)
#
# Exit codes:
#   0  healthy
#   1  any failed check (message on stderr says which)
#   2  configuration/precondition problem
#
# Cron:
#   */5 * * * * cd /opt/proton && ./deploy/healthcheck.sh \
#     >> /var/log/proton-health.log 2>&1
#
# UptimeRobot: create a free "Push" monitor, put its URL in
# UPTIMEROBOT_PUSH_URL. The check pings it on success and sends
# ?status=down&msg=... on failure. If the VM itself is down, no ping is sent
# and UptimeRobot alerts on the missed heartbeat.
#
# This script is intentionally host-side: it exercises the same loopback port
# and compose network that a human would use at 2am.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/deploy/.env.deploy}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/deploy/docker-compose.free.yml}"

BASE_URL="${PROTON_HEALTH_URL:-http://127.0.0.1:3002}"
DISK_PATH="${DISK_PATH:-/}"
MIN_FREE_DISK_PCT="${MIN_FREE_DISK_PCT:-10}"
MIN_FREE_RAM_PCT="${MIN_FREE_RAM_PCT:-10}"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

push_up() {
  [ -n "${UPTIMEROBOT_PUSH_URL:-}" ] || return 0
  curl -fsS --max-time 5 "$UPTIMEROBOT_PUSH_URL" >/dev/null 2>&1 || true
}

push_down() {
  [ -n "${UPTIMEROBOT_PUSH_URL:-}" ] || return 0
  curl -fsS --max-time 5 --get \
    --data-urlencode "status=down" \
    --data-urlencode "msg=$1" \
    "$UPTIMEROBOT_PUSH_URL" >/dev/null 2>&1 || true
}

fail() {
  local message="$*"
  printf 'FAIL: %s\n' "$message" >&2
  push_down "$message"
  exit 1
}

# ---------------------------------------------------------------------------
# Preconditions
# ---------------------------------------------------------------------------
command -v curl >/dev/null 2>&1 || fail "curl is not installed"
command -v docker >/dev/null 2>&1 || fail "docker is not installed"
docker compose version >/dev/null 2>&1 || fail "docker compose v2 is not available"
[ -f "$ENV_FILE" ] || fail "env file not found: $ENV_FILE (copy deploy/.env.deploy.example)"

# shellcheck source=/dev/null
set -a
. "$ENV_FILE"
set +a

# UPTIMEROBOT_PUSH_URL and thresholds may also come from the env file.
BASE_URL="${PROTON_HEALTH_URL:-$BASE_URL}"
DISK_PATH="${DISK_PATH:-$DISK_PATH}"
MIN_FREE_DISK_PCT="${MIN_FREE_DISK_PCT:-$MIN_FREE_DISK_PCT}"
MIN_FREE_RAM_PCT="${MIN_FREE_RAM_PCT:-$MIN_FREE_RAM_PCT}"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

# ---------------------------------------------------------------------------
# 1. /health
# ---------------------------------------------------------------------------
HEALTH="$(curl -fsS --max-time 5 "${BASE_URL%/}/health" 2>/dev/null)" \
  || fail "GET /health failed at ${BASE_URL} (API down, tunnel/port wrong, or crash-looping)"

case "$HEALTH" in
  *'"status":"ok"'*) ;;
  *) fail "GET /health returned an unexpected body: ${HEALTH:0:300}" ;;
esac

case "$HEALTH" in
  *'"workflow":"postgres"'*) ;;
  *) fail "API is up but workflow persistence is not postgres; run: docker compose logs api" ;;
esac

# ---------------------------------------------------------------------------
# 2. /health/ai
# ---------------------------------------------------------------------------
AI="$(curl -fsS --max-time 5 "${BASE_URL%/}/health/ai" 2>/dev/null)" \
  || fail "GET /health/ai failed at ${BASE_URL}"

case "$AI" in
  *'"status":"ok"'*) ;;
  *) fail "GET /health/ai returned an unexpected body: ${AI:0:300}" ;;
esac

AI_MODE="${PROTON_AI_MODE:-demo}"
case "$AI" in
  *'"configured":true'*) log "AI provider configured (mode=${AI_MODE})." ;;
  *'"configured":false'*)
    if [ "$AI_MODE" = "real" ]; then
      fail "PROTON_AI_MODE=real but /health/ai reports configured=false; set the provider key or switch to demo"
    fi
    log "WARN: AI provider is not configured, but mode=${AI_MODE} is non-real; continuing."
    ;;
  *) fail "GET /health/ai is missing the configured field: ${AI:0:300}" ;;
esac

# ---------------------------------------------------------------------------
# 3. Postgres connectivity through the API
# ---------------------------------------------------------------------------
# This uses the API image, its DATABASE_URL, and the compose network. It is a
# stronger check than pg_isready because it proves credentials and routing too.
DB_OUT="$(
  compose exec -T api node -e '
    const { Pool } = require("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false,
      max: 1,
      connectionTimeoutMillis: 5000
    });
    pool.query("SELECT 1")
      .then(() => pool.end())
      .then(() => process.exit(0))
      .catch((err) => { console.error(err.message); process.exit(1); });
  ' 2>&1
)" || fail "Postgres unreachable through the API container: ${DB_OUT:0:300}"

# ---------------------------------------------------------------------------
# 4. Free disk
# ---------------------------------------------------------------------------
[ -d "$DISK_PATH" ] || fail "DISK_PATH does not exist: $DISK_PATH"
DISK_STATS="$(df -Pk "$DISK_PATH" 2>/dev/null | awk 'NR==2 {print $2, $4}')"
[ -n "$DISK_STATS" ] || fail "df failed for $DISK_PATH"
DISK_TOTAL="${DISK_STATS% *}"
DISK_AVAIL="${DISK_STATS#* }"
[ "${DISK_TOTAL:-0}" -gt 0 ] || fail "could not read total disk size for $DISK_PATH"
DISK_PCT=$(( DISK_AVAIL * 100 / DISK_TOTAL ))
if [ "$DISK_PCT" -le "$MIN_FREE_DISK_PCT" ]; then
  fail "disk free ${DISK_PCT}% (${DISK_AVAIL}KB of ${DISK_TOTAL}KB) at $DISK_PATH is <= ${MIN_FREE_DISK_PCT}%; backups and Postgres will fail soon"
fi

# ---------------------------------------------------------------------------
# 5. Free RAM
# ---------------------------------------------------------------------------
if [ -r /proc/meminfo ]; then
  MEM_TOTAL="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
  MEM_AVAIL="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
  if [ -n "${MEM_TOTAL:-}" ] && [ "${MEM_TOTAL:-0}" -gt 0 ] && [ -n "${MEM_AVAIL:-}" ]; then
    RAM_PCT=$(( MEM_AVAIL * 100 / MEM_TOTAL ))
    if [ "$RAM_PCT" -le "$MIN_FREE_RAM_PCT" ]; then
      fail "free RAM ${RAM_PCT}% (${MEM_AVAIL}KB available of ${MEM_TOTAL}KB) is <= ${MIN_FREE_RAM_PCT}%; the API/Postgres are at OOM risk"
    fi
  else
    log "WARN: could not parse /proc/meminfo; skipping RAM check."
  fi
else
  log "WARN: /proc/meminfo not available (not Linux?); skipping RAM check."
fi

log "OK: health, AI status, Postgres, disk (${DISK_PCT}% free), RAM all healthy."
push_up
exit 0
