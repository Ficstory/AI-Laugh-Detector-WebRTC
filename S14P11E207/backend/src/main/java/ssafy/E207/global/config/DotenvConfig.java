package ssafy.E207.global.config;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.context.annotation.Configuration;

/**
 * 로컬 개발 편의용: 프로젝트 루트의 `.env` 파일을 읽어 JVM System Property로 주입합니다.
 *
 * <p>
 * application.yml 에서 ${...} 형태로 참조하는 값들이 환경변수로 세팅되지 않았을 때,
 * `.env` 값을 대체로 사용하도록 도와줍니다.
 * </p>
 *
 * <p>
 * - 이미 OS 환경변수/시스템 프로퍼티로 값이 들어있으면 덮어쓰지 않습니다.
 * - 운영 환경에서는 `.env` 파일을 배포하지 않는 것을 권장합니다.
 * </p>
 */
@Configuration
public class DotenvConfig {
    static {
        try {
            Dotenv dotenv = Dotenv.configure()
                    .ignoreIfMissing()
                    .load();

            // .env의 모든 key를 주입
            dotenv.entries().forEach(entry -> {
                String key = entry.getKey();
                String value = entry.getValue();

                // 우선순위: System property > OS env > .env
                if (System.getProperty(key) == null && System.getenv(key) == null) {
                    System.setProperty(key, value);
                }
            });
        } catch (Exception ignored) {
            // .env 미존재/파싱 실패 시에도 애플리케이션 구동은 계속
        }
    }
}
