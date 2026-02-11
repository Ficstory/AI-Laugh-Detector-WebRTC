package com.example.chatserver.chat.controller;

import com.example.chatserver.chat.dto.ChatMessageDto;
import com.example.chatserver.chat.service.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;

@Slf4j
@Controller
@RequiredArgsConstructor
public class StompController {
    private final SimpMessageSendingOperations messageTemplate;
    private final ChatService chatService;
    // 방법1. messagemapping+sendto 어노테이션
//    // 클라이언트가 /publish/{roomId}로 보내면, spring이 publish 제거후 여기로 보냄/?
//    @MessageMapping("/{roomId}")
//    // DestinationVariable: 웹소켓 컨트롤러 내에서 사용하는 PathVariable같은 거.
//    @SendTo("/topic/{roomId}") // 메세지가 발행되면 메세지를 또 방에 전달해줌
//    public String sendMessage(@DestinationVariable Long roomId, String message){
//        log.info("message: {}", message);
//        return message;
//    }

    // 방법2. messagemapping 어노테이션 + 메서드 내부에서 send
    @MessageMapping("/{roomId}")
    public void sendMessage(@DestinationVariable Long roomId, ChatMessageDto chatMessageDto){
        log.info("message: {}", chatMessageDto);
        chatService.saveMessage(roomId, chatMessageDto);
        messageTemplate.convertAndSend("/topic/"+roomId, chatMessageDto);
    }


}
