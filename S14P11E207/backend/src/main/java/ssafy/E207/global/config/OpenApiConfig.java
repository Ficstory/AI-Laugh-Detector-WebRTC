package ssafy.E207.global.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI(Swagger) 설정.
 *
 * <p>
 * - Access Token: Authorization: Bearer {JWT}
 * - Refresh Token: HttpOnly Cookie(refresh_token)
 * </p>
 *
 * <p>
 * Swagger UI에서 Cookie(HttpOnly)는 브라우저/클라이언트 환경에 따라 동작이 다를 수 있어,
 * 보안 스키마는 Bearer(Access Token)만 표준으로 노출하고 Refresh는 API 설명에서 안내하는 형태로 갑니다.
 * </p>
 */
@Configuration
public class OpenApiConfig {

    public static final String BEARER_SCHEME_NAME = "bearerAuth";

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("E207 API")
                        .description("E207 Backend API 문서")
                        .version("v1"))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME_NAME))
                .components(new Components()
                        .addSecuritySchemes(BEARER_SCHEME_NAME,
                                new SecurityScheme()
                                        .name(BEARER_SCHEME_NAME)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")));
    }
}

