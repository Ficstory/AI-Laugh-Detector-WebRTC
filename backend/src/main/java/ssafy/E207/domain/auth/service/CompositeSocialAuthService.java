package ssafy.E207.domain.auth.service;

import org.springframework.stereotype.Service;
import ssafy.E207.domain.auth.client.SocialAuthClient;
import ssafy.E207.domain.auth.dto.response.SocialUserInfo;
import ssafy.E207.global.common.enums.OAuthProvider;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CompositeSocialAuthService {

	private final Map<OAuthProvider, SocialAuthClient> clientMap;

	public CompositeSocialAuthService(List<SocialAuthClient> clients) {
		this.clientMap = clients.stream()
			.collect(Collectors.toMap(SocialAuthClient::getProvider, Function.identity()));
	}

	public SocialUserInfo getUserInfo(OAuthProvider provider, String authorizationCode, String redirectUri) {
		SocialAuthClient client = clientMap.get(provider);
		if (client == null) {
			throw new IllegalArgumentException("지원하지 않는 소셜 로그인 제공자입니다: " + provider);
		}

		String accessToken = client.requestAccessToken(authorizationCode, redirectUri);
		return client.getUserInfo(accessToken);
	}
}
