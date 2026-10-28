#!/usr/bin/env bash
# ==============================================================================
# Proton — One-command dev setup
# ==============================================================================
# Usage:  git clone <repo> && cd proton && ./scripts/setup.sh
#
# This script gets a teammate from "just cloned" to "ready to work" in one run.
# It downloads third-party dependencies, sets up the environment file, installs
# node modules, and optionally boots the Docker stack.
# ==============================================================================

set -euo pipefail

PROTON_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROTON_ROOT"

# Colours for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[setup]${NC} $*"; }
warn()  { echo -e "${YELLOW}[setup]${NC} $*"; }
err()   { echo -e "${RED}[setup]${NC} $*" >&2; }

# --------------------------------------------------------------------------
# 1. Environment file
# --------------------------------------------------------------------------
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    info "Created .env from .env.example — fill in your API keys before running."
  else
    warn "No .env.example found. You'll need to create .env manually."
  fi
else
  info ".env already exists, skipping."
fi

# --------------------------------------------------------------------------
# 2. Node dependencies
# --------------------------------------------------------------------------
info "Installing Node dependencies..."
if command -v npm &>/dev/null; then
  npm install
  info "Node dependencies installed."
else
  err "npm not found. Install Node.js 20+ first: https://nodejs.org"
  exit 1
fi

# --------------------------------------------------------------------------
# 3. Third-party dependencies (downloaded, not committed)
# --------------------------------------------------------------------------
VENDOR_DIR="$PROTON_ROOT"

download_and_extract() {
  local name="$1"
  local dir="$2"
  local url="$3"

  if [ -d "$VENDOR_DIR/$dir" ]; then
    info "$name already present at $dir, skipping."
    return
  fi

  info "Downloading $name..."
  local tmpfile
  tmpfile=$(mktemp /tmp/proton-vendor-XXXXXX.zip)

  if curl -fSL --progress-bar "$url" -o "$tmpfile"; then
    unzip -q "$tmpfile" -d "$VENDOR_DIR/"
    rm -f "$tmpfile"
    info "$name ready at $dir"
  else
    warn "Could not download $name — you can get it manually from: $url"
    rm -f "$tmpfile"
  fi
}

# Medplum FHIR server (reference source)
download_and_extract "Medplum" "medplum-main" \
  "https://github.com/medplum/medplum/archive/refs/heads/main.zip"

# pgvector — Postgres vector extension (reference source)
download_and_extract "pgvector" "pgvector-master" \
  "https://github.com/pgvector/pgvector/archive/refs/heads/master.zip"

# Whisper — speech recognition (reference source)
download_and_extract "Whisper" "whisper-main" \
  "https://github.com/openai/whisper/archive/refs/heads/main.zip"

# Tesseract — OCR engine (reference source)
download_and_extract "Tesseract" "tesseract-main" \
  "https://github.com/tesseract-ocr/tesseract/archive/refs/heads/main.zip"

# --------------------------------------------------------------------------
# 4. Android setup check
# --------------------------------------------------------------------------
if [ -d "$PROTON_ROOT/apps/dork-android" ]; then
  if command -v java &>/dev/null; then
    info "Java found. To build the Android app: cd apps/dork-android && ./gradlew assembleDebug"
  else
    warn "Java not found. Install JDK 17+ to build the Android app."
  fi
fi

# --------------------------------------------------------------------------
# 5. Docker stack (optional)
# --------------------------------------------------------------------------
if command -v docker &>/dev/null && command -v docker compose &>/dev/null; then
  echo ""
  read -p "$(echo -e "${GREEN}[setup]${NC} Start Docker stack (Postgres + API)? [y/N] ")" -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    info "Booting Docker stack..."
    docker compose up -d --build postgres api
    info "Docker stack running. API at http://localhost:3002"
  else
    info "Skipped Docker. Run 'docker compose up -d' when ready."
  fi
else
  warn "Docker not found. Install Docker Desktop to run the full stack."
fi

# --------------------------------------------------------------------------
# Done
# --------------------------------------------------------------------------
echo ""
info "============================================"
info "  Proton dev environment ready!"
info "============================================"
info ""
info "  Next steps:"
info "  1. Edit .env with your API keys"
info "  2. docker compose up -d       (start the stack)"
info "  3. cd apps/web && npm run dev  (start the web app)"
info "  4. Open DeepSeek Harness pointed at this directory"
info ""
info "  Android:  cd apps/dork-android && ./gradlew assembleDebug"
info "  Tests:    cd apps/api && node tests/run-deterministic-suite.cjs"
info ""
