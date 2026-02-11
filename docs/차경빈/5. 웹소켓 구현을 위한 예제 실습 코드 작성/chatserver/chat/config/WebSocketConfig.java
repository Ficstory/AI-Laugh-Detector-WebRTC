//package com.example.chatserver.chat.config;
//
//import lombok.RequiredArgsConstructor;
//import org.springframework.context.annotation.Configuration;
//import org.springframework.web.socket.config.annotation.EnableWebSocket;
//import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
//import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
//
//@Configuration
//@EnableWebSocket
//@RequiredArgsConstructor
//public class WebSocketConfig implements WebSocketConfigurer {
//    private final SimpleWebSocketHandler simpleWebSocketHandler;
//    @Override
//    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
//        // /connect로 연결요청 들어오면 핸들러가 처리
//        registry.addHandler(simpleWebSocketHandler, "/connect")
//                // securityconfig은 http 요청에 대한 예외
//                // websocketconfig는 ws 프로토콜 요청에 대한 예외
//                // securityconfig 가서 /connect 허용해줘야함
//                .setAllowedOrigins("http://localhost:3000");
//    }
//}
