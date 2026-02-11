package com.example.chatserver.chat.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class StompWebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompHandler stompHandler;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/connect")
                .setAllowedOrigins("http://localhost:3000")
                // ws:// 말고 http:// 엔드포인트를 사용할 수 있게 해 주는 sockjs 라이브러리를 통한 요청을 허용.
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // 메세지를 발행하는 경로
        // /publish (/publish/{방번호})로 시작하는 url 패턴으로 메세지가 발행되면 @Controller 객체의 @MessageMapping이 붙어 있는 메서드로 라우팅
        registry.setApplicationDestinationPrefixes("/publish");

        // /topic (/topic/{방번호}) 형태로 메세지를 수신(subscribe)해야 함
        registry.enableSimpleBroker("/topic");
    }

    // 웹소켓요청(connect, subscribe, disconnect) -> security filter -> interceptor 원래 이렇게 진행될 텐데,
    // 웹소켓요청은 security filter를 거치지 않도록 했다. (securityconfigs에서 그렇게 설정함)
    // 대신 interceptor가 웹소켓요청을 검증한다. stomp 헤더에 들어 있는 token 뺌.
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompHandler);
    }

}
