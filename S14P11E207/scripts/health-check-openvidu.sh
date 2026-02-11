#!/bin/bash
# =============================================================================
# OpenVidu Health Check 스크립트
# =============================================================================
# 사용법: ./health-check-openvidu.sh
# =============================================================================

set -e

OPENVIDU_PATH=${OPENVIDU_PATH:-/opt/openvidu}
MAX_RETRIES=${1:-30}
RETRY_INTERVAL=${2:-2}

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}OpenVidu Health Check...${NC}"
echo "Path: ${OPENVIDU_PATH}"
echo "Max retries: ${MAX_RETRIES}, Interval: ${RETRY_INTERVAL}s"

# OpenVidu 경로 확인
if [ ! -d "$OPENVIDU_PATH" ]; then
    echo -e "${RED}OpenVidu not found at ${OPENVIDU_PATH}${NC}"
    exit 1
fi

cd "$OPENVIDU_PATH"

for i in $(seq 1 $MAX_RETRIES); do
    echo -n "Attempt $i/$MAX_RETRIES: "

    # OpenVidu 컨테이너들이 모두 healthy 상태인지 확인
    if sudo docker compose ps --format json 2>/dev/null | grep -q "running"; then
        # 모든 컨테이너가 healthy 또는 running 상태인지 확인
        UNHEALTHY=$(sudo docker compose ps --format json 2>/dev/null | grep -c "unhealthy" || true)

        if [ "$UNHEALTHY" -eq 0 ]; then
            echo -e "${GREEN}SUCCESS${NC}"
            echo -e "${GREEN}OpenVidu is healthy and ready!${NC}"
            exit 0
        else
            echo -e "${RED}Some containers are unhealthy${NC}"
        fi
    else
        echo -e "${RED}OpenVidu is not running${NC}"
    fi

    if [ $i -lt $MAX_RETRIES ]; then
        sleep $RETRY_INTERVAL
    fi
done

echo -e "${RED}OpenVidu health check failed after ${MAX_RETRIES} attempts${NC}"
exit 1
