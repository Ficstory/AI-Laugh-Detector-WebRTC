package ssafy.E207.domain.match.controller;

import java.security.Principal;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.openvidu.java.client.OpenViduHttpException;
import io.openvidu.java.client.OpenViduJavaClientException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import ssafy.E207.domain.match.service.MatchmakingService;
import ssafy.E207.global.common.template.ResTemplate;
import ssafy.E207.global.jwt.UserPrincipal;

@RestController
@RequestMapping("/matchmaking")
@RequiredArgsConstructor
public class MatchmakingController {
	private final MatchmakingService matchmakingService;

	// 매칭을 시작하고, 클라이언트에게 매칭 시작되었다는 메세지 보냄
	// /matchmaking/start
	@PostMapping("/start")
	public ResTemplate<Void> startMatchmaking(@AuthenticationPrincipal UserPrincipal principal, HttpServletRequest request
	) throws
		OpenViduJavaClientException,
		OpenViduHttpException {
		System.out.println("started matchmaking: " + principal);

		matchmakingService.addToQueue(principal.getUserId(), request);
		// matchmakingService.addToQueue(principal.getUserId(), request);

		return ResTemplate.success(HttpStatus.OK, "매칭이 시작되었습니다.");
	}

	@PostMapping("/cancel")
	public ResTemplate<Void> cancelMatch(@AuthenticationPrincipal UserPrincipal principal) {
		System.out.println("cancel matchmaking: " + principal);
		matchmakingService.removeFromQueue(principal.getUserId());
		return ResTemplate.success(HttpStatus.OK, "매칭이 취소되었습니다.");
	}
}
