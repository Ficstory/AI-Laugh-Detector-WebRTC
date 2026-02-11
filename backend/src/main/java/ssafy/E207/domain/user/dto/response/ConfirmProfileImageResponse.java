package ssafy.E207.domain.user.dto.response;

import lombok.Builder;

@Builder
public record ConfirmProfileImageResponse(
        String profileImageUrl
) {
    public static ConfirmProfileImageResponse of(String profileImageUrl) {
        return ConfirmProfileImageResponse.builder()
                .profileImageUrl(profileImageUrl)
                .build();
    }
}

