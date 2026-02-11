package ssafy.E207.domain.match.service;

import java.util.Map;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;

import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Service;

import io.openvidu.java.client.OpenViduHttpException;
import io.openvidu.java.client.OpenViduJavaClientException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import ssafy.E207.domain.match.dto.PendingUser;
import ssafy.E207.domain.match.dto.request.RoomCreateRequest;
import ssafy.E207.domain.match.dto.response.MatchmakingResultDto;
import ssafy.E207.domain.match.dto.response.StompResponse;
import ssafy.E207.domain.match.entity.Room;
import ssafy.E207.global.common.enums.StompMessageType;

@Transactional
@RequiredArgsConstructor
@Service
public class MatchmakingService {
	private final Queue<PendingUser> waitingQueue = new ConcurrentLinkedQueue<>();
	private final RoomService roomService;
	private final SimpMessageSendingOperations messageTemplate;
	private final ElectronSignatureCheckService electronSignatureCheckService;

	public synchronized void addToQueue(UUID userId, HttpServletRequest request
	) throws OpenViduJavaClientException, OpenViduHttpException {
		if (waitingQueue.stream().anyMatch(pu -> pu.userId().equals(userId))) {
			return;
		}

		boolean isElectron = electronSignatureCheckService.isElectronApp(request);


		waitingQueue.add(new PendingUser(userId, isElectron));
		System.out.println("현재 큐에 있는 유저:");
		for(PendingUser pu : waitingQueue){
			System.out.println(pu.toString());
		}

		if (waitingQueue.size() >= 2) {
			System.out.println("매칭 시작");
			PendingUser user1 = waitingQueue.poll();
			PendingUser user2 = waitingQueue.poll();

			MatchmakingResultDto resultDto = roomService.createRoomFromMatchmaking(user1, user2);

			messageTemplate.convertAndSendToUser(
				user1.userId().toString(),
				"/queue/match",
				StompResponse.builder()
					.type(StompMessageType.RESPONSE_MATCHMAKING_SUCCESS)
					.senderId(null)
					.senderNickname("시스템")
					.message("매칭이 완료되었습니다.")
					.data(Map.of("id", resultDto.getId(), "name", resultDto.getName(), "token", resultDto.getToken1(), "participants", resultDto.getParticipants()))
					.build()
			);
			messageTemplate.convertAndSendToUser(
				user2.userId().toString(),
				"/queue/match",
				StompResponse.builder()
					.type(StompMessageType.RESPONSE_MATCHMAKING_SUCCESS)
					.senderId(null)
					.senderNickname("시스템")
					.message("매칭이 완료되었습니다.")
					.data(Map.of("id", resultDto.getId(), "name", resultDto.getName(), "token", resultDto.getToken2(), "participants", resultDto.getParticipants()))
					.build()
			);
		}
	}

	public synchronized void removeFromQueue(UUID userId) {
		waitingQueue.removeIf(pu -> pu.userId().equals(userId));
	}

}
