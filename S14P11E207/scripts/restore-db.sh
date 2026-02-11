#!/bin/bash
# =============================================================================
# Database Restore Script
# =============================================================================
set -e

ENV=$1
BACKUP_FILE=$2

if [ -z "$ENV" ] || [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 [prod|dev] [backup_file]"
    echo ""
    echo "Example:"
    echo "  $0 prod backups/db/prod_backup_20260127_120000.sql.gz"
    exit 1
fi

if [ "$ENV" != "prod" ] && [ "$ENV" != "dev" ]; then
    echo "Error: Environment must be 'prod' or 'dev'"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "✗ Backup file not found: $BACKUP_FILE"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "============================================"
echo "  Database Restore - $ENV"
echo "============================================"
echo ""
echo "⚠️  WARNING: This will OVERWRITE the current database!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# MySQL 컨테이너 이름 (환경에 따라 다름)
if [ "$ENV" == "prod" ]; then
    MYSQL_CONTAINER="prod-mysql"
else
    MYSQL_CONTAINER="dev-mysql"
fi

if ! docker ps | grep -q "$MYSQL_CONTAINER"; then
    echo "✗ MySQL container not running!"
    exit 1
fi

# 환경 변수 파일 로드
if [ "$ENV" == "prod" ]; then
    ENV_FILE="$PROJECT_ROOT/.env.prod"
else
    ENV_FILE="$PROJECT_ROOT/.env.dev"
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "✗ Environment file not found: $ENV_FILE"
    exit 1
fi

# .env 파일에서 DB 정보 읽기
source "$ENV_FILE"

# 백업 파일 압축 해제 (필요한 경우)
TEMP_FILE="/tmp/restore_$(date +%s).sql"

if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo ""
    echo "[1/3] Decompressing backup..."
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
else
    cp "$BACKUP_FILE" "$TEMP_FILE"
fi

# 데이터베이스 복원
echo ""
echo "[2/3] Restoring database..."
docker exec -i "$MYSQL_CONTAINER" mysql \
    -u"$MYSQL_USER" \
    -p"$MYSQL_PASSWORD" \
    "$MYSQL_DATABASE" < "$TEMP_FILE"

# 임시 파일 삭제
echo ""
echo "[3/3] Cleaning up..."
rm -f "$TEMP_FILE"

echo ""
echo "============================================"
echo "  ✓ Restore completed"
echo "============================================"
