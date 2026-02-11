#!/bin/bash
# =============================================================================
# Blue 환경 배포 스크립트
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "============================================"
echo "  Blue Environment Deployment"
echo "============================================"

# 1. 현재 디렉토리로 이동
cd "$BACKEND_DIR"

# 2. Blue 컨테이너 중지
echo ""
echo "[1/5] Stopping Blue container..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop prod-was-blue || true

# 3. 최신 코드로 이미지 빌드
echo ""
echo "[2/5] Building new Blue image..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml build prod-was-blue

# 4. Blue 컨테이너 시작
echo ""
echo "[3/5] Starting Blue container..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d prod-was-blue

# 5. Health Check 대기
echo ""
echo "[4/5] Waiting for Blue health check..."
RETRY_COUNT=0
MAX_RETRIES=30

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker exec prod-was-blue curl -f http://localhost:8081/actuator/health > /dev/null 2>&1; then
        echo "✓ Blue is healthy!"
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "✗ Blue health check failed!"
    echo "Deployment failed. Check logs with: docker compose logs prod-was-blue"
    exit 1
fi

# 6. 배포 완료
echo ""
echo "[5/5] Deployment complete!"
echo "============================================"
echo "  Blue is ready to receive traffic"
echo "  Run: make switch-blue"
echo "============================================"
