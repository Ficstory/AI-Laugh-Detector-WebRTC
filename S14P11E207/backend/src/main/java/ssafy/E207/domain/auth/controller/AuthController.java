package ssafy.E207.domain.auth.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ssafy.E207.domain.auth.dto.request.OAuthLoginRequest;
import ssafy.E207.domain.auth.dto.request.SignUpRequest;
import ssafy.E207.domain.auth.dto.response.AuthTokenResponse;
import ssafy.E207.domain.auth.dto.response.LoginResponse;
import ssafy.E207.domain.auth.exception.TokenNotFoundException;
import ssafy.E207.global.common.template.ResTemplate;
import ssafy.E207.global.jwt.UserPrincipal;
import ssafy.E207.domain.auth.service.AuthService;
import ssafy.E207.global.jwt.JwtCookieProvider;

@RestController
@RequiredArgsConstructor
@RequestMapping("/auth")
public class AuthController {
    private final AuthService authService;
    private final JwtCookieProvider jwtCookieProvider;

    @PostMapping("/login")
    public ResponseEntity<ResTemplate<?>> login(@Valid @RequestBody OAuthLoginRequest request) {
        LoginResponse result = authService.login(request);
        ResponseCookie refreshCookie = jwtCookieProvider.createRefreshTokenCookie(result.refreshToken());

        HttpStatus status = HttpStatus.OK;
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, jwtCookieProvider.asHeader(refreshCookie))
                .body(new ResTemplate<>(status, "로그인 성공", result));
    }

    /**
     * [API] 회원가입 - 프로필 저장 후 토큰 발급
     *
     * @param request 회원가입 요청 페이로드
     * @return Access/Refresh 토큰 응답
     */
    @PostMapping("/regist")
    public ResponseEntity<ResTemplate<AuthTokenResponse>> signUp(@Valid @RequestBody SignUpRequest request) {
        AuthTokenResponse tokens = authService.signUp(request);
        ResponseCookie refreshCookie = jwtCookieProvider.createRefreshTokenCookie(tokens.refreshToken());

        HttpStatus status = HttpStatus.CREATED; // 상황에 따라 변경될 가능성 있음
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, jwtCookieProvider.asHeader(refreshCookie))
                .body(new ResTemplate<>(status, "회원가입 성공", tokens));
    }

    /**
     * [API] 로그아웃 - 리프레시 토큰 폐기 및 쿠키 제거
     *
     * @param principal 인증된 사용자 정보
     * @return 로그아웃 처리 결과
     */
    @PostMapping("/logout")
    public ResponseEntity<ResTemplate<Void>> logout(@AuthenticationPrincipal UserPrincipal principal) {
        authService.logout(principal.getUserId());
        ResponseCookie deleteCookie = jwtCookieProvider.deleteRefreshTokenCookie();

        HttpStatus status = HttpStatus.OK; // 상황에 따라 변경될 가능성 있음
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, jwtCookieProvider.asHeader(deleteCookie))
                .body(new ResTemplate<>(status, "로그아웃 성공", null));
    }

    /**
     * [API] 회원탈퇴 - 사용자 및 토큰 데이터 삭제
     *
     * @param principal 인증된 사용자 정보
     * @return 탈퇴 처리 결과
     */
    @DeleteMapping("/delete")
    public ResponseEntity<ResTemplate<Void>> withdraw(@AuthenticationPrincipal UserPrincipal principal) {
        authService.deleteUser(principal.getUserId());
        ResponseCookie deleteCookie = jwtCookieProvider.deleteRefreshTokenCookie();

        HttpStatus status = HttpStatus.OK; // 상황에 따라 변경될 가능성 있음
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, jwtCookieProvider.asHeader(deleteCookie))
                .body(new ResTemplate<>(status, "회원탈퇴 성공", null));
    }


    /**
     * [API] 토큰 재발급 - 쿠키의 리프레시 토큰으로 액세스 토큰 갱신
     *
     * @param refreshToken 쿠키에 담긴 리프레시 토큰
     * @return 재발급된 Access/Refresh 토큰 응답
     */
    @PostMapping("/refresh")
    public ResponseEntity<ResTemplate<AuthTokenResponse>> refresh(
            @CookieValue(value = "refresh_token", required = false) String refreshToken) {

        if (refreshToken == null) {
            throw TokenNotFoundException.tokenNotFound();
        }

        AuthTokenResponse tokens = authService.refresh(refreshToken);
        ResponseCookie refreshCookie = jwtCookieProvider.createRefreshTokenCookie(tokens.refreshToken());

        HttpStatus status = HttpStatus.OK;
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, jwtCookieProvider.asHeader(refreshCookie))
                .body(new ResTemplate<>(status, "토큰 재발급 성공", tokens));
    }
}

