package ssafy.E207.domain.match.controller;

import java.security.Principal;
import java.util.UUID;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ssafy.E207.domain.match.dto.request.StompRequest;
import ssafy.E207.domain.match.dto.response.StompResponse;
import ssafy.E207.domain.match.service.StompMessageService;
import ssafy.E207.global.jwt.UserPrincipal;

@Slf4j
@Controller
@RequiredArgsConstructor
public class StompMessageController {

	private final StompMessageService stompMessageService;

	//publish/{roomId}
	@MessageMapping("/{roomId}")
	public void handleMessage(@DestinationVariable Long roomId, @Payload StompRequest stompRequest, Principal principal) {
		Authentication auth = (Authentication)principal;
		UserPrincipal userPrincipal = (UserPrincipal)auth.getPrincipal();
		UUID senderId = userPrincipal.getUserId();
		stompMessageService.handleMessage(roomId, senderId, stompRequest);
	}

}
