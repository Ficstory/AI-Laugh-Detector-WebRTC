package ssafy.E207.domain.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * [Auth][DTO] SignUpRequest
 *
 * <p>
 * [Data Group]
 * - registerToken, nickname, isMaketing
 * </p>
 * - 정합성 키워드: 닉네임 중복 검사, 그룹 ID 존재 여부
 * - 보안 키워드: OAuthProvider와 oauthId로 계정 연결
 */
public record SignUpRequest(
		@NotBlank(message = "registerToken은 필수입니다.") String registerToken,
		@NotBlank(message = "닉네임은 필수입니다.") String nickname,
		String profileImage,
		@NotNull(message = "마케팅 수신 동의 여부를 입력해주세요.") Boolean isMarketing
) {
}