package ssafy.E207.domain.match.config;

import java.security.Principal;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ssafy.E207.domain.match.service.MatchmakingService;
import ssafy.E207.domain.match.service.RoomService;
import ssafy.E207.global.jwt.UserPrincipal;

// 로그용
@RequiredArgsConstructor
@Component
@Slf4j
public class StompEventHandler {
	// [추가] 유저 ID별 현재 활성화된 '최신' 세션 ID를 추적하는 맵
	private final Map<UUID, String> userActiveSessions = new ConcurrentHashMap<>();

	private final Set<String> sessions = ConcurrentHashMap.newKeySet();
	private final RoomService roomService;
	private final MatchmakingService matchmakingService;

	@EventListener
	public void connectHandle(SessionConnectedEvent event) {
		StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
		String sessionId = accessor.getSessionId();
		Principal principal = accessor.getUser();

		if (principal != null) {
			Authentication auth = (Authentication) principal;
			UserPrincipal userPrincipal = (UserPrincipal) auth.getPrincipal();
			UUID userId = userPrincipal.getUserId();

			// [핵심] 새로운 세션이 연결되면 이 유저의 활성 세션 ID를 갱신합니다.
			userActiveSessions.put(userId, sessionId);
			log.info("유저 {} 의 활성 세션 갱신: {}", userId, sessionId);
		}

		sessions.add(sessionId);
		log.info("connect session ID: {}", sessionId);
	}

	@EventListener
	public void disconnectHandle(SessionDisconnectEvent event) {
		StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
		String disconnectedSessionId = accessor.getSessionId();
		Principal principal = accessor.getUser();

		if (principal != null) {
			Authentication auth = (Authentication) principal;
			UserPrincipal userPrincipal = (UserPrincipal) auth.getPrincipal();
			UUID userId = userPrincipal.getUserId();

			// [핵심 로직] 끊긴 세션이 이 유저의 현재 활성 세션인지 확인합니다.
			String currentActiveSessionId = userActiveSessions.get(userId);

			if (!disconnectedSessionId.equals(currentActiveSessionId)) {
				// 끊긴 건 과거 세션(X)이고, 현재 유저는 새 세션(Y)으로 잘 붙어 있는 상태라면 무시
				log.info("과거 유령 세션 무시 (UserId: {}, Disconnected: {}, Current: {})",
					userId, disconnectedSessionId, currentActiveSessionId);

				// 공통 세션 카운트만 제거하고 종료
				sessions.remove(disconnectedSessionId);
				return;
			}

			// 현재 활성 세션이 끊긴 것이 맞다면 로직 수행
			log.info("유저 실질적 연결 끊김 감지: {}", userId);
			userActiveSessions.remove(userId); // 활성 세션 정보 삭제

			// 1. 매칭 대기열에서 제거
			matchmakingService.removeFromQueue(userId);

			Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
			if (sessionAttributes != null && sessionAttributes.containsKey("SUBSCRIBED_ROOM_ID")) {
				String roomId = (String) sessionAttributes.get("SUBSCRIBED_ROOM_ID");
				log.info("방 퇴장 처리 - 유저: {}, 방: {}", userId, roomId);
				roomService.handleUserExit(Long.parseLong(roomId), userId);
			}
		}

		sessions.remove(disconnectedSessionId);
		log.info("disconnect session ID: {}", disconnectedSessionId);
		log.info("total session: {}", sessions.size());
	}
}