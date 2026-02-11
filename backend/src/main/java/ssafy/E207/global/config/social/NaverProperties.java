package ssafy.E207.global.config.social;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "oauth.naver")
public class NaverProperties {
	private String clientId;
	private String clientSecret;
	private String redirectUri;
}
