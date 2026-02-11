package ssafy.E207.global.common.data;

import lombok.Builder;

import java.util.UUID;

@Builder
public record UserInfo(
        UUID userId,
        String nickname,
        String profileImageUrl
) {
    public static UserInfo of(UUID userId, String nickname, String profileImageUrl) {
        return UserInfo.builder()
                .userId(userId)
                .nickname(nickname)
                .profileImageUrl(profileImageUrl)
                .build();
    }
}