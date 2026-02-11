# ============================================
# 빌드 스테이지
# ============================================
FROM gradle:8.11-jdk21-alpine AS builder

WORKDIR /app

# Gradle 의존성 캐싱을 위해 빌드 파일만 먼저 복사
COPY build.gradle settings.gradle gradlew ./
COPY gradle ./gradle

# gradlew 실행 권한 부여 (Windows에서 권한이 누락될 수 있음)
RUN chmod +x gradlew

# 의존성 다운로드 (캐시 레이어)
RUN ./gradlew dependencies --no-daemon || true

# 소스 코드 복사
COPY src ./src

# 애플리케이션 빌드 (테스트 제외)
RUN ./gradlew clean bootJar -x test --no-daemon

# ============================================
# 실행 스테이지
# ============================================
FROM eclipse-temurin:21-jre-alpine

# 보안 및 유틸리티를 위한 패키지 설치
RUN apk add --no-cache curl

# 애플리케이션 사용자 생성
RUN addgroup -S spring && adduser -S spring -G spring

WORKDIR /app

# 빌드 스테이지에서 JAR 파일 복사
COPY --from=builder /app/build/libs/*.jar app.jar

# 사용자 권한 설정
RUN chown -R spring:spring /app
USER spring

# 환경변수 기본값 설정
ENV SPRING_PROFILES_ACTIVE=local \
    JAVA_OPTS="-Xms512m -Xmx1024m" \
    SERVER_PORT=8080

# 포트 노출은 docker-compose의 expose에서 개별 관리

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${SERVER_PORT}/actuator/health || exit 1

# 애플리케이션 실행
ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -Djava.security.egd=file:/dev/./urandom -jar app.jar"]
