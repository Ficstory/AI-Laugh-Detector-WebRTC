package ssafy.E207.domain.auth.dto.response;

import lombok.Builder;
import ssafy.E207.global.common.enums.OAuthProvider;

@Builder
public record SocialUserInfo(
		String id,
		OAuthProvider provider) {
	public static SocialUserInfo of(String id, OAuthProvider provider) {
		return SocialUserInfo.builder()
				.id(id)
				.provider(provider)
				.build();
	}
}
