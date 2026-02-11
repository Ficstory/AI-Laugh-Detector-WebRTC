# =============================================================================
# Makefile - 운영 명령어 집합 (ADR#003 기준)
# =============================================================================
#
# 📋 아키텍처 개요:
#   - Stateful (Data): MySQL, Redis, MinIO → 거의 재시작 안함
#   - Stateless (App): WAS, Frontend → 배포 시마다 재시작
#   - 분리 목적: App 배포 시 DB 영향 없음
#
# 🚀 서비스 시작 순서:
#   1. make data-prod-up    # 먼저 Data 서비스 + 네트워크 생성
#   2. make infra-up        # Jenkins, Nginx Proxy 실행
#   3. make prod-app-up     # WAS, Frontend 배포
#   4. make monitoring-up   # (선택) PLG Stack 실행
#
# ⚠️ 주의사항:
#   - make prod-app-down 해도 DB는 중단되지 않음 (의도된 동작)
#   - DB 중단 시 반드시 make data-prod-down 사용
#
# =============================================================================

# OpenVidu 설치 경로 (환경변수로 오버라이드 가능)
OPENVIDU_PATH ?= /opt/openvidu

# 환경 변수 파일 경로
ENV_PROD = --env-file ../.env.prod
ENV_DEV = --env-file ../.env.dev

.PHONY: help \
        data-prod-up data-prod-down data-dev-up data-dev-down \
        infra-up infra-down jenkins-up jenkins-logs jenkins-password \
        prod-app-up prod-app-down dev-app-up dev-app-down \
        monitoring-up monitoring-down \
        openvidu-up openvidu-down openvidu-status openvidu-logs \
        deploy-blue deploy-green switch-blue switch-green \
        backup-prod backup-dev restore-prod restore-dev \
        logs-jenkins logs-nginx logs-was-blue logs-was-green \
        clean clean-all status

# =============================================================================
# 기본 명령어 - 도움말
# =============================================================================
help:
	@echo "=============================================="
	@echo "  Smile Battle - 운영 명령어 (ADR#003)"
	@echo "=============================================="
	@echo ""
	@echo "  📦 Data Services (Stateful - 거의 재시작 안함):"
	@echo "    make data-prod-up    - Production DB 시작 (MySQL, Redis, MinIO)"
	@echo "    make data-prod-down  - Production DB 중지 ⚠️"
	@echo "    make data-dev-up     - Development DB 시작"
	@echo "    make data-dev-down   - Development DB 중지"
	@echo ""
	@echo "  🔧 Infrastructure:"
	@echo "    make infra-up        - Jenkins + Nginx Proxy 시작"
	@echo "    make infra-down      - Infrastructure 중지"
	@echo "    make jenkins-password - Jenkins 초기 비밀번호 확인"
	@echo ""
	@echo "  🏠 Local Development (All-in-One):"
	@echo "    make local-up        - 로컬 개발 환경 시작 (DB+WAS)"
	@echo "    make local-down      - 로컬 개발 환경 중지"
	@echo ""
	@echo "  🚀 Application Services (Stateless - 배포 시 재시작):"
	@echo "    make prod-app-up     - Production App 배포 (WAS + Frontend)"
	@echo "    make prod-app-down   - Production App 중지 (DB 영향 없음 ✅)"
	@echo "    make dev-app-up      - Development App 배포 (AWS/DevServer용)"
	@echo "    make dev-app-down    - Development App 중지"
	@echo ""
	@echo "  📊 Monitoring (Production Only):"
	@echo "    make monitoring-up   - PLG Stack 시작 (Loki, Grafana)"
	@echo "    make monitoring-down - Monitoring 중지"
	@echo ""
	@echo "  🎥 OpenVidu:"
	@echo "    make openvidu-up     - OpenVidu 서버 시작"
	@echo "    make openvidu-down   - OpenVidu 서버 중지"
	@echo "    make openvidu-status - OpenVidu 상태 확인"
	@echo ""
	@echo "  🔄 Blue/Green Deployment:"
	@echo "    make deploy-blue     - Blue 환경 배포"
	@echo "    make deploy-green    - Green 환경 배포"
	@echo "    make switch-blue     - Blue로 트래픽 전환"
	@echo "    make switch-green    - Green으로 트래픽 전환"
	@echo ""
	@echo "  💾 Backup:"
	@echo "    make backup-prod     - Production DB 백업"
	@echo "    make backup-dev      - Development DB 백업"
	@echo ""
	@echo "  📋 Status & Logs:"
	@echo "    make status          - 전체 서비스 상태 확인"
	@echo "    make logs-jenkins    - Jenkins 로그"
	@echo "    make logs-nginx      - Nginx 로그"
	@echo "    make logs-was-blue   - WAS Blue 로그"
	@echo ""
	@echo "=============================================="

# =============================================================================
# Data Services (Stateful) - 네트워크 생성 포함
# =============================================================================
# ⚠️ 이 서비스들은 거의 재시작하지 않습니다!
# prod-net, dev-net 네트워크도 여기서 생성됩니다.
# =============================================================================

data-prod-up:
	@echo "=============================================="
	@echo "  Starting Production Data Services..."
	@echo "  (MySQL, Redis, MinIO + prod-net)"
	@echo "=============================================="
	cd infra && docker compose -f docker-compose.data.prod.yml $(ENV_PROD) up -d
	@echo ""
	@echo "✅ Production Data Services started!"
	@echo "   Network: prod-net (Dynamic IP - Use Hostnames)"

data-prod-down:
	@echo "=============================================="
	@echo "  ⚠️  WARNING: Stopping Production DB!"
	@echo "=============================================="
	@read -p "Are you sure? (yes/no): " confirm && [ "$$confirm" = "yes" ] && \
		cd infra && docker compose -f docker-compose.data.prod.yml $(ENV_PROD) down || \
		echo "Cancelled."

data-dev-up:
	@echo "=============================================="
	@echo "  Starting Development Data Services..."
	@echo "  (MySQL, Redis, MinIO + dev-net)"
	@echo "=============================================="
	cd infra && docker compose -f docker-compose.data.dev.yml $(ENV_DEV) up -d
	@echo ""
	@echo "✅ Development Data Services started!"
	@echo "   Network: dev-net (Dynamic IP - Use Hostnames)"

data-dev-down:
	@echo "Stopping Development Data Services..."
	cd infra && docker compose -f docker-compose.data.dev.yml down

# =============================================================================
# Infrastructure (Jenkins + Nginx)
# =============================================================================
# prod-net, dev-net이 먼저 생성되어 있어야 합니다.
# =============================================================================

# =============================================================================
# Helper Commands
# =============================================================================



copy-certs:
	@echo "=============================================="
	@echo "  Copying SSL Certificates..."
	@echo "=============================================="
	@mkdir -p infra/nginx-proxy/ssl
	@sudo cp -L /etc/letsencrypt/live/i14e207.p.ssafy.io/fullchain.pem infra/nginx-proxy/ssl/ || echo "⚠️  Warning: SSL cert not found (Skip if local)"
	@sudo cp -L /etc/letsencrypt/live/i14e207.p.ssafy.io/privkey.pem infra/nginx-proxy/ssl/ || echo "⚠️  Warning: SSL key not found (Skip if local)"
	@sudo chmod 644 infra/nginx-proxy/ssl/*.pem || true
	@echo "✅ SSL Certificates copied!"

infra-up: copy-certs
	@echo "=============================================="
	@echo "  Starting Infrastructure..."
	@echo "  (Jenkins + Nginx Proxy)"
	@echo "=============================================="
	@# 네트워크 확인 (prod-net이 있어야 nginx가 정상 작동)
	@docker network inspect prod-net >/dev/null 2>&1 || (echo "❌ Error: prod-net not found. Run 'make data-prod-up' first!" && exit 1)
	@# dev-net이 없으면 생성 (개발 환경 미사용 시에도 infra 실행 가능)
	@docker network inspect dev-net >/dev/null 2>&1 || docker network create --driver bridge dev-net
	cd infra && docker compose $(ENV_PROD) up -d
	@# Nginx가 실행 중이면 설정/인증서 리로드 (중단 없이 적용)
	@docker exec nginx-proxy nginx -s reload 2>/dev/null || true
	@echo ""
	@echo "✅ Infrastructure started (and reloaded)!"
	@echo "   Jenkins: http://localhost:8080"

infra-all-up: data-prod-up infra-up
	@echo "=============================================="
	@echo "  ✅ All Infrastructure Services Started!"
	@echo "=============================================="

infra-down:
	@echo "Stopping Infrastructure..."
	cd infra && docker compose down

jenkins-up:
	@echo "Starting Jenkins..."
	cd infra && docker compose up -d jenkins

jenkins-down:
	@echo "Stopping Jenkins..."
	cd infra && docker compose stop jenkins

jenkins-logs:
	cd infra && docker compose logs -f jenkins

jenkins-password:
	@echo "Jenkins Initial Admin Password:"
	@docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword 2>/dev/null || echo "Jenkins not running or password already used"

jenkins-restart:
	cd infra && docker compose restart jenkins

# =============================================================================
# Application Services (Stateless) - 배포 시마다 재시작
# =============================================================================
# ⚠️ Data 서비스가 먼저 실행 중이어야 합니다!
# App 중지 시 DB는 영향받지 않습니다 (ADR#003 핵심).
# =============================================================================

prod-app-up:
	@echo "=============================================="
	@echo "  Starting Production Application..."
	@echo "  (WAS Blue/Green + Frontend)"
	@echo "=============================================="
	@mkdir -p backend/logs && chmod 777 backend/logs
	cd backend && docker compose -f docker-compose.yml -f docker-compose.prod.yml $(ENV_PROD) up -d --build
	cd frontend && docker compose -f docker-compose.prod.yml $(ENV_PROD) up -d --build
	@echo ""
	@echo "✅ Production App started!"

prod-app-down:
	@echo "Stopping Production Application (DB unaffected)..."
	cd backend && docker compose $(ENV_PROD) down
	cd frontend && docker compose -f docker-compose.prod.yml $(ENV_PROD) down
	@echo ""
	@echo "✅ App stopped. DB is still running."

dev-app-up:
	@echo "=============================================="
	@echo "  Starting Development Application..."
	@echo "  (WAS + Frontend)"
	@echo "=============================================="
	cd backend && docker compose -f docker-compose.dev.yml $(ENV_DEV) up -d --build
	cd frontend && docker compose -f docker-compose.dev.yml $(ENV_DEV) up -d --build
	@echo ""
	@echo "✅ Development App started!"

dev-app-down:
	@echo "Stopping Development Application (DB unaffected)..."
	cd backend && docker compose -f docker-compose.dev.yml $(ENV_DEV) down
	cd frontend && docker compose -f docker-compose.dev.yml $(ENV_DEV) down

# =============================================================================
# Local Development (Full Stack - for Developers)
# =============================================================================
local-up:
	@echo "=============================================="
	@echo "  Starting Local Full Stack Environment..."
	@echo "  (MySQL, Redis, MinIO, WAS all-in-one)"
	@echo "=============================================="
	cd backend && docker compose -f docker-compose.local.yml up -d --build
	@echo ""
	@echo "✅ Local Environment started!"
	@echo "   WAS: http://localhost:8081"
	@echo "   Ready to run frontend: 'npm run local'"

local-down:
	@echo "Stopping Local Environment..."
	cd backend && docker compose -f docker-compose.local.yml down
	@echo "✅ Local Environment stopped."

# =============================================================================
# Monitoring (Production Only)
# =============================================================================

monitoring-up:
	@echo "=============================================="
	@echo "  Starting Monitoring Stack..."
	@echo "  (Promtail, Loki, Grafana)"
	@echo "=============================================="
	cd infra && docker compose --profile monitoring $(ENV_PROD) up -d
	@echo ""
	@echo "✅ Monitoring started!"
	@echo "   Grafana: /grafana (via Nginx Proxy)"

monitoring-down:
	@echo "Stopping Monitoring Stack..."
	cd infra && docker compose --profile monitoring down

# =============================================================================
# OpenVidu (Video Conference)
# =============================================================================

openvidu-up:
	@echo "Starting OpenVidu server..."
	@if [ -d $(OPENVIDU_PATH) ]; then \
		cd $(OPENVIDU_PATH) && sudo ./openvidu start; \
	else \
		echo "OpenVidu not found at $(OPENVIDU_PATH). Skipping..."; \
	fi

openvidu-down:
	@echo "Stopping OpenVidu server..."
	@if [ -d $(OPENVIDU_PATH) ]; then \
		cd $(OPENVIDU_PATH) && sudo ./openvidu stop; \
	else \
		echo "OpenVidu not found at $(OPENVIDU_PATH). Skipping..."; \
	fi

openvidu-status:
	@echo "Checking OpenVidu status..."
	@if [ -d $(OPENVIDU_PATH) ]; then \
		cd $(OPENVIDU_PATH) && sudo docker compose ps; \
	else \
		echo "OpenVidu not found at $(OPENVIDU_PATH)"; \
	fi

openvidu-logs:
	@echo "OpenVidu logs..."
	@if [ -d $(OPENVIDU_PATH) ]; then \
		cd $(OPENVIDU_PATH) && sudo docker compose logs -f; \
	else \
		echo "OpenVidu not found at $(OPENVIDU_PATH)"; \
	fi

# =============================================================================
# Blue/Green Deployment
# =============================================================================

deploy-blue:
	@echo "Deploying to Blue environment..."
	./scripts/deploy-blue.sh

deploy-green:
	@echo "Deploying to Green environment..."
	./scripts/deploy-green.sh

switch-blue:
	@echo "Switching traffic to Blue..."
	./scripts/switch-upstream.sh blue

switch-green:
	@echo "Switching traffic to Green..."
	./scripts/switch-upstream.sh green

# =============================================================================
# Backup & Restore
# =============================================================================

backup-prod:
	@echo "Backing up production database..."
	./scripts/backup-db.sh prod

backup-dev:
	@echo "Backing up development database..."
	./scripts/backup-db.sh dev

restore-prod:
	@echo "Use: ./scripts/restore-db.sh prod [backup_file]"

restore-dev:
	@echo "Use: ./scripts/restore-db.sh dev [backup_file]"

# =============================================================================
# Status & Logs
# =============================================================================

status:
	@echo "=============================================="
	@echo "  Service Status"
	@echo "=============================================="
	@echo ""
	@echo "📦 Networks:"
	@docker network ls | grep -E "(prod-net|dev-net|infra-net)" || echo "  (none)"
	@echo ""
	@echo "📊 Data Services:"
	@docker ps --filter "name=prod-mysql" --filter "name=prod-redis" --filter "name=prod-minio" \
		--filter "name=dev-mysql" --filter "name=dev-redis" --filter "name=dev-minio" \
		--format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  (none)"
	@echo ""
	@echo "🔧 Infrastructure:"
	@docker ps --filter "name=jenkins" --filter "name=nginx-proxy" \
		--format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  (none)"
	@echo ""
	@echo "🚀 Applications:"
	@docker ps --filter "name=prod-was" --filter "name=dev-was" \
		--filter "name=prod-frontend" --filter "name=dev-frontend" \
		--format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  (none)"
	@echo ""
	@echo "📈 Monitoring:"
	@docker ps --filter "name=grafana" --filter "name=loki" --filter "name=promtail" \
		--format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  (none)"

logs-jenkins:
	cd infra && docker compose logs -f jenkins

logs-nginx:
	docker logs -f nginx-proxy

logs-was-blue:
	docker logs -f prod-was-blue

logs-was-green:
	docker logs -f prod-was-green

# =============================================================================
# Cleanup
# =============================================================================

clean:
	@echo "Cleaning up unused Docker resources..."
	docker system prune -f
	docker volume prune -f

clean-all:
	@echo "=============================================="
	@echo "  ⚠️  WARNING: This will remove EVERYTHING!"
	@echo "  (All containers, images, volumes, networks)"
	@echo "=============================================="
	@read -p "Are you sure? (yes/no): " confirm && [ "$$confirm" = "yes" ] && \
		docker compose -f infra/docker-compose.yml down -v && \
		docker compose -f infra/docker-compose.data.prod.yml down -v && \
		docker compose -f infra/docker-compose.data.dev.yml down -v && \
		docker system prune -af --volumes || \
		echo "Cancelled."

# =============================================================================
# Legacy Commands (이전 버전 호환)
# =============================================================================
# 기존 명령어들도 계속 동작합니다.
# =============================================================================

prod-up: data-prod-up infra-up prod-app-up
	@echo "✅ Full Production stack started!"

prod-down: prod-app-down
	@echo "Production App stopped (DB still running)."
	@echo "To stop DB: make data-prod-down"

dev-up: data-dev-up dev-app-up
	@echo "✅ Full Development stack started!"

dev-down: dev-app-down
	@echo "Development App stopped (DB still running)."
	@echo "To stop DB: make data-dev-down"
