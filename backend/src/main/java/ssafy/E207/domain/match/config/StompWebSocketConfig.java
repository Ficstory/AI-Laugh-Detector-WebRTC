package ssafy.E207.domain.match.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class StompWebSocketConfig implements WebSocketMessageBrokerConfigurer {
	private final StompJwtInterceptor stompJwtInterceptor;

	// 웹소켓 통신을 맺을 경로를 지정
	// 클라이언트측에서 이 경로로 소켓을 받아오게 됨
	@Override
	public void registerStompEndpoints(StompEndpointRegistry registry) {
		registry.addEndpoint("/connect")
			.setAllowedOriginPatterns("*") // 개발 편의성을 위해 와일드카드 패턴 허용 (보안 요건에 따라 구체적 명시 필요)
			// ws:// 말고 http:// 엔드포인트를 사용할 수 있게 해 주는 sockjs 라이브러리를 통한 요청을 허용.
			.withSockJS();
	}

	// 메세지 발행(publish)/수신(subscribe) 경로 설정
	@Override
	public void configureMessageBroker(MessageBrokerRegistry registry) {
		// 서버로 보내는 발행 요청
		// 예를 들어 /publish/**로 발행 요청이 오면, 컨트롤러 내 @MessageMapping 어노테이션이 붙은 메서드로 보내줌
		registry.setApplicationDestinationPrefixes("/publish");

		// 클라이언트가 서버에게서 받을 메세지 경로
		// /topic/**, /user/queue/**
		registry.enableSimpleBroker("/topic", "/queue");

		// 서버가 클라이언트에게 1:1로 보낼 경로 prefix 자동추가
		registry.setUserDestinationPrefix("/user");
	}

	// 웹소켓요청(connect, subscribe, disconnect) -> security filter -> interceptor 원래 이렇게 진행될 텐데,
	// 웹소켓요청은 security filter를 거치지 않도록 했다.
	// 대신 interceptor가 웹소켓 요청에 들어 있는 jwt 토큰을 검증한다.
	@Override
	public void configureClientInboundChannel(ChannelRegistration registration) {
		registration.interceptors(stompJwtInterceptor);
	}


}
