#!/bin/bash
# =============================================================================
# Database Backup Script
# =============================================================================
set -e

ENV=$1

if [ -z "$ENV" ]; then
    echo "Usage: $0 [prod|dev]"
    exit 1
fi

if [ "$ENV" != "prod" ] && [ "$ENV" != "dev" ]; then
    echo "Error: Environment must be 'prod' or 'dev'"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/backups/db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${ENV}_backup_${TIMESTAMP}.sql"

# 백업 디렉토리 생성
mkdir -p "$BACKUP_DIR"

echo "============================================"
echo "  Database Backup - $ENV"
echo "============================================"

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

echo ""
echo "[1/2] Creating backup..."
docker exec "$MYSQL_CONTAINER" mysqldump \
    -u"$MYSQL_USER" \
    -p"$MYSQL_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    "$MYSQL_DATABASE" > "$BACKUP_FILE"

# 백업 파일 압축
echo ""
echo "[2/2] Compressing backup..."
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

# 백업 완료
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo ""
echo "============================================"
echo "  ✓ Backup completed"
echo "============================================"
echo "File: $BACKUP_FILE"
echo "Size: $BACKUP_SIZE"
echo ""
echo "To restore this backup, run:"
echo "  ./scripts/restore-db.sh $ENV $BACKUP_FILE"
echo "============================================"

# 30일 이상 된 백업 파일 삭제
echo ""
echo "Cleaning up old backups (older than 30 days)..."
find "$BACKUP_DIR" -name "${ENV}_backup_*.sql.gz" -mtime +30 -delete
echo "Done."
