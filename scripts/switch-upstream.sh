#!/bin/bash
# =============================================================================
# Nginx Upstream 전환 스크립트 (Blue/Green Deployment)
# =============================================================================
#
# 📋 개요:
#   - Production WAS의 Blue/Green 트래픽 전환
#   - nginx.conf의 prod-was upstream 설정 변경
#   - Nginx 설정 검증 후 자동 reload
#
# 🚀 사용법:
#   ./scripts/switch-upstream.sh blue   # Blue로 전환
#   ./scripts/switch-upstream.sh green  # Green으로 전환
#
# =============================================================================
set -e

TARGET=$1

# -----------------------------------------------------------------------
# 입력 검증
# -----------------------------------------------------------------------
if [ -z "$TARGET" ]; then
    echo "Usage: $0 [blue|green]"
    exit 1
fi

if [ "$TARGET" != "blue" ] && [ "$TARGET" != "green" ]; then
    echo "Error: Target must be 'blue' or 'green'"
    exit 1
fi

# -----------------------------------------------------------------------
# 경로 설정
# -----------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NGINX_CONF="$PROJECT_ROOT/infra/nginx-proxy/nginx.conf"

echo "============================================"
echo "  Switching Traffic to $TARGET"
echo "============================================"

# -----------------------------------------------------------------------
# Step 1: 백업 생성
# -----------------------------------------------------------------------
echo ""
echo "[1/5] Creating backup..."
BACKUP_FILE="$NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)"
cp "$NGINX_CONF" "$BACKUP_FILE"
echo "  Backup: $BACKUP_FILE"

# -----------------------------------------------------------------------
# Step 2: Upstream 설정 변경
# -----------------------------------------------------------------------
echo ""
echo "[2/5] Updating upstream configuration..."

if [ "$TARGET" == "blue" ]; then
    # Blue 활성화, Green 비활성화
    echo "  Activating Blue (prod-was-blue:8081)"
    sed -i 's/^[[:space:]]*# server prod-was-blue:8081;/        server prod-was-blue:8081;/' "$NGINX_CONF"
    sed -i 's/^[[:space:]]*server prod-was-green:8082;/        # server prod-was-green:8082;/' "$NGINX_CONF"
else
    # Green 활성화, Blue 비활성화
    echo "  Activating Green (prod-was-green:8082)"
    sed -i 's/^[[:space:]]*server prod-was-blue:8081;/        # server prod-was-blue:8081;/' "$NGINX_CONF"
    sed -i 's/^[[:space:]]*# server prod-was-green:8082;/        server prod-was-green:8082;/' "$NGINX_CONF"
fi

# -----------------------------------------------------------------------
# Step 2.5: 설정을 컨테이너에 적용 (Jenkins 환경 대응)
# -----------------------------------------------------------------------
# Jenkins Workspace의 파일 수정본은 Host의 Bind Mount와 다를 수 있음
# 따라서 실행 중인 컨테이너에 직접 복사해야 함

echo ""
echo "[2.5/5] Copying config to Nginx container..."
# 컨테이너 이름 찾기 (아래 Step 3에서 확인하지만 복사를 위해 미리 필요할 수 있음, 
# 하지만 Step 3 로직을 활용하기 위해 아래에서 실행하는 것이 좋으나
# 구조상 Step 3에서 컨테이너 이름을 찾고 복사하는 것이 안전함.
# 따라서 여기서는 패스하고 Step 3/4 사이에 복사 로직 추가)

# -----------------------------------------------------------------------
# Step 3: Nginx 컨테이너 확인
# -----------------------------------------------------------------------
echo ""
echo "[3/5] Finding Nginx container..."

NGINX_CONTAINER=""
if docker ps --format '{{.Names}}' | grep -q "^nginx-proxy$"; then
    NGINX_CONTAINER="nginx-proxy"
elif docker ps --format '{{.Names}}' | grep -q "^nginx-prod$"; then
    NGINX_CONTAINER="nginx-prod"
elif docker ps --format '{{.Names}}' | grep -q "^nginx-dev$"; then
    NGINX_CONTAINER="nginx-dev"
fi

if [ -z "$NGINX_CONTAINER" ]; then
    echo "  ⚠️ Warning: Nginx container not running."
    echo "  Configuration updated, but not applied."
    echo ""
    echo "  To apply changes manually:"
    echo "    1. Start nginx container"
    echo "    2. Run: docker exec nginx-proxy nginx -s reload"
    exit 0
fi

echo "  Found: $NGINX_CONTAINER"

# -----------------------------------------------------------------------
# Step 3.5: 설정 파일 컨테이너로 복사
# -----------------------------------------------------------------------
echo "  -> Streaming config to $NGINX_CONTAINER:/etc/nginx/nginx.conf (Bind Mount Safe)"
cat "$NGINX_CONF" | docker exec -i "$NGINX_CONTAINER" sh -c 'cat > /etc/nginx/nginx.conf'

# -----------------------------------------------------------------------
# Step 4: Nginx 설정 검증
# -----------------------------------------------------------------------
echo ""
echo "[4/5] Validating Nginx configuration..."

if ! docker exec "$NGINX_CONTAINER" nginx -t 2>&1; then
    echo ""
    echo "❌ Nginx configuration is invalid!"
    echo "  Restoring backup..."
    cp "$BACKUP_FILE" "$NGINX_CONF"
    echo "  Restored: $BACKUP_FILE"
    exit 1
fi

echo "  ✓ Configuration valid"

# -----------------------------------------------------------------------
# Step 5: Nginx Reload
# -----------------------------------------------------------------------
echo ""
echo "[5/5] Reloading Nginx..."
docker exec "$NGINX_CONTAINER" nginx -s reload

# -----------------------------------------------------------------------
# 완료
# -----------------------------------------------------------------------
echo ""
echo "============================================"
echo "  ✓ Traffic switched to $TARGET"
echo "============================================"
echo ""
echo "Current prod-was upstream:"
grep -A 6 "upstream prod-was" "$NGINX_CONF" | head -8
echo ""
echo "Verify with: curl -I http://localhost/api/health"
