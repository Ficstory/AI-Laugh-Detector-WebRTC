package ssafy.E207.global.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import ssafy.E207.global.jwt.JwtAuthenticationEntryPoint;
import ssafy.E207.global.jwt.JwtAuthenticationFilter;

import java.util.Collections;
import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {
	private final JwtAuthenticationFilter jwtAuthenticationFilter;
	private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
	private final CorsProperties corsProperties;

	@Bean
	public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		http
				.cors(Customizer.withDefaults())
				.csrf(AbstractHttpConfigurer::disable)
				.formLogin(AbstractHttpConfigurer::disable)
				.httpBasic(AbstractHttpConfigurer::disable)
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(auth -> auth
						.requestMatchers(
								"/swagger-ui.html",
								"/swagger-ui/**",
								"/v3/api-docs/**",
								"/",
								"/auth-test.html",
								"/auth-callback.html",
								"/favicon.ico",
								"/*.css",
								"/*.js",
								"/*.png",
								"/*.jpg",
								"/*.jpeg",
								"/*.gif",
								"/*.svg",
								"/auth/login",
								"/auth/regist",
								"/auth/logout",
								"/auth/delete",
								"/auth/refresh",
								"/oauth2/**",
								"/user/check/nickname",
								"/user/change",
								"/user",
								"/user/upload/profileImage",  // 회원가입 시 registerToken으로 접근
								"/user/confirm/profileImage", // 회원가입 시 registerToken으로 접근
								"/user/delete/profileImage",  // 회원가입 시 registerToken으로 접근
								"/error",
								"/connect/**",  // 웹소켓 프로토콜은 StompJwtInterceptor에서 jwt 토큰 검사
								"/webhook", // openvidu 웹훅 이벤트(participant left, session destroyed) 들어오는 경로
								"/actuator/**") // Spring Actuator (Health Check)
						.permitAll()

						.anyRequest().authenticated())
				.exceptionHandling(handler -> handler
						.authenticationEntryPoint(jwtAuthenticationEntryPoint))
				.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

		return http.build();
	}

	/**
	 * [Security][Bean] CORS 설정
	 *
	 * @return CorsConfigurationSource
	 */
	@Bean
	public CorsConfigurationSource corsConfigurationSource() {
		CorsConfiguration configuration = new CorsConfiguration();

		// 1. 허용할 Origin 설정 (application.yml 참고)
		// setAllowedOriginPatterns를 사용하여 와일드카드 매칭 지원
		java.util.List<String> origins = new java.util.ArrayList<>();
		if (corsProperties.getAllowedOrigins() != null) {
			origins.addAll(corsProperties.getAllowedOrigins());
		}
		// 로컬 개발 환경 허용
		origins.add("http://localhost:3000");
		origins.add("http://localhost:5173");
		
		configuration.setAllowedOriginPatterns(Collections.singletonList("*")); // 개발용 전체 허용 (운영 시 제한 필요)
		// configuration.setAllowedOrigins(origins); // Credentials=true일 경우 * 사용 불가하므로 Patterns 사용 권장

		// 2. 허용할 HTTP Method 명시
		configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));

		// 3. 허용할 Header 설정
		configuration.setAllowedHeaders(Collections.singletonList("*"));

		// 4. 자격 증명(Cookie) 허용
		configuration.setAllowCredentials(true);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", configuration);
		return source;
	}

	/**
	 * [Security][Bean] 패스워드 인코더 (OAuth 기반이지만 추후 비밀번호 인증 대비)
	 */
	@Bean
	public PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}
}
