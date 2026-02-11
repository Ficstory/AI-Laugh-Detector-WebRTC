#!/bin/bash
# =============================================================================
# Frontend Deployment Script (Production)
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
ENV_FILE="$PROJECT_ROOT/.env.prod"

echo "============================================"
echo "  Frontend Production Deployment"
echo "============================================"

# .env.prod 존재 확인
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: .env.prod file not found in $PROJECT_ROOT"
    exit 1
fi

cd "$FRONTEND_DIR"

echo "[1/3] Stopping Frontend container..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" stop prod-frontend || true

echo ""
echo "[2/3] Building Frontend image (injecting envs)..."
# .env 파일이 있더라도 docker build 시에는 args로 명시적 전달이 필요할 수 있음
# docker-compose.prod.yml에서 args: - VITE_...=${VITE_...} 형태로 매핑되어 있으므로
# --env-file로 로드된 변수가 치환되어 전달됨.
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" build prod-frontend

echo ""
echo "[3/3] Starting Frontend container..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d prod-frontend

echo ""
echo "✅ Frontend Deployment Complete!"
