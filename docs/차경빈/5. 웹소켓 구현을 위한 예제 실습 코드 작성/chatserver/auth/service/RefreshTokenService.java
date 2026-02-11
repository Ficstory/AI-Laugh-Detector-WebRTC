package com.example.chatserver.auth.service;

import com.example.chatserver.auth.JwtTokenProvider;
import com.example.chatserver.auth.domain.RefreshToken;
import com.example.chatserver.auth.dto.ReissueRefreshTokenReqDto;
import com.example.chatserver.auth.repository.RefreshTokenRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Transactional
public class RefreshTokenService {
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtTokenProvider jwtTokenProvider;

    public String reissue(ReissueRefreshTokenReqDto reissueRefreshTokenReqDto) {
        // refresh token 유효성 확인
        String refreshToken = reissueRefreshTokenReqDto.getRefreshToken();

        if (!jwtTokenProvider.validRefreshToken(refreshToken)) {
            throw new UnauthorizedException(ErrorCode.INVALID_TOKEN);
        }

        /* refreshToken 만료 여부 확인 */
        if(refreshTokenRepository.findRefreshTokenByJwtRefreshToken(postRefreshTokenDto.getJwtRefreshToken()).isEmpty()){
            throw new UnauthorizedException(ErrorCode.INVALID_REFRESH_TOKEN);
        }

        final GetJwtTokenDto generateToken = GetJwtTokenDto.builder()
                .jwtAccessToken("Bearer " + jwtTokenProvider.generateAccessToken(member.getEmail(), new Date()))
                .jwtRefreshToken(postRefreshTokenDto.getJwtRefreshToken())
                .build();

        return generateToken;
    }

    // 나중에 member쪽으로 옮기기..
    // 그리고 controller에 reissue 생성
    // ..
    public void logout(Member member, PostRefreshTokenDto postRefreshTokenDto) {
        /* refreshToken 만료 여부 확인 */
        if(refreshTokenRepository.findRefreshTokenByJwtRefreshToken(postRefreshTokenDto.getJwtRefreshToken()).isEmpty()){
            throw new UnauthorizedException(ErrorCode.INVALID_REFRESH_TOKEN);
        }

        refreshTokenService.removeRefreshToken(postRefreshTokenDto.getJwtRefreshToken());
        SecurityContextHolder.clearContext();
    }
    출처: https://cn-c.tistory.com/121#RefreshTokenRepository-1 [Codename Cathy:티스토리]

    public void saveRefreshToken(String refreshToken, String key) {
        RefreshToken token = RefreshToken.builder()
                .refreshToken(refreshToken)
                .key(key)
                .build();
        refreshTokenRepository.save(token);
    }

    public void removeRefreshToken(String refreshToken) {
        refreshTokenRepository.findRefreshTokenByRefreshToken(refreshToken)
                .ifPresent(token -> refreshTokenRepository.delete(token));
    }
}