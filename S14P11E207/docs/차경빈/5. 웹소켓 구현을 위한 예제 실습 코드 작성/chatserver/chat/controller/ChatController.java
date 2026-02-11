package com.example.chatserver.chat.controller;

import com.example.chatserver.chat.dto.ChatMessageDto;
import com.example.chatserver.chat.dto.ChatRoomListResDto;
import com.example.chatserver.chat.dto.MyChatListResDto;
import com.example.chatserver.chat.service.ChatService;
import com.example.chatserver.auth.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/chat")
@RequiredArgsConstructor
public class ChatController {
    private final ChatService chatService;

    // 그룹채팅방 개설
    @PostMapping("/room/group/create")
    public ResponseEntity<?> createGroupRoom(@RequestParam String roomName){
        chatService.createRoom(roomName, getUserId());
        return ResponseEntity.ok().build();
    }

    // 그룹채팅방 목록 조회
    @GetMapping("/room/group/list")
    public ResponseEntity<?> getGroupChatRooms(){
        List<ChatRoomListResDto> chatRooms = chatService.getGroupChatRooms();
        return new ResponseEntity<>(chatRooms, HttpStatus.OK);
    }

    // 그룹채팅방 참여
    @PostMapping("/room/group/{roomId}/join")
    public ResponseEntity<?> joinGroupChatRoom(@PathVariable Long roomId){
        System.out.println(getUserId()+" joined room "+roomId);
        chatService.addParticipantToGroupChat(roomId, getUserId());
        return ResponseEntity.ok().build();
    }

    // 이전 메세지 조회
    @GetMapping("/history/{roomId}")
    public ResponseEntity<?> getChatHistory(@PathVariable Long roomId){
        List<ChatMessageDto> chatMessageDtos = chatService.getChatHistory(roomId, getUserId());
        return new ResponseEntity<>(chatMessageDtos, HttpStatus.OK);
    }

    // 메세지 읽음처리
    @PostMapping("/room/{roomId}/read")
    public ResponseEntity<?> messageRead(@PathVariable Long roomId){
        chatService.messageRead(roomId, getUserId());
        return ResponseEntity.ok().build();
    }

    // 내 채팅방 목록 조회: roomId, roomName, 그룹채팅여부, 메세지읽음개수 반환
    @GetMapping("/my/rooms")
    public ResponseEntity<?> getMyChatRooms(){
        List<MyChatListResDto> myChatListResDtos = chatService.getMyChatRooms(getUserId());
        return new ResponseEntity<>(myChatListResDtos, HttpStatus.OK);
    }

    // 채팅방 나가기
    @DeleteMapping("/room/group/{roomId}/leave")
    public ResponseEntity<?> leaveGroupChatRoom(@PathVariable Long roomId){
        chatService.leaveGroupChatRoom(getUserId(), roomId);
        return ResponseEntity.ok().build();
    }

    // 개인채팅방 개설 또는 기존 roomId 리턴
    @PostMapping("/room/private/create")
    public ResponseEntity<?> createGroupRoom(@RequestParam Long otherMemberId){
        Long roomId = chatService.getOrCreatePrivateRoom(getUserId(), otherMemberId);
        return new ResponseEntity<>(roomId, HttpStatus.OK);
    }


    // 유저id 조회 공통메서드
    public Long getUserId(){
        Authentication auth =
                SecurityContextHolder.getContext().getAuthentication();
        CustomUserDetails user =
                (CustomUserDetails) auth.getPrincipal();
        Long userId = Long.valueOf(user.getUsername());
        return userId;
    }

}
