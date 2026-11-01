#!/usr/bin/env bash
# verify-vertical-slice.sh
# Complete quality and safety gate runner for Proton vertical slice

set -e

echo "========================================================"
echo "  PROTON VERTICAL SLICE QUALITY & SAFETY VERIFICATION   "
echo "========================================================"

echo ""
echo "▶ 1/3 Checking Regulatory & Claims Boundary..."
node scripts/check-claims.js

echo ""
echo "▶ 2/3 Running Hermetic Deterministic Clinical Safety Suite..."
npm --prefix apps/api test

echo ""
echo "▶ 3/3 Building Web Client..."
npm --prefix apps/web run build

echo ""
echo "========================================================"
echo "  ✓ ALL VERTICAL SLICE GATES VERIFIED SUCCESSFULLY       "
echo "========================================================"
