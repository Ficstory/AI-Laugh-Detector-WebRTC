package ssafy.E207.domain.user.dto.request;

import jakarta.validation.constraints.NotNull;

public record UpdateMarketingRequest(
		@NotNull(message = "잘못된 요청입니다.")
		Boolean isMarketing
) {
}

