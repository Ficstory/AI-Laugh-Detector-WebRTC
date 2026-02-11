# Infra - 인프라 설정 디렉토리

> **ADR #003** 기반 - 인프라와 애플리케이션 분리 전략

이 디렉토리는 **상시 기동되어야 하는 인프라 서비스**를 관리합니다.

## ⚠️ 중요 경고

```
❌ 운영 환경에서 docker compose down 절대 금지!
❌ volume 삭제 절대 금지! (데이터 손실 위험)
```

## 디렉토리 구조

```
infra/
├── docker-compose.yml              # Jenkins (CI/CD)
├── docker-compose.data.prod.yml    # MySQL, Redis, MinIO (데이터 계층)
├── docker-compose.monitoring.yml   # Grafana, Loki (모니터링)
├── README.md                       # 이 파일
│
├── jenkins/
│   ├── Dockerfile                  # Jenkins 커스텀 이미지
│   ├── plugins.txt                 # 자동 설치 플러그인 목록
│   └── jenkins.yaml                # JCasC 설정 (선택)
│
├── nginx-proxy/
│   ├── nginx.conf                  # Nginx 메인 설정
│   ├── conf.d/
│   │   ├── default.conf            # 라우팅 규칙
│   │   └── upstream.conf           # Blue/Green upstream
│   └── ssl/                        # SSL 인증서
│
├── loki/
│   └── loki-config.yml             # Loki 설정
│
├── promtail/
│   └── promtail-config.yml         # Promtail 설정
│
└── grafana/
    └── provisioning/               # Grafana 프로비저닝
```

## 스택 구성

| 스택 | 파일 | 포함 서비스 | 용도 |
|------|------|-------------|------|
| **CI/CD** | `docker-compose.yml` | Jenkins | 빌드/배포 자동화 |
| **Database** | `docker-compose.data.prod.yml` | MySQL, Redis, MinIO | 데이터 계층 |
| **Monitoring** | `docker-compose.monitoring.yml` | Grafana, Loki, Promtail | 모니터링 |

---

## 빠른 시작

### 1. 전체 인프라 스택 실행 (최초 1회)

```bash
cd infra

# 1. DB 스택 실행 (MySQL, Redis, MinIO)
docker compose -f docker-compose.data.prod.yml up -d

# 2. Jenkins 실행
docker compose up -d

# 3. 모니터링 실행 (선택)
docker compose -f docker-compose.monitoring.yml up -d
```

### 2. 상태 확인

```bash
# 전체 컨테이너 상태
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 특정 스택 상태
docker compose -f docker-compose.data.prod.yml ps
```

### 3. 접속 URL

| 서비스 | URL | 비고 |
|--------|-----|------|
| Jenkins | http://localhost:8080 | 초기 비밀번호 필요 |
| MySQL | localhost:3306 | 내부 네트워크 접속 권장 |
| Redis | localhost:6379 | 내부 네트워크 접속 권장 |
| MinIO Console | http://localhost:9001 | |
| Grafana | http://localhost:8300 | admin / ${GRAFANA_ADMIN_PASSWORD} |

---

## Jenkins 설정 가이드

### 초기 관리자 비밀번호 확인

```bash
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

### 필수 플러그인 (자동 설치됨)

- **Pipeline**: workflow-aggregator, pipeline-stage-view
- **Git**: git, gitlab-plugin
- **Docker**: docker-workflow, docker-plugin
- **Credentials**: credentials, credentials-binding

### Credentials 설정

Jenkins 관리 → Credentials 에서 다음 항목 추가:

1. **gitlab-credentials**: GitLab 접근용 (Username/Password 또는 Token)
2. **ec2-ssh-key**: EC2 SSH 접근용 (SSH Private Key)
3. **docker-registry**: Docker Registry 접근용 (필요시)

### 파이프라인 생성

1. 새 Item → Pipeline 선택
2. Pipeline script from SCM 선택
3. Repository URL, Credentials 설정
4. Script Path: `backend/Jenkinsfile` 또는 `frontend/Jenkinsfile`

---

## 네트워크 구성

```
┌─────────────────────────────────────────────────────────────────┐
│                        infra-net (공유 네트워크)                 │
│                                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────┐  │
│  │  MySQL  │  │  Redis  │  │  MinIO  │  │ Jenkins │  │ Loki  │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └─────────┘  └───────┘  │
│       │            │            │                               │
│       └────────────┼────────────┘                               │
│                    │                                            │
└────────────────────┼────────────────────────────────────────────┘
                     │ external network connection
┌────────────────────┼────────────────────────────────────────────┐
│                    │           app-network                       │
│              ┌─────┴─────┐                                       │
│              │           │                                       │
│         ┌────┴────┐ ┌────┴────┐                                  │
│         │WAS Blue │ │WAS Green│                                  │
│         └─────────┘ └─────────┘                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 애플리케이션에서 인프라 연결

```yaml
# backend/docker-compose.dev.yml 또는 prod.yml
networks:
  infra-net:
    external: true  # infra 스택에서 생성한 네트워크 참조
```

---

## 리소스 요구사항

| 서비스 | 메모리 제한 | 권장 |
|--------|------------|------|
| MySQL | 4 GB | 4+ GB |
| Redis | 2 GB | 1-2 GB |
| MinIO | 2 GB | 1-2 GB |
| Jenkins | 2 GB | 2-4 GB |
| Grafana | 512 MB | 512 MB |
| Loki | 1 GB | 1 GB |

---

## 운영 가이드

### ✅ 허용되는 작업

```bash
# 로그 확인
docker compose -f docker-compose.data.prod.yml logs -f mysql

# 서비스 재시작 (데이터 유지)
docker compose -f docker-compose.data.prod.yml restart mysql

# 상태 확인
docker compose -f docker-compose.data.prod.yml ps
```

### ❌ 금지된 작업 (운영 환경)

```bash
# 절대 하지 말 것!
docker compose -f docker-compose.data.prod.yml down    # DB 중단
docker volume rm mysql-data                      # 데이터 삭제
docker system prune -a                           # 볼륨 포함 정리
```

---

## 문제 해결

### Jenkins 컨테이너가 시작되지 않음

```bash
# 로그 확인
docker compose logs jenkins

# 권한 문제 해결
sudo chown -R 1000:1000 ../logs/jenkins
```

### MySQL 연결 실패

```bash
# 컨테이너 상태 확인
docker compose -f docker-compose.data.prod.yml ps mysql

# 헬스체크 상태 확인
docker inspect mysql --format='{{.State.Health.Status}}'

# 로그 확인
docker compose -f docker-compose.data.prod.yml logs mysql
```

### 네트워크 연결 문제

```bash
# infra-net 네트워크 존재 확인
docker network ls | grep infra-net

# 네트워크에 연결된 컨테이너 확인
docker network inspect infra-net
```

---

## 관련 문서

- [DOCKER_GUIDE.md](../DOCKER_GUIDE.md) - 전체 환경별 가이드
- [ADR #003](../docs/유준호/) - Docker Compose 환경 분류 결정

