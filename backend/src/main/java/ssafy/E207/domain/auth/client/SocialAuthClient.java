package ssafy.E207.domain.auth.client;

import ssafy.E207.domain.auth.dto.response.SocialUserInfo;
import ssafy.E207.global.common.enums.OAuthProvider;

public interface SocialAuthClient {
	OAuthProvider getProvider();
	String requestAccessToken(String code, String redirectUri);
	SocialUserInfo getUserInfo(String accessToken);
}
