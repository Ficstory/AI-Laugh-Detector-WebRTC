package ssafy.E207.domain.user.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record UploadProfileImageRequest(
        @NotBlank(message = "contentType은 필수입니다.")
        String contentType,

        @NotNull(message = "fileSize는 필수입니다.")
        @Positive(message = "fileSize는 양수여야 합니다.")
        Long fileSize,

        @NotBlank(message = "originalFileName은 필수입니다.")
        String originalFileName,

        // 회원가입 시 사용 (로그인 유저는 Authorization 헤더 사용)
        String registerToken
) {
}

