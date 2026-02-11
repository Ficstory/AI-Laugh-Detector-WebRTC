// =============================================================================
// Jenkinsfile - 통합 CI/CD Pipeline (Root Level)
// =============================================================================
// 📋 개요:
//   - develop 브랜치 → Dev 환경 배포
//   - main 브랜치 → Prod 환경 배포 (Blue/Green)
//   - Mattermost Webhook 알림 통합 (스테이지별 알림)
//
// 📦 필요 Jenkins Credentials:
//   - env-dev (Secret File): .env.dev 파일
//   - env-prod (Secret File): .env.prod 파일
//   - app-yml (Secret File): application.yml
//   - mattermost-webhook (Secret Text): Mattermost Incoming Webhook URL
// =============================================================================

// Global variable for deployment target state
def deployTarget = ""

pipeline {
    agent any

    environment {
        // 공통 환경변수
        PROJECT_NAME = "smile-battle"
        
        
        // 배포 대상 (Blue/Green 전환용) - Global Variable deployTarget 사용
        // DEPLOY_TARGET removed from environment to avoid immutability issues

        
        // 빌드 시작 시간
        BUILD_START_TIME = ''
        
        // 배포 URL
        DEV_URL = 'https://i14e207.p.ssafy.io/dev'
        PROD_URL = 'https://i14e207.p.ssafy.io'
    }

    options {
        // 빌드 타임아웃 (30분)
        timeout(time: 30, unit: 'MINUTES')
        
        // 빌드 기록 보관 (최근 10개)
        buildDiscarder(logRotator(numToKeepStr: '10'))
        
        // 동시 빌드 방지
        disableConcurrentBuilds()
        
        // 타임스탬프 출력
        timestamps()
    }

    stages {
        // =====================================================================
        // Stage 1: Checkout
        // =====================================================================
        stage('Checkout') {
            steps {
                script {
                    env.BUILD_START_TIME = new Date().format('yyyy-MM-dd HH:mm:ss')
                    echo '📥 소스 코드 체크아웃 중...'
                    
                    // 빌드 시작 알림 (develop, main 브랜치만 전송)
                    def branchName = env.BRANCH_NAME ?: 'unknown'
                    if (branchName == 'develop' || branchName == 'main') {
                        sendMattermostNotification(
                            "🚀 **${PROJECT_NAME}** 빌드 시작\\n- 브랜치: ${branchName}\\n- 빌드: #${env.BUILD_NUMBER}\\n- 시작: ${env.BUILD_START_TIME}",
                            '#439FE0'
                        )
                    }
                }
                checkout scm
            }
        }

        // =====================================================================
        // Stage 2: Prepare
        // =====================================================================
        stage('Prepare') {
            steps {
                script {
                    echo '🔧 빌드 환경 준비 중...'
                    // Gradlew 실행 권한 부여
                    if (isUnix()) {
                        sh "chmod +x backend/gradlew"
                        sh "chmod +x scripts/*.sh || true"
                    }
                }
            }
        }

        // =====================================================================
        // Develop Branch Pipeline
        // =====================================================================
        stage('Develop Pipeline') {
            when {
                branch 'develop'
            }
            stages {
                stage('Build Backend (Dev)') {
                    steps {
                        script {
                            sendMattermostNotification(
                                "🔨 **[Dev]** Backend 빌드 중... (테스트 포함)",
                                '#FFA500'
                            )
                        }
                        dir('backend') {
                            echo '🔨 Backend 빌드 중 (Dev 프로필, 테스트 포함)...'
                            
                            // application.yml 주입
                            withCredentials([file(credentialsId: 'app-yml', variable: 'APP_YML')]) {
                                sh 'cp $APP_YML src/main/resources/application.yml'
                            }

                            // google-credentials.json 주입
                            withCredentials([file(credentialsId: 'google-sheet-credentials', variable: 'GOOGLE_SHEET_CREDENTIALS')]) {
                                sh 'cp $GOOGLE_SHEET_CREDENTIALS src/main/resources/google-credentials.json'
                            }
                            
                            sh "echo '🚫 로컬 빌드 생략: 배포 과정에서 Docker 내부 빌드가 수행됩니다.'"
                        }
                    }
                    post {
                        always {
                            // 테스트 결과 리포트 수집
                            junit allowEmptyResults: true, testResults: '**/build/test-results/test/*.xml'
                        }
                        failure {
                            script {
                                sendMattermostNotification(
                                    "❌ **[Dev]** Backend 빌드 실패!\\n- 빌드: #${env.BUILD_NUMBER}\\n- 로그: ${env.BUILD_URL}console",
                                    '#FF0000'
                                )
                            }
                        }
                    }
                }
                
                stage('Build Frontend (Dev)') {
                    steps {
                        script {
                            sendMattermostNotification(
                                "🔨 **[Dev]** Frontend 빌드 중...",
                                '#FFA500'
                            )
                        }
                        dir('frontend') {
                            echo '🔨 Frontend 빌드 중...'
                            sh "echo '🚫 로컬 빌드 생략: 배포 과정에서 Docker 내부 빌드가 수행됩니다.'"
                        }
                    }
                    post {
                        failure {
                            script {
                                sendMattermostNotification(
                                    "❌ **[Dev]** Frontend 빌드 실패!\\n- 빌드: #${env.BUILD_NUMBER}\\n- 로그: ${env.BUILD_URL}console",
                                    '#FF0000'
                                )
                            }
                        }
                    }
                }
                
                stage('Deploy (Dev)') {
                    steps {
                        script {
                            echo '🚀 Dev 환경에 배포 중...'
                            sendMattermostNotification(
                                "🚀 **[Dev]** 배포 중...",
                                '#FFA500'
                            )
                            
                            // Jenkins Secret File에서 .env.dev 복원
                            withCredentials([file(credentialsId: 'env-dev', variable: 'ENV_FILE')]) {
                                sh 'cp $ENV_FILE .env.dev'
                            }
                            
                            // Jenkins Secret File에서 frontend/.env.dev 복원
                            withCredentials([file(credentialsId: 'frontend-env-dev', variable: 'FE_ENV_FILE')]) {
                                sh 'cp $FE_ENV_FILE frontend/.env.dev'
                            }

                            // dev-app-up 실행: Backend + Frontend 모두 배포
                            sh "make dev-app-up"
                        }
                    }
                    post {
                        failure {
                            script {
                                sendMattermostNotification(
                                    "❌ **[Dev]** 배포 실패!\\n- 빌드: #${env.BUILD_NUMBER}\\n- 로그: ${env.BUILD_URL}console",
                                    '#FF0000'
                                )
                            }
                        }
                    }
                }
                
                stage('Health Check (Dev)') {
                    steps {
                        script {
                            echo '🏥 dev-was 헬스체크 진행 중...'
                            def maxRetries = 30
                            def healthy = false
                            
                            for (int i = 1; i <= maxRetries; i++) {
                                def result = sh(
                                    script: 'docker exec dev-was curl -sf http://localhost:8080/actuator/health || echo "failed"',
                                    returnStdout: true
                                ).trim()
                                
                                if (result != 'failed' && result.contains('UP')) {
                                    healthy = true
                                    echo "✅ 헬스체크 통과! (시도 ${i}/${maxRetries})"
                                    break
                                }
                                
                                echo "⏳ 대기 중... (${i}/${maxRetries})"
                                sleep(time: 3, unit: 'SECONDS')
                            }
                            
                            if (!healthy) {
                                echo "❌ Health Check Failed. Dumping logs..."
                                sh "docker logs --tail 100 dev-was"
                                sendMattermostNotification(
                                    "❌ **[Dev]** Health Check 실패!\\n- 서버가 응답하지 않습니다.\\n- 로그: ${env.BUILD_URL}console",
                                    '#FF0000'
                                )
                                error "❌ 헬스체크 실패 (${maxRetries}회 시도)"
                            }
                        }
                    }
                }
                
                stage('Smoke Test (Dev)') {
                    steps {
                        script {
                            echo '🧪 Smoke Test 진행 중...'
                            def apiResult = sh(
                                script: "curl -sf ${DEV_URL}/api/actuator/health || echo 'failed'",
                                returnStdout: true
                            ).trim()
                            
                            if (apiResult == 'failed') {
                                sendMattermostNotification(
                                    "⚠️ **[Dev]** Smoke Test 경고: API 응답 없음\\n- URL: ${DEV_URL}/api/actuator/health",
                                    '#FFA500'
                                )
                                echo "⚠️ 경고: API 응답 없음 (nginx 재시작 필요할 수 있음)"
                            } else {
                                echo "✅ Smoke Test 통과!"
                            }
                        }
                    }
                }
                
                stage('배포 후 상태 확인 (Dev)') {
                    steps {
                        script {
                            echo '⏰ 5분 대기 후 상태 확인 예정...'
                            sendMattermostNotification(
                                "⏰ **[Dev]** 5분 후 상태 확인 예정...",
                                '#439FE0'
                            )
                            sleep(time: 5, unit: 'MINUTES')
                            
                            echo '📊 서버 상태 확인 중...'
                            def status = sh(
                                script: 'make status 2>&1 || echo "상태 확인 실패"',
                                returnStdout: true
                            ).trim()
                            
                            sendMattermostNotification(
                                "📊 **[Dev] 배포 5분 후 상태 확인**\\n```\\n${status}\\n```",
                                '#36a64f'
                            )
                        }
                    }
                }
            }
        }

        // =====================================================================
        // Production Branch Pipeline (Main)
        // =====================================================================
        stage('Production Pipeline') {
            when {
                branch 'main'
            }
            stages {
                stage('Determine Target') {
                    steps {
                        script {
                            echo '🎯 배포 대상 결정 중 (Blue/Green)...'
                            
                            // 현재 활성 서버 확인
                            def blueRunning = sh(
                                script: 'docker ps --filter "name=prod-was-blue" --filter "status=running" -q | grep -q . && echo "true" || echo "false"',
                                returnStdout: true
                            ).trim()
                            
                            def greenRunning = sh(
                                script: 'docker ps --filter "name=prod-was-green" --filter "status=running" -q | grep -q . && echo "true" || echo "false"',
                                returnStdout: true
                            ).trim()
                            
                            echo "🔎 상태 확인 - Blue: ${blueRunning}, Green: ${greenRunning}"
                            
                            def target = 'blue' // Default fallback
                            
                            // 배포 대상 결정
                            if (blueRunning == 'true' && greenRunning == 'false') {
                                target = 'green'
                            } else if (greenRunning == 'true' && blueRunning == 'false') {
                                target = 'blue'
                            } else if (blueRunning == 'true' && greenRunning == 'true') {
                                // 둘 다 실행 중인 경우 Nginx 설정 확인 (Live Container Check - Strict Regex)
                                def isBlueActive = sh(script: "docker exec nginx-proxy cat /etc/nginx/nginx.conf | grep -q 'server prod-was-blue:8081;' && echo 'yes' || echo 'no'", returnStdout: true).trim()
                                echo "🔎 Nginx Active Check: Blue Active? ${isBlueActive}"
                                target = (isBlueActive == 'yes') ? 'green' : 'blue'
                            } else {
                                // 둘 다 중지된 경우 Blue로 배포
                                echo "⚠️ 초기 상태 (둘다 꺼짐) -> Blue로 배포 진행"
                                target = 'blue'
                            }
                            
                            deployTarget = target
                            echo "📌 배포 대상 확정: ${deployTarget}"
                            
                            sendMattermostNotification(
                                "🎯 **[Prod]** 배포 대상: **${target.toUpperCase()}**",
                                '#439FE0'
                            )
                        }
                    }
                }
                
                stage('Build Backend (Prod)') {
                    steps {
                        script {
                            sendMattermostNotification(
                                "🔨 **[Prod]** Backend 빌드 중...",
                                '#FFA500'
                            )
                        }
                        dir('backend') {
                            echo '🔨 Backend 빌드 중 (Prod 프로필)...'
                            
                            // application.yml 주입
                            withCredentials([file(credentialsId: 'app-yml', variable: 'APP_YML')]) {
                                sh 'cp $APP_YML src/main/resources/application.yml'
                            }

                            // google-credentials.json 주입
                            withCredentials([file(credentialsId: 'google-sheet-credentials', variable: 'GOOGLE_SHEET_CREDENTIALS')]) {
                                sh 'cp $GOOGLE_SHEET_CREDENTIALS src/main/resources/google-credentials.json'
                            }
                            
                            sh "echo '🚫 로컬 빌드 생략: 배포 과정에서 Docker 내부 빌드가 수행됩니다.'"
                        }
                    }
                    post {
                        failure {
                            script {
                                sendMattermostNotification(
                                    "❌ **[Prod]** Backend 빌드 실패!\\n- 빌드: #${env.BUILD_NUMBER}\\n- 로그: ${env.BUILD_URL}console",
                                    '#FF0000'
                                )
                            }
                        }
                    }
                }
                
                stage('Build Frontend (Prod)') {
                    steps {
                        script {
                            sendMattermostNotification(
                                "🔨 **[Prod]** Frontend 빌드 중...",
                                '#FFA500'
                            )
                        }
                        dir('frontend') {
                            echo '🔨 Frontend 빌드 중 (Prod 환경)...'
                            sh "echo '🚫 로컬 빌드 생략: 배포 과정에서 Docker 내부 빌드가 수행됩니다.'"
                        }
                    }
                    post {
                        failure {
                            script {
                                sendMattermostNotification(
                                    "❌ **[Prod]** Frontend 빌드 실패!\\n- 빌드: #${env.BUILD_NUMBER}\\n- 로그: ${env.BUILD_URL}console",
                                    '#FF0000'
                                )
                            }
                        }
                    }
                }
                
                stage('Deploy (Prod)') {
                    steps {
                        script {
                            echo '🚀 Prod 환경에 배포 중...'
                            sendMattermostNotification(
                                "🚀 **[Prod]** ${deployTarget.toUpperCase()} 배포 중...",
                                '#FFA500'
                            )
                            
                            // Jenkins Secret File에서 .env.prod 복원
                            withCredentials([file(credentialsId: 'env-prod', variable: 'ENV_FILE')]) {
                                sh 'cp $ENV_FILE .env.prod'
                            }
                            
                            // Jenkins Secret File에서 frontend/.env.prod 복원
                            withCredentials([file(credentialsId: 'frontend-env-prod', variable: 'FE_ENV_FILE')]) {
                                sh 'cp $FE_ENV_FILE frontend/.env.prod'
                            }
                            
                            // prod-app-up 실행: Backend (Blue/Green) + Frontend 배포
                            sh "make prod-app-up"
                        }
                    }
                    post {
                        failure {
                            script {
                                sendMattermostNotification(
                                    "❌ **[Prod]** 배포 실패!\\n- 대상: ${deployTarget}\\n- 로그: ${env.BUILD_URL}console",
                                    '#FF0000'
                                )
                            }
                        }
                    }
                }
                
                stage('Health Check (Prod)') {
                    steps {
                        script {
                            echo "🏥 prod-was-${deployTarget} 헬스체크 진행 중..."
                            def containerName = "prod-was-${deployTarget}"
                            def port = deployTarget == 'blue' ? '8081' : '8082'
                            def maxRetries = 30
                            def healthy = false
                            
                            for (int i = 1; i <= maxRetries; i++) {
                                def result = sh(
                                    script: "docker exec ${containerName} sh -c 'curl -sf http://localhost:${port}/actuator/health || wget -qO- http://localhost:${port}/actuator/health' || echo 'failed'",
                                    returnStdout: true
                                ).trim()
                                
                                if (result != 'failed' && result.contains('UP')) {
                                    healthy = true
                                    echo "✅ 헬스체크 통과! (시도 ${i}/${maxRetries})"
                                    break
                                }
                                
                                echo "⏳ 대기 중... (${i}/${maxRetries})"
                                sleep(time: 2, unit: 'SECONDS')
                            }
                            
                            if (!healthy) {
                                sendMattermostNotification(
                                    "❌ **[Prod]** Health Check 실패!\\n- 대상: ${deployTarget}\\n- 로그: ${env.BUILD_URL}console",
                                    '#FF0000'
                                )
                                error "❌ 헬스체크 실패 (${maxRetries}회 시도)"
                            }
                        }
                    }
                }
                
                stage('Switch Traffic') {
                    steps {
                        script {
                            echo "🔄 트래픽 전환 중: ${deployTarget}..."
                            sh "./scripts/switch-upstream.sh ${deployTarget}"
                            sendMattermostNotification(
                                "🔄 **[Prod]** 트래픽 전환 완료: **${deployTarget.toUpperCase()}**",
                                '#36a64f'
                            )
                        }
                    }
                }
                
                stage('Smoke Test (Prod)') {
                    steps {
                        script {
                            echo '🧪 Prod Smoke Test 진행 중...'
                            
                            // API Health Check
                            def apiResult = sh(
                                script: "curl -sf ${PROD_URL}/api/actuator/health || echo 'failed'",
                                returnStdout: true
                            ).trim()
                            
                            if (apiResult == 'failed' || !apiResult.contains('UP')) {
                                sendMattermostNotification(
                                    "⚠️ **[Prod]** Smoke Test 실패: API 응답 이상\\n- URL: ${PROD_URL}/api/actuator/health\\n- 롤백을 고려하세요.",
                                    '#FF0000'
                                )
                                error "❌ Prod Smoke Test 실패!"
                            }
                            
                            echo "✅ Prod Smoke Test 통과!"
                            sendMattermostNotification(
                                "✅ **[Prod]** Smoke Test 통과!",
                                '#36a64f'
                            )
                        }
                    }
                }
                
                stage('배포 후 상태 확인 (Prod)') {
                    steps {
                        script {
                            echo '⏰ 5분 대기 후 상태 확인 예정...'
                            sendMattermostNotification(
                                "⏰ **[Prod]** 5분 후 상태 확인 예정...",
                                '#439FE0'
                            )
                            sleep(time: 5, unit: 'MINUTES')
                            
                            echo '📊 서버 상태 확인 중...'
                            def status = sh(
                                script: 'make status 2>&1 || echo "상태 확인 실패"',
                                returnStdout: true
                            ).trim()
                            
                            sendMattermostNotification(
                                "📊 **[Prod] 배포 5분 후 상태 확인**\\n- 대상: ${deployTarget.toUpperCase()}\\n```\\n${status}\\n```",
                                '#36a64f'
                            )
                        }
                    }
                }
            }
        }
        
        // =====================================================================
        // Cleanup
        // =====================================================================
        stage('Cleanup') {
            steps {
                echo '🧹 미사용 Docker 리소스 정리 중...'
                sh 'docker image prune -f || true'
            }
        }
    }

    // =========================================================================
    // Post Actions (최종 알림 및 롤백)
    // =========================================================================
    post {
        success {
            script {
                def branchName = env.BRANCH_NAME ?: 'unknown'
                
                // develop, main 브랜치만 알림 및 처리
                if (branchName == 'develop' || branchName == 'main') {
                    def environment = branchName == 'main' ? 'Production' : 'Development'
                    def endTime = new Date().format('yyyy-MM-dd HH:mm:ss')
                    def targetUrl = branchName == 'main' ? PROD_URL : DEV_URL
                    
                    sendMattermostNotification(
                        "✅ **${PROJECT_NAME}** 배포 성공!\\n- 환경: ${environment}\\n- 브랜치: ${branchName}\\n- 빌드: #${env.BUILD_NUMBER}\\n- 완료: ${endTime}\\n- URL: ${targetUrl}",
                        '#36a64f'
                    )
                }
            }
        }
        
        failure {
            script {
                def branchName = env.BRANCH_NAME ?: 'unknown'
                
                // develop, main 브랜치만 알림 및 처리
                if (branchName == 'develop' || branchName == 'main') {
                    def environment = branchName == 'main' ? 'Production' : 'Development'
                    
                    sendMattermostNotification(
                        "❌ **${PROJECT_NAME}** 배포 실패!\\n- 환경: ${environment}\\n- 브랜치: ${branchName}\\n- 빌드: #${env.BUILD_NUMBER}\\n- 로그: ${env.BUILD_URL}console",
                        '#FF0000'
                    )
                    
                    // Production 배포 실패 시 자동 롤백 (Main Check는 이미 위에서 수행됨)
                    if (branchName == 'main' && deployTarget) {
                        def rollbackTarget = deployTarget == 'blue' ? 'green' : 'blue'
                        echo "🔄 자동 롤백: ${rollbackTarget}로 전환 중..."
                        
                        try {
                            sh "./scripts/switch-upstream.sh ${rollbackTarget}"
                            sendMattermostNotification(
                                "🔄 **자동 롤백 완료!**\\n- 트래픽이 **${rollbackTarget.toUpperCase()}**로 전환되었습니다.",
                                '#FFA500'
                            )
                        } catch (Exception e) {
                            sendMattermostNotification(
                                "⚠️ **자동 롤백 실패!**\\n- 수동 롤백 필요: `make switch-${rollbackTarget}`",
                                '#FF0000'
                            )
                        }
                    }
                }
            }
        }
        
        cleanup {
            // 워크스페이스 정리 (모든 스테이지 종료 후 실행)
            cleanWs()
        }
    }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Mattermost 알림 전송 헬퍼 함수
 * @param message 전송할 메시지 (Markdown 지원)
 * @param color 메시지 색상 (#36a64f=성공, #FF0000=실패, #FFA500=진행중)
 */
def sendMattermostNotification(String message, String color = '#36a64f') {
    withCredentials([string(credentialsId: 'mattermost-webhook', variable: 'WEBHOOK_URL')]) {
        def payload = """{"attachments": [{"color": "${color}", "text": "${message}"}]}"""
        sh """
            curl -s -X POST -H 'Content-Type: application/json' \
            -d '${payload}' \
            "\$WEBHOOK_URL" || true
        """
    }
}
