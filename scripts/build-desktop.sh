#!/usr/bin/env bash
# build-desktop.sh — Build the Plumio desktop app for macOS and/or Windows.
#
# Usage:
#   ./scripts/build-desktop.sh          # build both (macOS only builds .dmg)
#   ./scripts/build-desktop.sh mac      # macOS .dmg only
#   ./scripts/build-desktop.sh win      # Windows .exe only (requires Wine or Windows)
#
# Output files will be in desktop/release/
#
# Prerequisites:
#   - Node.js 22+ and npm
#   - pnpm (for the frontend build)
#   - Run from the repository root

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET="${1:-all}"

echo "▶  Building Plumio desktop — target: $TARGET"
echo "   Repo root: $REPO_ROOT"
echo ""

# ── 1. Build frontend SPA ─────────────────────────────────────────────────────
echo "▶  Building frontend (SPA)..."
cd "$REPO_ROOT/frontend"
pnpm install --frozen-lockfile
pnpm build:desktop
echo "✅  Frontend built"
echo ""

# ── 2. Install backend deps (needed by esbuild for bundling) ──────────────────
echo "▶  Installing backend dependencies..."
cd "$REPO_ROOT/backend"
npm install
echo "✅  Backend deps installed"
echo ""

# ── 3. Install desktop deps ───────────────────────────────────────────────────
echo "▶  Installing desktop dependencies..."
cd "$REPO_ROOT/desktop"
npm install --ignore-scripts
echo "✅  Desktop deps installed"
echo ""

# ── 4. Build and package ──────────────────────────────────────────────────────
cd "$REPO_ROOT/desktop"

case "$TARGET" in
  mac)
    echo "▶  Packaging macOS .dmg..."
    npm run dist:mac
    echo ""
    echo "✅  macOS build complete:"
    ls -lh release/*.dmg 2>/dev/null || echo "   (no .dmg found — check above for errors)"
    ;;
  win)
    echo "▶  Packaging Windows .exe..."
    npm run dist:win
    echo ""
    echo "✅  Windows build complete:"
    ls -lh release/*.exe 2>/dev/null || echo "   (no .exe found — check above for errors)"
    ;;
  all)
    echo "▶  Packaging macOS .dmg..."
    npm run dist:mac
    echo ""
    echo "▶  Packaging Windows .exe..."
    npm run dist:win
    echo ""
    echo "✅  All builds complete:"
    ls -lh release/*.dmg release/*.exe 2>/dev/null || echo "   (check above for errors)"
    ;;
  *)
    echo "Unknown target: $TARGET (use 'mac', 'win', or 'all')"
    exit 1
    ;;
esac

echo ""
echo "📦  Release files are in: $REPO_ROOT/desktop/release/"
