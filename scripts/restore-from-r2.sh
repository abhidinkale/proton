#!/usr/bin/env bash
# =============================================================================
# Proton restore drill — download a dump and restore it into a SCRATCH database
# =============================================================================
# SAFETY GUARANTEE
# ----------------
# This script NEVER connects pg_restore to the live database. It:
#   1. derives a scratch name of the form proton_restore_YYYYMMDD_HHMMSS,
#   2. validates that name against ^proton_restore_[0-9]{8}_[0-9]{6}$,
#   3. refuses to continue if it equals POSTGRES_DB,
#   4. only ever issues CREATE DATABASE / pg_restore / DROP DATABASE against
#      that scratch name (connecting to the `postgres` maintenance DB).
# It is therefore safe to run against production. The only shared resource is
# CPU/IO and Postgres connections; run it outside peak hours.
#
# What it proves:
#   - the object is readable from R2 and decryptable with your key,
#   - pg_restore accepts the dump on a clean Postgres 16,
#   - the key tables exist and their row counts are readable,
#   - the workflow migrations (schema_migrations) are present.
#
# Usage:
#   ./scripts/restore-from-r2.sh --latest
#   ./scripts/restore-from-r2.sh proton-20261026T031500Z.dump.age
#   ./scripts/restore-from-r2.sh --latest --keep    # leave scratch DB for poking
#
# The scratch DB is dropped on success unless --keep. On failure it is KEPT
# and its name is printed so you can inspect it.
#
# Dependencies: docker (compose v2), rclone. For encrypted dumps: age or gpg.
# age private key: BACKUP_AGE_IDENTITY must point at the identity file. Keep
# that file off the production VM; copy it over only for the drill.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/deploy/.env.deploy}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/deploy/docker-compose.free.yml}"

KEEP=0
DUMP_NAME=""
LATEST=0

usage() {
  sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
}

die() {
  log "FATAL: $*"
  exit 1
}

for arg in "$@"; do
  case "$arg" in
    --latest) LATEST=1 ;;
    --keep) KEEP=1 ;;
    -h|--help) usage 0 ;;
    --*) die "unknown option: $arg (see --help)" ;;
    *)
      [ -z "$DUMP_NAME" ] || die "only one dump name may be supplied"
      DUMP_NAME="$arg"
      ;;
  esac
done

if [ "$LATEST" -eq 0 ] && [ -z "$DUMP_NAME" ]; then
  usage 1
fi
[ "$LATEST" -eq 1 ] && [ -n "$DUMP_NAME" ] && die "use either --latest or a dump name, not both"

for bin in docker rclone awk sed date; do
  command -v "$bin" >/dev/null 2>&1 || die "required command '$bin' is not installed"
done
docker compose version >/dev/null 2>&1 || die "docker compose v2 is not available"

[ -f "$ENV_FILE" ] || die "env file not found: $ENV_FILE"
# shellcheck source=/dev/null
set -a
. "$ENV_FILE"
set +a

[ -n "${BACKUP_S3_BUCKET:-}" ] || die "BACKUP_S3_BUCKET is unset"
[ -n "${BACKUP_S3_REMOTE:-}" ] || die "BACKUP_S3_REMOTE is unset (e.g. r2)"
[ -n "${POSTGRES_PASSWORD:-}" ] || die "POSTGRES_PASSWORD is unset in $ENV_FILE"

REMOTE="$BACKUP_S3_REMOTE"
BUCKET="$BACKUP_S3_BUCKET"
PREFIX="${BACKUP_S3_PREFIX:-backups}"
PREFIX="${PREFIX%/}"
PGUSER="${POSTGRES_USER:-proton}"
LIVE_DB="${POSTGRES_DB:-proton_ops}"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

# psql helper: always -v ON_ERROR_STOP=1 so SQL errors are fatal.
psql_db() {
  local db="$1"
  shift
  compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$db" "$@"
}

psql_val() {
  local db="$1"
  local sql="$2"
  compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$db" -tA -c "$sql" | tr -d '\r'
}

# ---------------------------------------------------------------------------
# 1. Find and download the dump
# ---------------------------------------------------------------------------
if [ "$LATEST" -eq 1 ]; then
  log "Finding latest dump under ${REMOTE}:${BUCKET}/${PREFIX}/ ..."
  DUMP_NAME="$(
    for sub in daily weekly monthly; do
      rclone lsf "${REMOTE}:${BUCKET}/${PREFIX}/${sub}" 2>/dev/null || true
    done \
      | grep -E '^proton-[0-9]{8}T[0-9]{6}Z\.dump(\.age|\.gpg)?$' \
      | sort \
      | tail -n 1
  )"
  [ -n "$DUMP_NAME" ] || die "no dumps found under ${REMOTE}:${BUCKET}/${PREFIX}/{daily,weekly,monthly}"
fi

# Reject path traversal / shell metacharacters before touching rclone.
case "$DUMP_NAME" in
  */*|*..*|*[\;\&\|\`\$\<\>]*) die "refusing suspicious dump name: $DUMP_NAME" ;;
esac
printf '%s' "$DUMP_NAME" | grep -Eq '^proton-[0-9]{8}T[0-9]{6}Z\.dump(\.age|\.gpg)?$' \
  || die "dump name must look like proton-YYYYMMDDTHHMMSSZ.dump[.age|.gpg]: $DUMP_NAME"

REMOTE_PATH=""
for sub in daily weekly monthly; do
  candidate="${REMOTE}:${BUCKET}/${PREFIX}/${sub}/${DUMP_NAME}"
  if [ -n "$(rclone lsf "$candidate" 2>/dev/null || true)" ]; then
    REMOTE_PATH="$candidate"
    break
  fi
done
[ -n "$REMOTE_PATH" ] || die "dump not found in daily/, weekly/, or monthly/: $DUMP_NAME"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/proton-restore.XXXXXX")"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT INT TERM

PAYLOAD="$TMP_DIR/$DUMP_NAME"
RAW="$TMP_DIR/${DUMP_NAME%.age}"
RAW="${RAW%.gpg}"

log "Downloading ${REMOTE_PATH} ..."
rclone copyto "$REMOTE_PATH" "$PAYLOAD" --retries 3 --low-level-retries 5 \
  || die "download failed: $REMOTE_PATH"
[ -s "$PAYLOAD" ] || die "downloaded file is empty: $PAYLOAD"

case "$DUMP_NAME" in
  *.age)
    command -v age >/dev/null 2>&1 || die "dump is age-encrypted but 'age' is not installed"
    [ -n "${BACKUP_AGE_IDENTITY:-}" ] || die "dump is age-encrypted but BACKUP_AGE_IDENTITY is unset"
    [ -f "$BACKUP_AGE_IDENTITY" ] || die "age identity not found: $BACKUP_AGE_IDENTITY"
    log "Decrypting with age ..."
    age --decrypt --identity "$BACKUP_AGE_IDENTITY" --output "$RAW" "$PAYLOAD" \
      || die "age decryption failed (wrong identity?)"
    ;;
  *.gpg)
    command -v gpg >/dev/null 2>&1 || die "dump is gpg-encrypted but 'gpg' is not installed"
    log "Decrypting with gpg ..."
    gpg --batch --yes --decrypt --output "$RAW" "$PAYLOAD" \
      || die "gpg decryption failed (missing private key?)"
    ;;
  *)
    RAW="$PAYLOAD"
    ;;
esac
[ -s "$RAW" ] || die "decrypted dump is empty"

# ---------------------------------------------------------------------------
# 2. Create the scratch database (never the live one)
# ---------------------------------------------------------------------------
SCRATCH_DB="proton_restore_$(date -u +%Y%m%d_%H%M%S)"

# Belt and braces: never allow a name that could be the live DB.
if ! [[ "$SCRATCH_DB" =~ ^proton_restore_[0-9]{8}_[0-9]{6}$ ]]; then
  die "refusing unsafe scratch database name: $SCRATCH_DB"
fi
[ "$SCRATCH_DB" != "$LIVE_DB" ] || die "scratch name equals live database '$LIVE_DB'; refusing"

log "Creating scratch database ${SCRATCH_DB} ..."
psql_db postgres -c "CREATE DATABASE ${SCRATCH_DB};" \
  || die "could not create scratch database ${SCRATCH_DB}"

RESTORE_OK=0
if compose exec -T postgres pg_restore \
      -U "$PGUSER" -d "$SCRATCH_DB" \
      --no-owner --no-privileges --exit-on-error < "$RAW"; then
  RESTORE_OK=1
else
  log "pg_restore FAILED. Scratch database ${SCRATCH_DB} is being kept for inspection."
fi

if [ "$RESTORE_OK" -ne 1 ]; then
  die "restore failed; inspect with: docker compose --env-file $ENV_FILE -f $COMPOSE_FILE exec postgres psql -U $PGUSER -d $SCRATCH_DB"
fi

# ---------------------------------------------------------------------------
# 3. Verify row counts
# ---------------------------------------------------------------------------
REQUIRED_TABLES="patients appointments encounters workflow_audit_events"
EXTRA_TABLES="schema_migrations operational_tasks operational_jobs operational_audit_events"

printf '\nRestore drill: %s\n' "$DUMP_NAME"
printf 'Scratch DB:    %s\n\n' "$SCRATCH_DB"
printf '%-30s %s\n' "TABLE" "ROWS"
printf '%-30s %s\n' "------------------------------" "----------"

MISSING_REQUIRED=0
ZERO_TOTAL=1

for table in $REQUIRED_TABLES $EXTRA_TABLES; do
  exists="$(psql_val "$SCRATCH_DB" "SELECT to_regclass('public.${table}') IS NOT NULL;")"
  if [ "$exists" = "t" ]; then
    count="$(psql_val "$SCRATCH_DB" "SELECT count(*) FROM ${table};")"
    printf '%-30s %s\n' "$table" "$count"
    [ "$count" = "0" ] || ZERO_TOTAL=0
  else
    printf '%-30s %s\n' "$table" "ABSENT"
    case " $REQUIRED_TABLES " in
      *" $table "*) MISSING_REQUIRED=1 ;;
    esac
  fi
done

printf '\n'
if [ "$MISSING_REQUIRED" -ne 0 ]; then
  log "VERIFICATION FAILED: one or more required tables are absent."
  log "Scratch database ${SCRATCH_DB} kept for inspection."
  exit 1
fi

SM_EXISTS="$(psql_val "$SCRATCH_DB" "SELECT to_regclass('public.schema_migrations') IS NOT NULL;")"
if [ "$SM_EXISTS" != "t" ]; then
  log "VERIFICATION FAILED: schema_migrations is absent; the dump is not a migrated Proton database."
  log "Scratch database ${SCRATCH_DB} kept for inspection."
  exit 1
fi

MAX_VERSION="$(psql_val "$SCRATCH_DB" "SELECT COALESCE(max(version), 0) FROM schema_migrations;")"
printf 'schema_migrations max version: %s\n' "$MAX_VERSION"
if [ "${MAX_VERSION:-0}" -lt 2 ]; then
  log "VERIFICATION FAILED: schema_migrations max version is ${MAX_VERSION:-0}, expected >= 2 (workflow migrations)."
  log "Scratch database ${SCRATCH_DB} kept for inspection."
  exit 1
fi

if [ "$ZERO_TOTAL" -eq 1 ]; then
  log "WARNING: every checked table is empty. The restore worked, but this dump looks like a fresh install."
fi

printf '\nAll required tables present. Restore drill PASSED.\n'

# ---------------------------------------------------------------------------
# 4. Drop scratch DB unless --keep
# ---------------------------------------------------------------------------
if [ "$KEEP" -eq 1 ]; then
  log "Keeping scratch database ${SCRATCH_DB} (--keep). To drop it later:"
  log "  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE exec postgres psql -U $PGUSER -d postgres -c 'DROP DATABASE ${SCRATCH_DB} WITH (FORCE);'"
else
  log "Dropping scratch database ${SCRATCH_DB} ..."
  psql_db postgres -c "DROP DATABASE ${SCRATCH_DB} WITH (FORCE);" \
    || die "scratch restore succeeded but DROP DATABASE ${SCRATCH_DB} failed"
  log "Dropped ${SCRATCH_DB}."
fi

log "OK: restore drill complete for ${DUMP_NAME}"
