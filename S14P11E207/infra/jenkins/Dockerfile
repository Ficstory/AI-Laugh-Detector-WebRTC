FROM jenkins/jenkins:lts-jdk21

# Root 권한으로 필요한 도구 설치
USER root

# Docker CLI 및 필수 도구 설치 (Jenkins에서 Docker/Make 명령 실행용)
RUN apt-get update && apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    make \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y docker-ce-cli docker-compose-plugin \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22 설치 (Frontend 빌드용 - frontend/Dockerfile과 버전 일치)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Git Safe Directory 설정 (Root 권한 실행 시 필수)
RUN git config --global --add safe.directory '*'

# Jenkins 사용자를 docker 그룹에 추가 (호스트의 docker.sock 접근용)
# DOCKER_GID를 빌드 인자로 받아서 유동적으로 설정 (Default: 999)
ARG DOCKER_GID=988
RUN groupadd -g ${DOCKER_GID} docker || true \
    && usermod -aG docker jenkins

# Jenkins 사용자로 복귀
USER jenkins

# 추천 플러그인 자동 설치 (선택사항 - 초기 설정 시간 단축)
COPY --chown=jenkins:jenkins plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt || true

# JCasC 설정 파일 복사 (선택사항)
# COPY --chown=jenkins:jenkins jenkins.yaml /var/jenkins_home/casc_configs/jenkins.yaml

# 환경변수 설정
ENV JAVA_OPTS="-Djava.awt.headless=true -Djenkins.install.runSetupWizard=true"
ENV JENKINS_OPTS="--httpPort=8080"

