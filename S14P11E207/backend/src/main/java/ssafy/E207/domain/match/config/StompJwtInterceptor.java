package ssafy.E207.domain.match.config;

import java.util.UUID;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ssafy.E207.global.jwt.JwtTokenProvider;
import ssafy.E207.global.jwt.UserPrincipal;

@Slf4j
@Component
@RequiredArgsConstructor

// WebSocket connect시 토큰 유효성 검증
public class StompJwtInterceptor implements ChannelInterceptor {
	private final JwtTokenProvider jwtTokenProvider;

	@Override
	public Message<?> preSend(Message<?> message, MessageChannel channel) {
		final StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message.getHeaders(),
			StompHeaderAccessor.class);

		if (accessor.getCommand() == StompCommand.CONNECT) {
			log.info("connect요청시 토큰 유효성 검증 시작");
			String bearerToken = accessor.getFirstNativeHeader("Authorization");
			
			// null 체크 및 Bearer prefix 검증
			if (bearerToken == null || !bearerToken.startsWith("Bearer ")) {
				log.warn("WebSocket 연결 거부: 유효하지 않은 Authorization 헤더");
				throw new org.springframework.messaging.MessageDeliveryException("유효하지 않은 인증 정보입니다.");
			}
			
			String token = bearerToken.substring(7); // Bearer 뺌
			Claims claims = jwtTokenProvider.parseClaims(token);

			// 웹소켓 세션에 유저 정보 저장
			UserPrincipal principal = new UserPrincipal(UUID.fromString(claims.getSubject()));
			UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
				principal,
				null,
				principal.getAuthorities());
			//authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
			accessor.setUser(authentication);
			log.info("user: {}", accessor.getUser().getName());
		}

		// 사용자가 구독을 시도할 때
		if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
			String destination = accessor.getDestination();

			// 방 구독시
			if (destination != null && destination.startsWith("/topic/")) {
				String roomId = destination.replace("/topic/", "");

				// 세션 속성에 roomId 저장
				accessor.getSessionAttributes().put("SUBSCRIBED_ROOM_ID", roomId);
				log.info("웹소켓 세션에 방 번호 저장: {}", roomId);
			}
		}
		return message;
	}
}
