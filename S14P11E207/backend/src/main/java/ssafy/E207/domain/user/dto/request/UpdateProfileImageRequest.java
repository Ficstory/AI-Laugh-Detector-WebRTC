package ssafy.E207.domain.user.dto.request;

import jakarta.validation.constraints.NotBlank;

public record UpdateProfileImageRequest(
		@NotBlank(message = "잘못된 요청입니다.")
		String profileImageUrl
) {
}