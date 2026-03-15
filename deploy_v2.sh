#!/bin/bash
# ═══════════════════════════════════════════════
# AKYRA v2 Economy Deployment Script
# ═══════════════════════════════════════════════
# Uses tar+scp (no rsync needed on VPS)
# ═══════════════════════════════════════════════

set -e

VPS="lucasroncey@35.233.51.51"
SSH_KEY="$HOME/.ssh/google_compute_engine"
SSH="ssh -i $SSH_KEY $VPS"
SCP="scp -i $SSH_KEY"

echo "═══ AKYRA v2 Economy Deployment ═══"
echo ""

# ─── 1. Package and upload orchestrator ───
echo "[1/5] Packaging and uploading orchestrator..."
tar czf /tmp/akyra-orchestrator.tar.gz \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='celerybeat-schedule*' \
  --exclude='.env' \
  -C "$(pwd)" orchestrator/
$SCP /tmp/akyra-orchestrator.tar.gz $VPS:/tmp/
$SSH "mkdir -p ~/akyra && cd ~/akyra && tar xzf /tmp/akyra-orchestrator.tar.gz && rm /tmp/akyra-orchestrator.tar.gz"
rm /tmp/akyra-orchestrator.tar.gz
echo "  Done."

# ─── 2. Package and upload frontend ───
echo "[2/5] Packaging and uploading frontend..."
tar czf /tmp/akyra-frontend.tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.env.local' \
  -C "$(pwd)" frontend/
$SCP /tmp/akyra-frontend.tar.gz $VPS:/tmp/
$SSH "cd ~/akyra && tar xzf /tmp/akyra-frontend.tar.gz && rm /tmp/akyra-frontend.tar.gz"
rm /tmp/akyra-frontend.tar.gz
echo "  Done."

# ─── 3. Run DB migration ───
echo "[3/5] Running v2 DB migration..."
$SSH "cd ~/akyra/orchestrator && docker compose exec -T api python scripts/migrate_v2_economy.py"
echo "  Done."

# ─── 4. Rebuild and restart orchestrator ───
echo "[4/5] Rebuilding orchestrator Docker services..."
$SSH "cd ~/akyra/orchestrator && docker compose build && docker compose up -d"
echo "  Done."

# ─── 5. Build and deploy frontend ───
echo "[5/5] Building frontend on VPS..."
$SSH "cd ~/akyra/frontend && npm install && npm run build"
echo "  Done."

echo ""
echo "═══ Deployment complete! ═══"
echo "  API: https://api.akyra.io (or http://35.233.51.51:8000)"
echo "  Frontend: check your hosting config"
echo ""
echo "Verify:"
echo "  curl http://35.233.51.51:8000/health"
echo "  curl http://35.233.51.51:8000/api/governor/current"
