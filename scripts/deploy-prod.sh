#!/bin/bash
# =============================================================================
# Production Auto-Switch Deployment Script (Blue/Green)
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_CONF_DIR="$SCRIPT_DIR/../infra/nginx-proxy/conf.d"

echo "============================================"
echo "  Production Auto-Deployment (Blue/Green)"
echo "============================================"

# 1. 현재 Active 환경 확인 (Symlink 확인)
# upstream.blue.conf가 active라면 현재는 Blue
if [ -L "$NGINX_CONF_DIR/upstream.active.conf" ]; then
    CURRENT_TARGET=$(readlink "$NGINX_CONF_DIR/upstream.active.conf")
    if [[ "$CURRENT_TARGET" == *"blue"* ]]; then
        ACTIVE_ENV="blue"
        TARGET_ENV="green"
    else
        ACTIVE_ENV="green"
        TARGET_ENV="blue"
    fi
else
    # Symlink가 없다면 초기 상태로 간주 (Blue 배포 권장)
    echo "⚠️  No active upstream found. Defaulting to Blue deployment."
    ACTIVE_ENV="none"
    TARGET_ENV="blue"
fi

echo "Current Active: $ACTIVE_ENV"
echo "Deploy Target:  $TARGET_ENV"
echo "--------------------------------------------"

# 2. Target 환경 배포 (backend only)
if [ "$TARGET_ENV" == "blue" ]; then
    "$SCRIPT_DIR/deploy-blue.sh"
else
    "$SCRIPT_DIR/deploy-green.sh"
fi

# 3. Traffic Switch
echo "--------------------------------------------"
echo "Switching traffic to $TARGET_ENV..."
"$SCRIPT_DIR/switch-upstream.sh" "$TARGET_ENV"

echo "============================================"
echo "  🚀 Production Deployment Complete ($TARGET_ENV)"
echo "============================================"
