package ssafy.E207.domain.user.dto.response;

import lombok.Builder;
import ssafy.E207.domain.auth.entity.User;

@Builder
public record UserChangeResponse(
        UserDto user
) {
    @Builder
    public record UserDto(
            String id,
            String nickname,
            String profileImageUrl,
            Boolean isMarketing
    ) {
        public static UserDto from(User user, String profileImageUrl) {
            return UserDto.builder()
                    .id(user.getId().toString())
                    .nickname(user.getNickname())
                    .profileImageUrl(profileImageUrl)
                    .isMarketing(user.isMarketing())
                    .build();
        }
    }

    public static UserChangeResponse from(User user, String profileImageUrl) {
        return UserChangeResponse.builder()
                .user(UserDto.from(user, profileImageUrl))
                .build();
    }
}

