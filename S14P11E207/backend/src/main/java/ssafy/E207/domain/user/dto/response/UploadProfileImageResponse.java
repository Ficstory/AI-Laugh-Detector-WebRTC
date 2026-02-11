package ssafy.E207.domain.user.dto.response;

import lombok.Builder;

@Builder
public record UploadProfileImageResponse(
        String uploadUrl,
        String objectKey
) {
    public static UploadProfileImageResponse of(String uploadUrl, String objectKey) {
        return UploadProfileImageResponse.builder()
                .uploadUrl(uploadUrl)
                .objectKey(objectKey)
                .build();
    }
}

