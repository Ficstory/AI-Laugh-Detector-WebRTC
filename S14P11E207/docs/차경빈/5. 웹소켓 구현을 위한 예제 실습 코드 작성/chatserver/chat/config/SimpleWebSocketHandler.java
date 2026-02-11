//package com.example.chatserver.chat.config;
//
//import lombok.extern.slf4j.Slf4j;
//import org.springframework.stereotype.Component;
//import org.springframework.web.socket.*;
//import org.springframework.web.socket.handler.TextWebSocketHandler;
//
//import java.util.Set;
//import java.util.concurrent.ConcurrentHashMap;
//
//// /connect로 연결이 들어왔을 때 이를 처리
//
//@Component
//@Slf4j
//public class SimpleWebSocketHandler extends TextWebSocketHandler {
//
//    // 연결된 세션들(스레드세이프)
//    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();
//
//    @Override
//    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
//        sessions.add(session);
//        log.info("connected: {}", session.getId());
//    }
//
//    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
//        String payload = message.getPayload();
//        log.info("received message : {}", payload);
//        // 웹소켓 테스트: 전체 세션에 메세지 돌림
//        for(WebSocketSession s: sessions){
//            if(s.isOpen()){
//                s.sendMessage(new TextMessage(payload));
//            }
//        }
//    }
//
//    @Override
//    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
//        sessions.remove(session);
//        log.info("disconnected: {}", session.getId());
//    }
//
//}
