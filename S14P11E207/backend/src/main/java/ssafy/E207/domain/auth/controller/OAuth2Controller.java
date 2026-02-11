package ssafy.E207.domain.auth.controller;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;
import ssafy.E207.domain.auth.dto.request.OAuthLoginRequest;
import ssafy.E207.domain.auth.dto.response.AuthTokenResponse;
import ssafy.E207.domain.auth.dto.response.LoginResponse;
import ssafy.E207.domain.auth.exception.NeedRegistrationException;
import ssafy.E207.domain.auth.exception.SocialAuthException;
import ssafy.E207.domain.auth.service.AuthService;
import ssafy.E207.global.common.enums.OAuthProvider;
import ssafy.E207.global.common.template.ResTemplate;
import ssafy.E207.global.config.social.GoogleProperties;
import ssafy.E207.global.config.social.KakaoProperties;
import ssafy.E207.global.config.social.NaverProperties;
import ssafy.E207.global.jwt.JwtCookieProvider;

import java.util.Objects;

import static org.springframework.http.HttpHeaders.LOCATION;
import static org.springframework.http.HttpHeaders.SET_COOKIE;

/**
 * 현업형 OAuth2 라우팅.
 *
 * <ul>
 *   <li>인가 시작: GET /oauth2/authorization/{provider}</li>
 *   <li>인가 콜백: GET /oauth2/callback/{provider}</li>
 * </ul>
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/oauth2")
public class OAuth2Controller {

    private final AuthService authService;
    private final JwtCookieProvider jwtCookieProvider;

    private final KakaoProperties kakaoProperties;
    private final NaverProperties naverProperties;
    private final GoogleProperties googleProperties;

    @GetMapping("/authorization/{provider}")
    public ResponseEntity<Void> authorization(@PathVariable String provider) {
        OAuthProvider oauthProvider = parseProvider(provider);
        String redirectUri = getRedirectUri(oauthProvider);

        UriComponentsBuilder builder = switch (oauthProvider) {
            case KAKAO -> UriComponentsBuilder
                    .fromUriString("https://kauth.kakao.com/oauth/authorize")
                    .queryParam("response_type", "code")
                    .queryParam("client_id", kakaoProperties.getClientId())
                    .queryParam("redirect_uri", redirectUri);
            case NAVER -> UriComponentsBuilder
                    .fromUriString("https://nid.naver.com/oauth2.0/authorize")
                    .queryParam("response_type", "code")
                    .queryParam("client_id", naverProperties.getClientId())
                    .queryParam("redirect_uri", redirectUri)
                    .queryParam("state", "E207");
            case GOOGLE -> UriComponentsBuilder
                    .fromUriString("https://accounts.google.com/o/oauth2/v2/auth")
                    .queryParam("response_type", "code")
                    .queryParam("client_id", googleProperties.getClientId())
                    .queryParam("redirect_uri", redirectUri)
                    .queryParam("scope", "openid email profile")
                    .queryParam("access_type", "offline")
                    .queryParam("prompt", "consent");
        };

        String authorizeUrl = builder.build().encode().toUriString();

        return ResponseEntity.status(HttpStatus.FOUND)
                .header(LOCATION, authorizeUrl)
                .build();
    }

    @GetMapping("/callback/{provider}")
    public Object callback(
            @PathVariable String provider,
            @Valid @RequestParam("code") String code,
            @RequestParam(value = "state", required = false) String state,
            @RequestParam(value = "error", required = false) String error,
            @RequestParam(value = "error_description", required = false) String errorDescription,
            @RequestParam(value = "redirect", required = false) String redirect,
            HttpServletResponse response
    ) {
        OAuthProvider oauthProvider = parseProvider(provider);

        if (error != null) {
            String message = "소셜 로그인 실패: " + error + (errorDescription != null ? (" (" + errorDescription + ")") : "");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ResTemplate.error(HttpStatus.BAD_REQUEST, message));
        }

        if (oauthProvider == OAuthProvider.NAVER && state != null && !Objects.equals(state, "E207")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ResTemplate.error(HttpStatus.BAD_REQUEST, "state 값이 올바르지 않습니다."));
        }

        String redirectUri = getRedirectUri(oauthProvider);
        OAuthLoginRequest request = new OAuthLoginRequest(oauthProvider, code, redirectUri);

        // 기본 리다이렉트 목적지
        String target = (redirect == null || redirect.isBlank()) ? "/auth-test.html" : redirect;

        try {
            LoginResponse data = authService.login(request);

            ResponseCookie refreshCookie = jwtCookieProvider.createRefreshTokenCookie(data.refreshToken());
            response.addHeader(SET_COOKIE, jwtCookieProvider.asHeader(refreshCookie));

            String targetUrl = UriComponentsBuilder.fromUriString(target)
                    .queryParam("accessToken", data.accessToken())
                    .build(true)
                    .toUriString();

            return ResponseEntity.status(HttpStatus.FOUND)
                    .header(LOCATION, targetUrl)
                    .build();
        } catch (NeedRegistrationException e) {
            // 신규 유저: registerToken을 넘겨서 auth-test.html에서 회원가입 테스트로 이어갈 수 있게 함
            String targetUrl = UriComponentsBuilder.fromUriString(target)
                    .queryParam("registerToken", e.getRegisterToken())
                    .build(true)
                    .toUriString();

            return ResponseEntity.status(HttpStatus.FOUND)
                    .header(LOCATION, targetUrl)
                    .build();
        } catch (SocialAuthException e) {
            // 외부 OAuth 서버 통신 오류(구글 토큰 교환 실패 등)
            String targetUrl = UriComponentsBuilder.fromUriString(target)
                    .queryParam("oauthError", e.getMessage())
                    .build(true)
                    .toUriString();

            return ResponseEntity.status(HttpStatus.FOUND)
                    .header(LOCATION, targetUrl)
                    .build();
        }
    }

    private OAuthProvider parseProvider(String raw) {
        try {
            return OAuthProvider.valueOf(raw.trim().toUpperCase());
        } catch (Exception e) {
            throw new IllegalArgumentException("지원하지 않는 provider 입니다: " + raw);
        }
    }

    private String getRedirectUri(OAuthProvider provider) {
        return switch (provider) {
            case KAKAO -> kakaoProperties.getRedirectUri();
            case NAVER -> naverProperties.getRedirectUri();
            case GOOGLE -> googleProperties.getRedirectUri();
        };
    }
}
