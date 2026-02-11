package ssafy.E207.domain.user.dto.request;

import jakarta.validation.constraints.NotBlank;

public record DeleteProfileImageRequest(
        @NotBlank(message = "objectKey는 필수입니다.")
        String objectKey,

        // 회원가입 시 사용 (로그인 유저는 Authorization 헤더 사용)
        String registerToken
) {
}

