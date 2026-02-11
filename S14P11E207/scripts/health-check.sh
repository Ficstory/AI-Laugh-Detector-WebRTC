#!/bin/bash
# =============================================================================
# Health Check 스크립트
# =============================================================================
# 사용법: ./health-check.sh [서비스명] [포트]
#
# 예시:
#   ./health-check.sh prod-was-blue 8081   # Blue WAS (기본)
#   ./health-check.sh prod-was-green 8082  # Green WAS
#   ./health-check.sh dev-was 8080         # Dev WAS
# =============================================================================

set -e

SERVICE=${1:-"prod-was-blue"}
PORT=${2:-8081}
ENDPOINT=${3:-"/actuator/health"}
MAX_RETRIES=${4:-30}
RETRY_INTERVAL=${5:-2}

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Health check for ${SERVICE}:${PORT}${ENDPOINT}${NC}"
echo "Max retries: ${MAX_RETRIES}, Interval: ${RETRY_INTERVAL}s"

for i in $(seq 1 $MAX_RETRIES); do
    echo -n "Attempt $i/$MAX_RETRIES: "

    # Docker 네트워크 내에서 curl 실행
    if docker exec nginx-proxy curl -sf "http://${SERVICE}:${PORT}${ENDPOINT}" > /dev/null 2>&1; then
        echo -e "${GREEN}SUCCESS${NC}"
        echo -e "${GREEN}Service ${SERVICE} is healthy!${NC}"
        exit 0
    else
        echo -e "${RED}FAILED${NC}"
    fi

    if [ $i -lt $MAX_RETRIES ]; then
        sleep $RETRY_INTERVAL
    fi
done

echo -e "${RED}Health check failed after ${MAX_RETRIES} attempts${NC}"
exit 1

