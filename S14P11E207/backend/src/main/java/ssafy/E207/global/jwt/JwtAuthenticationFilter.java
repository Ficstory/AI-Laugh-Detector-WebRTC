package ssafy.E207.global.jwt;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import ssafy.E207.domain.auth.service.AuthService;
import ssafy.E207.domain.auth.dto.response.AuthTokenResponse;
import ssafy.E207.domain.auth.exception.InvalidTokenException;

import java.io.IOException;
import java.util.UUID;

/**
 * <h2>JwtAuthenticationFilter</h2>
 * <p>
 * Authorization 헤더의 <b>Bearer Token</b>을 추출하여 검증하는 시큐리티 필터.
 * </p>
 *
 * <pre>
 *       Header(Authorization)          Parsing & Verify           SecurityContext
 * ┌──────────────────────────┐   ┌───────────────────────┐   ┌────────────────────┐
 * │ Bearer eyJhbGciOiJI...   │──►│ JwtTokenProvider      │──►│ Authentication     │
 * └──────────────────────────┘   │ (Signature Check)     │   │ (UserPrincipal)    │
 *                                └───────────────────────┘   └────────────────────┘
 *                                            │
 *                                     [Exception]
 *                                            ▼
 *                                   request.setAttribute
 *                                   (EntryPoint에서 401)
 * </pre>
 *
 * @see JwtAuthenticationEntryPoint
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private static final String BEARER_PREFIX = "Bearer ";

	private final JwtTokenProvider jwtTokenProvider;
	private final AuthService authService;
	private final JwtCookieProvider jwtCookieProvider;

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {

		String bearerToken = request.getHeader(HttpHeaders.AUTHORIZATION);

		try {
			if (StringUtils.hasText(bearerToken) && bearerToken.startsWith(BEARER_PREFIX)) {
				String token = bearerToken.substring(BEARER_PREFIX.length());

				try {
					Claims claims = jwtTokenProvider.parseClaims(token);
					setAuthentication(claims.getSubject(), request);
				} catch (io.jsonwebtoken.ExpiredJwtException e) {
					// Access Token 만료 -> Silent Refresh 시도
					handleSilentRefresh(request, response);
				}
			}
		} catch (Exception e) {
			log.error("Security Filter Exception: {}", e.getMessage());
			SecurityContextHolder.clearContext();
			request.setAttribute("exception", e);
		}

		filterChain.doFilter(request, response);
	}

	private void handleSilentRefresh(HttpServletRequest request, HttpServletResponse response) {
		String refreshToken = getRefreshTokenFromCookie(request);

		if (refreshToken != null) {
			try {
				// 리프레시 토큰으로 재발급 시도
				AuthTokenResponse tokens = authService.refresh(refreshToken);

				// 새 Access Token으로 인증 설정
				String newAccessToken = tokens.accessToken();
				String userId = jwtTokenProvider.parseClaims(newAccessToken).getSubject();
				setAuthentication(userId, request);

				// 응답 헤더에 새 Access Token 추가
				response.setHeader(HttpHeaders.AUTHORIZATION, BEARER_PREFIX + newAccessToken);

				// 응답 쿠키에 새 Refresh Token 설정 (Rotation)
				org.springframework.http.ResponseCookie refreshCookie = jwtCookieProvider
						.createRefreshTokenCookie(tokens.refreshToken());
				response.addHeader(HttpHeaders.SET_COOKIE, jwtCookieProvider.asHeader(refreshCookie));

				log.info("Silent Refresh Successful for userId: {}", userId);
			} catch (Exception re) {
				// 리프레시 실패 (만료/오류) -> 예외 전파 (결국 401)
				log.info("Silent Refresh Failed: {}", re.getMessage());
				throw re;
			}
		} else {
			// 리프레시 토큰 없음 -> 원래 만료 예외 다시 던짐
			throw new InvalidTokenException("토큰이 만료되었습니다.");
		}
	}

	private void setAuthentication(String userId, HttpServletRequest request) {
		UserPrincipal principal = new UserPrincipal(UUID.fromString(userId));
		UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
				principal,
				null,
				principal.getAuthorities());
		authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
		SecurityContextHolder.getContext().setAuthentication(authentication);
	}

	private String getRefreshTokenFromCookie(HttpServletRequest request) {
		if (request.getCookies() != null) {
			for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
				if (jwtTokenProvider.getJwtProperties().getRefreshCookieName().equals(cookie.getName())) {
					return cookie.getValue();
				}
			}
		}
		return null;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) throws ServletException {
		String path = request.getServletPath();
		if (path == null) {
			return false;
		}

		// 정적 리소스 및 테스트 페이지는 인증/토큰 파싱 대상이 아님
		return path.equals("/")
				|| path.equals("/auth/refresh") // Refresh 요청은 만료된 Access Token을 포함할 수 있으므로 필터 제외
				|| path.equals("/auth-test.html")
				|| path.equals("/favicon.ico")
				|| path.startsWith("/css/")
				|| path.startsWith("/js/")
				|| path.startsWith("/images/")
				|| path.startsWith("/webjars/")
				|| path.endsWith(".html")
				|| path.endsWith(".css")
				|| path.endsWith(".js")
				|| path.endsWith(".png")
				|| path.endsWith(".jpg")
				|| path.endsWith(".jpeg")
				|| path.endsWith(".gif")
				|| path.endsWith(".svg")
				|| path.endsWith(".ico");
	}
}