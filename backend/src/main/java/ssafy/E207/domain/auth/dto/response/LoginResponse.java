package ssafy.E207.domain.auth.dto.response;

import lombok.Builder;
import ssafy.E207.global.common.data.UserInfo;

@Builder
public record LoginResponse(
        String accessToken,
        String refreshToken,
        UserInfo user
) {
    public static LoginResponse of(AuthTokenResponse tokens, UserInfo userInfo) {
        return LoginResponse.builder()
                .accessToken(tokens.accessToken())
                .refreshToken(tokens.refreshToken())
                .user(userInfo)
                .build();
    }
}