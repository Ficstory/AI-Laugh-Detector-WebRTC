package ssafy.E207.domain.auth.service;

import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ssafy.E207.domain.auth.dto.request.OAuthLoginRequest;
import ssafy.E207.domain.auth.dto.request.SignUpRequest;
import ssafy.E207.domain.auth.dto.response.AuthTokenResponse;
import ssafy.E207.domain.auth.dto.response.LoginResponse;
import ssafy.E207.domain.auth.dto.response.SocialUserInfo;
import ssafy.E207.domain.auth.entity.User;
import ssafy.E207.domain.auth.exception.*;
import ssafy.E207.domain.auth.repository.RefreshTokenRepository;
import ssafy.E207.domain.user.repository.UserRepository;
import ssafy.E207.domain.user.service.UserService;
import ssafy.E207.global.common.RefreshToken;
import ssafy.E207.global.common.data.UserInfo;
import ssafy.E207.global.common.enums.OAuthProvider;
import ssafy.E207.global.jwt.JwtProperties;
import ssafy.E207.global.jwt.JwtTokenProvider;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * [Auth][Service] AuthService
 *
 * OAuth 로그인, 회원가입, 로그아웃, 회원탈퇴 등 인증 흐름 담당.
 *
 * <p>[Auth Flow]</p>
 *
 * <pre>
 * 1. Login/SignUp
 *    [Request] -> [Validate] -> [User Lookup/Save] -> [Issue Tokens] -> [Response]
 *
 * 2. Token Strategy
 *    - Access Token: Short-lived (Header)
 *    - Refresh Token: Long-lived (HttpOnly Cookie, DB Saved)
 * </pre>
 *
 * - 토큰 전략: Access + Refresh 발급 및 회수
 * - 검증 포인트: 닉네임 중복, 그룹 ID 유효성, 리프레시 토큰 존재 여부
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {
    private final JwtProperties jwtProperties;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final CompositeSocialAuthService compositeSocialAuthService;
    private final UserService userService;
    private final ssafy.E207.domain.match.repository.RoomRepository roomRepository;
    private final ssafy.E207.domain.match.repository.RoomParticipantRepository roomParticipantRepository;
    private final ssafy.E207.domain.match.service.RoomService roomService;

    /**
     * [Login] OAuth 로그인 성공 시 토큰 발급.
     *
     * @param request OAuth 로그인 요청 정보 (authorizationCode 포함)
     * @return 액세스/리프레시 토큰 묶음
     */
    @Transactional
    public LoginResponse login(OAuthLoginRequest request) {
        // 1. 인가 코드로 소셜 플랫폼에서 사용자 정보 조회 (Strategy Pattern)
        SocialUserInfo socialUser = compositeSocialAuthService.getUserInfo(
                request.oauthProvider(),
                request.authorizationCode(),
                request.redirectUri());

        // 2. DB에서 사용자 조회
        User user = userRepository.findByOauthProviderAndOauthId(socialUser.provider(), socialUser.id())
                .orElseThrow(() -> {
                    // 3. 회원가입 필요 시: 서명된 임시 토큰(RegisterToken) 발급
                    String registerToken = jwtTokenProvider.createRegisterToken(socialUser.id(),
                            socialUser.provider().name());
                    return new NeedRegistrationException(registerToken);
                });

        // 4. 토큰 발급
        AuthTokenResponse tokens = issueTokens(user);

        UserInfo userInfo = new UserInfo(
                user.getId(),
                user.getNickname(),
                user.getProfileImage()
        );

        return LoginResponse.of(tokens, userInfo);
    }

    /**
     * [Refresh] 리프레시 토큰을 이용한 토큰 재발급.
     *
     * @param refreshToken 클라이언트 쿠키에서 추출한 리프레시 토큰
     * @return 재발급된 Access/Refresh 토큰 묶음
     */
    @Transactional
    public AuthTokenResponse refresh(String refreshToken) {
        // 1. 토큰 자체 유효성 검증 (만료, 서명 등)
        try {
            jwtTokenProvider.parseClaims(refreshToken);
        } catch (io.jsonwebtoken.ExpiredJwtException e) {
            throw InvalidTokenException.expired();
        }

        // 2. DB 저장된 토큰과 비교 (Rotation)
        User user = findUserByToken(refreshToken);

        // 3. 토큰 재발급 및 갱신
        return issueTokens(user);
    }

    private User findUserByToken(String refreshToken) {
        UUID userId;
        try {
            // UUID 형식 검증
            userId = UUID.fromString(jwtTokenProvider.parseClaims(refreshToken).getSubject());
        } catch (IllegalArgumentException e) {
            // 401 Invalid Token
            throw new InvalidTokenException("잘못된 토큰 형식입니다.");
        }

        // Redis 토큰 조회 (Rotation Check)
        RefreshToken savedToken = refreshTokenRepository.findById(Objects.requireNonNull(userId.toString()))
                .orElseThrow(() -> new InvalidTokenException("로그인이 만료되었습니다. 다시 로그인해주세요."));

        // 토큰 탈취 감지 (값 불일치)
        if (!savedToken.getTokenValue().equals(refreshToken)) {
            // 탈취된 토큰 삭제 및 재로그인 유도
            refreshTokenRepository.delete(savedToken);
            throw new InvalidTokenException("유효하지 않은 토큰입니다. 다시 로그인해주세요.");
        }

        return userRepository.findById(userId)
                .orElseThrow(AuthNotFoundException::userNotFound);
    }

    /**
     * [SignUp] 신규 회원 정보 저장 및 토큰 발급.
     *
     * @param request 회원가입 요청 정보
     * @return 액세스/리프레시 토큰 묶음
     */
    @Transactional
    public AuthTokenResponse signUp(SignUpRequest request) {
        // 1. 임시 토큰(RegisterToken) 검증 및 정보 추출
        Claims claims = jwtTokenProvider.parseClaims(request.registerToken());
        String oauthId = claims.getSubject();
        OAuthProvider provider = OAuthProvider.valueOf(claims.get("provider", String.class));

        // 2. 중복 가입 방지 체크 (Security Fix)
        if (userRepository.findByOauthProviderAndOauthId(provider, oauthId).isPresent()) {
            throw DuplicateUserException.duplicateUser();
        }

        // 3. 닉네임 정책 검증(형식/중복)
        userService.validateNicknameFormatOrThrow(request.nickname());
        if (userRepository.existsByNickname(request.nickname().trim())) {
            throw DuplicateNicknameException.duplicateNickname();
        }

        User user = buildUser(request, oauthId, provider);
        User savedUser = userRepository.save(user);
        return issueTokens(savedUser);
    }

    /**
     * [Logout] 리프레시 토큰 폐기.
     */
    @Transactional
    public void logout(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(AuthNotFoundException::userNotFound);

        refreshTokenRepository.findById(user.getId().toString())
                .ifPresentOrElse(
                        refreshTokenRepository::delete,
                        () -> {
                            throw TokenNotFoundException.tokenNotFound();
                        });
        log.info("[LOGOUT] userId={} refresh token deleted", userId);
    }

    /**
     * [Withdraw] 회원 탈퇴 시 사용자 및 리프레시 토큰 제거.
     */
    @Transactional
	public void deleteUser(UUID userId) {
		User user = userRepository.findById(userId)
				.orElseThrow(AuthNotFoundException::userNotFound);

		// 1. 참여 중인 모든 방에서 "정상 퇴장" 처리 (방장 권한 위임, 방 폭파 등 로직 수행)
		// RoomService.handleUserExit을 호출하여 RoomService의 로직을 재사용
		List<ssafy.E207.domain.match.entity.RoomParticipant> participants = roomParticipantRepository.findAllByUserId(userId);
		for (ssafy.E207.domain.match.entity.RoomParticipant participant : participants) {
			try {
				roomService.handleUserExit(participant.getRoom().getId(), userId);
			} catch (Exception e) {
				log.error("[WITHDRAW] Error while exiting room: {}", e.getMessage());
				// 방 퇴장 실패해도 계정 탈퇴는 계속 진행 (Safe Fail)
			}
		}
		
		// 2. 혹시 남아있을 수 있는 방장/공격자 참조 제거 (Double Check)
		roomRepository.nullifyHostId(userId);
		roomRepository.nullifyCurrentAttackerId(userId);
		roomParticipantRepository.deleteByUserId(userId); // 만약 handleUserExit이 실패했을 경우를 대비

		// 3. 리프레시 토큰 삭제
		refreshTokenRepository.deleteById(userId.toString());

		// 4. 유저 익명화 (Soft Withdrawal)
		user.withdraw();
		// user is managed by JPA context, so changes will be flushed automatically at transaction commit.

		log.info("[WITHDRAW] userId={} anonymized", userId);
	}

    /**
     * [Token Issuance] Access/Refresh 토큰 생성 및 리프레시 토큰 저장.
     */
    @Transactional
    public AuthTokenResponse issueTokens(User user) {
        String accessToken = jwtTokenProvider.createAccessToken(user);
        String refreshToken = jwtTokenProvider.createRefreshToken(user);
        Instant refreshExpiry = Instant.now().plusSeconds(jwtProperties.getRefreshTokenValidityInSeconds());
        long refreshTtl = jwtProperties.getRefreshTokenValidityInSeconds();

        refreshTokenRepository.findById(user.getId().toString())
                .ifPresentOrElse(
                        existing -> {
                            existing.rotate(refreshToken, refreshExpiry, refreshTtl);
                            refreshTokenRepository.save(existing);
                        },
                        () -> refreshTokenRepository.save(RefreshToken.builder()
                                .id(user.getId().toString())
                                .tokenValue(refreshToken)
                                .expiryAt(refreshExpiry)
                                .ttlSeconds(refreshTtl)
                                .build()));

        return AuthTokenResponse.of(accessToken, refreshToken);
    }


    private User buildUser(SignUpRequest request, String oauthId, OAuthProvider provider) {
        return User.builder()
                .oauthProvider(provider)
                .oauthId(oauthId)
                .nickname(request.nickname())
                .profileImage(request.profileImage())
                .isMarketing(request.isMarketing())
                .build();
    }
}
