#!/usr/bin/env bash
# =============================================================================
# Proton PostgreSQL backup -> Cloudflare R2
# =============================================================================
# What it does, in order:
#   1. pg_dump -Fc (custom format; already compressed, so no gzip) out of the
#      running `postgres` compose service into a host temp dir.
#   2. Encrypt with age (preferred) or gpg when a recipient is configured.
#      If neither tool/key is available it warns loudly and uploads PLAINTEXT.
#   3. rclone copyto into  <remote>:<bucket>/<prefix>/daily/proton-<UTC>.dump[.age|.gpg]
#   4. Verify the remote object size equals the local size (3 attempts).
#      Only then is the local temp file removed.
#   5. On Sunday (UTC) also copy to weekly/; on the 1st (UTC) also to monthly/.
#   6. Retention (see also docs/BACKUP_AND_DISASTER_RECOVERY.md):
#        daily/   > 14 days deleted
#        weekly/  > 56 days deleted  (8 weekly snapshots)
#        monthly/ > 186 days deleted (6 monthly snapshots)
#   7. Append one JSON line to deploy/backups.log.
#
# Any failure exits non-zero so cron / UptimeRobot catches it.
#
# Dependencies: docker (compose v2), rclone, age or gpg (optional), flock
# (optional), awk/sed/date from coreutils.
#
# rclone install (Ubuntu/Debian):
#   sudo apt-get update && sudo apt-get install -y rclone
#   # newer build: curl https://rclone.org/install.sh | sudo bash
# Configure the remote once:
#   rclone config          # name it `r2`, storage `s3`, provider `Cloudflare`,
#                          # endpoint https://<account-id>.r2.cloudflarestorage.com
#   rclone lsd r2:
#
# age key handling (read this before enabling encryption):
#   age-keygen -o /root/proton-backup-age.key    # prints the public key
#   BACKUP_AGE_RECIPIENT=age1...                 # public key -> .env.deploy
#   BACKUP_AGE_IDENTITY=/root/proton-backup-age.key   # restore side only
#   Keep a copy of the PRIVATE key OFF the VM (password manager + printed
#   copy). If the VM dies and the only private key died with it, the backups
#   are unrecoverable.
#
# Cron (run as root or a user in the docker group):
#   15 3 * * * cd /opt/proton && ./scripts/backup-to-r2.sh \
#     >> /var/log/proton-backup.log 2>&1
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/deploy/.env.deploy}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/deploy/docker-compose.free.yml}"

START_EPOCH="$(date +%s)"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
BASE_NAME="proton-${TS}.dump"
DEST=""
BYTES=0
ENCRYPTION="none"

# LOG_FILE is set after sourcing the env file so BACKUP_LOG_FILE can override it.
LOG_FILE="$REPO_ROOT/deploy/backups.log"
TMP_DIR=""

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
}

# JSON-escape a message: backslash, double quote, and newlines.
json_safe() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/ }"
  s="${s//$'\r'/ }"
  printf '%s' "$s"
}

append_json() {
  local status="$1"
  local message="${2:-}"
  local duration=$(( $(date +%s) - START_EPOCH ))
  local safe
  safe="$(json_safe "$message")"
  mkdir -p "$(dirname -- "$LOG_FILE")" 2>/dev/null || true
  printf '{"timestamp":"%s","status":"%s","file":"%s","bytes":%s,"duration_seconds":%s,"remote":"%s","encryption":"%s","message":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "$status" \
    "$BASE_NAME" \
    "$BYTES" \
    "$duration" \
    "${DEST:-}" \
    "$ENCRYPTION" \
    "$safe" >> "$LOG_FILE" 2>/dev/null || {
      log "WARNING: could not append to $LOG_FILE (backup status is still reported by exit code)."
    }
}

die() {
  local message="$*"
  trap - ERR
  log "FATAL: $message"
  append_json "error" "$message"
  exit 1
}

cleanup() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}

on_err() {
  local code=$?
  trap - ERR
  die "unexpected failure (exit $code) at line $1"
}

trap cleanup EXIT
trap 'on_err $LINENO' ERR

# ---------------------------------------------------------------------------
# 0. Preconditions
# ---------------------------------------------------------------------------
for bin in docker rclone awk sed date; do
  command -v "$bin" >/dev/null 2>&1 || die "required command '$bin' is not installed"
done
docker compose version >/dev/null 2>&1 || die "docker compose v2 is not available"

[ -f "$ENV_FILE" ] || die "env file not found: $ENV_FILE (copy deploy/.env.deploy.example)"
# shellcheck source=/dev/null
set -a
. "$ENV_FILE"
set +a

[ -n "${BACKUP_S3_BUCKET:-}" ] || die "BACKUP_S3_BUCKET is unset; refusing to run"
[ -n "${BACKUP_S3_REMOTE:-}" ] || die "BACKUP_S3_REMOTE is unset; refusing to run (e.g. r2)"
[ -n "${POSTGRES_PASSWORD:-}" ] || die "POSTGRES_PASSWORD is unset in $ENV_FILE"

# Optional override; keep the default repo-relative path otherwise.
if [ -n "${BACKUP_LOG_FILE:-}" ]; then
  LOG_FILE="$BACKUP_LOG_FILE"
fi

REMOTE="$BACKUP_S3_REMOTE"
BUCKET="$BACKUP_S3_BUCKET"
PREFIX="${BACKUP_S3_PREFIX:-backups}"
PREFIX="${PREFIX%/}"
PGUSER="${POSTGRES_USER:-proton}"
PGDB="${POSTGRES_DB:-proton_ops}"
DAYS="${BACKUP_RETENTION_DAYS:-14}"
WEEKS="${BACKUP_RETENTION_WEEKS:-8}"
MONTHS="${BACKUP_RETENTION_MONTHS:-6}"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

# One backup at a time. If flock is unavailable (e.g. macOS dev), continue:
# the worst case is two cron runs overlapping.
if command -v flock >/dev/null 2>&1; then
  LOCK_FILE="${TMPDIR:-/tmp}/proton-backup.lock"
  exec 9>"$LOCK_FILE"
  flock -n 9 || die "another backup is already running (lock: $LOCK_FILE)"
fi

log "Checking rclone remote ${REMOTE}:${BUCKET} ..."
rclone lsf "${REMOTE}:${BUCKET}" --max-depth 1 >/dev/null 2>&1 \
  || die "rclone cannot list ${REMOTE}:${BUCKET}; run 'rclone lsd ${REMOTE}:' and check BACKUP_S3_* / RCLONE_CONFIG_*"

# ---------------------------------------------------------------------------
# 1. Dump
# ---------------------------------------------------------------------------
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/proton-backup.XXXXXX")"
RAW="$TMP_DIR/$BASE_NAME"
PAYLOAD="$RAW"

log "Dumping ${PGDB} as ${PGUSER} (custom format) ..."
# NOTE: pg_dump connects over the container's local socket inside postgres,
# so no password is placed on the command line or in logs.
if ! compose exec -T postgres pg_dump -U "$PGUSER" -d "$PGDB" -Fc --no-owner --no-privileges > "$RAW"; then
  die "pg_dump failed for database ${PGDB}"
fi
[ -s "$RAW" ] || die "pg_dump produced an empty file; refusing to upload"

# ---------------------------------------------------------------------------
# 1b. Legacy desk store archive (P0.1b)
# ---------------------------------------------------------------------------
SQLITE_DB="${PROTON_DB_PATH:-$REPO_ROOT/data/proton_ops.db}"
if [ -f "$SQLITE_DB" ]; then
  log "Archiving legacy desk store ($SQLITE_DB) into backup bundle as LEGACY_DESK_TEMP.db ..."
  TAR_BUNDLE="$TMP_DIR/${BASE_NAME}.tar"
  cp "$SQLITE_DB" "$TMP_DIR/LEGACY_DESK_TEMP.db"
  tar -C "$TMP_DIR" -cf "$TAR_BUNDLE" "$BASE_NAME" "LEGACY_DESK_TEMP.db"
  RAW="$TAR_BUNDLE"
  PAYLOAD="$RAW"
fi

# ---------------------------------------------------------------------------
# 2. Encryption (age preferred, then gpg; otherwise loud warning)
# ---------------------------------------------------------------------------
encrypt_payload() {
  if command -v age >/dev/null 2>&1 && [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
    log "Encrypting with age ..."
    age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "${RAW}.age" "$RAW"
    PAYLOAD="${RAW}.age"
    ENCRYPTION="age"
    rm -f "$RAW"
    return
  fi

  if command -v gpg >/dev/null 2>&1 && [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
    log "Encrypting with gpg ..."
    gpg --batch --yes --trust-model always \
      --encrypt --recipient "$BACKUP_GPG_RECIPIENT" \
      --output "${RAW}.gpg" "$RAW"
    PAYLOAD="${RAW}.gpg"
    ENCRYPTION="gpg"
    rm -f "$RAW"
    return
  fi

  # This is intentionally loud: an unencrypted clinical backup in object
  # storage is a reportable event in most real deployments.
  ENCRYPTION="none"
  log "############################################################"
  log "# WARNING: DUMP IS NOT ENCRYPTED                          #"
  log "# No usable age/gpg recipient was configured.             #"
  log "# Set BACKUP_AGE_RECIPIENT (recommended) and re-run.      #"
  log "############################################################"
}
encrypt_payload

BYTES="$(wc -c < "$PAYLOAD" | tr -d ' ')"
[ "$BYTES" -gt 0 ] || die "payload is empty; refusing to upload"

# ---------------------------------------------------------------------------
# 3. Upload + size verification
# ---------------------------------------------------------------------------
OBJECT_NAME="$(basename -- "$PAYLOAD")"
DEST="${REMOTE}:${BUCKET}/${PREFIX}/daily/${OBJECT_NAME}"

log "Uploading ${BYTES} bytes to ${DEST} ..."
rclone copyto "$PAYLOAD" "$DEST" --retries 3 --low-level-retries 5 \
  || die "rclone copyto failed for ${DEST}"

remote_size() {
  rclone lsjson --stat "$1" 2>/dev/null \
    | sed -n 's/.*"Size":\([0-9][0-9]*\).*/\1/p'
}

REMOTE_BYTES=""
for attempt in 1 2 3; do
  REMOTE_BYTES="$(remote_size "$DEST" || true)"
  if [ "$REMOTE_BYTES" = "$BYTES" ]; then
    break
  fi
  log "Size verification attempt ${attempt}/3: remote=${REMOTE_BYTES:-unknown} local=${BYTES}"
  sleep 2
done

if [ "${REMOTE_BYTES:-}" != "$BYTES" ]; then
  # Preserve the local dump for diagnosis instead of deleting it in cleanup.
  trap - EXIT
  die "remote size mismatch for ${DEST} (remote=${REMOTE_BYTES:-unknown}, local=${BYTES}); local dump kept at $PAYLOAD"
fi

log "Verified remote size (${BYTES} bytes). Removing local temp copy."

# ---------------------------------------------------------------------------
# 4. Promotion + retention
# ---------------------------------------------------------------------------
# Sunday (UTC) -> weekly snapshot. 1st of month (UTC) -> monthly snapshot.
if [ "$(date -u +%u)" = "7" ]; then
  WEEKLY="${REMOTE}:${BUCKET}/${PREFIX}/weekly/${OBJECT_NAME}"
  log "Sunday: promoting to ${WEEKLY}"
  rclone copyto "$DEST" "$WEEKLY" --retries 3 --low-level-retries 5 \
    || die "weekly promotion failed for ${WEEKLY}"
fi

if [ "$(date -u +%d)" = "01" ]; then
  MONTHLY="${REMOTE}:${BUCKET}/${PREFIX}/monthly/${OBJECT_NAME}"
  log "First of month: promoting to ${MONTHLY}"
  rclone copyto "$DEST" "$MONTHLY" --retries 3 --low-level-retries 5 \
    || die "monthly promotion failed for ${MONTHLY}"
fi

WEEK_DAYS=$(( WEEKS * 7 ))
MONTH_DAYS=$(( MONTHS * 31 ))

# Prune one prefix. Skip empty prefixes instead of failing: on a fresh bucket
# weekly/ and monthly/ do not exist until the first Sunday / 1st of the month.
prune() {
  local dir="$1"
  local days="$2"
  local label="$3"
  if [ -z "$(rclone lsf "$dir" --max-depth 1 2>/dev/null || true)" ]; then
    log "Retention: ${label} is empty; nothing to prune"
    return 0
  fi
  log "Retention: deleting ${label} objects older than ${days}d"
  rclone delete "$dir" --min-age "${days}d" --include "proton-*.dump*" --rmdirs \
    || die "${label} retention pass failed"
}

prune "${REMOTE}:${BUCKET}/${PREFIX}/daily" "$DAYS" "daily"
prune "${REMOTE}:${BUCKET}/${PREFIX}/weekly" "$WEEK_DAYS" "weekly"
prune "${REMOTE}:${BUCKET}/${PREFIX}/monthly" "$MONTH_DAYS" "monthly"

append_json "ok" "backup uploaded, size verified, retention applied"
log "OK: ${DEST} (${BYTES} bytes, ${ENCRYPTION})"
