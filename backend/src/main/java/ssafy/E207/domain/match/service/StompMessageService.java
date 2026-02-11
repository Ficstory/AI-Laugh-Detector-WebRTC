package ssafy.E207.domain.match.service;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ssafy.E207.domain.auth.entity.User;
import ssafy.E207.global.error.exception.NotFoundUserException;
import ssafy.E207.domain.user.repository.UserRepository;
import ssafy.E207.domain.match.dto.request.StompRequest;
import ssafy.E207.domain.match.dto.response.StompResponse;
import ssafy.E207.domain.match.entity.Room;
import ssafy.E207.domain.match.entity.RoomParticipant;
import ssafy.E207.global.common.enums.ParticipantRole;
import ssafy.E207.global.common.enums.StompMessageType;
import ssafy.E207.global.common.enums.RoomStatus;
import ssafy.E207.global.common.enums.RoomType;
import ssafy.E207.domain.match.repository.RoomParticipantRepository;
import ssafy.E207.domain.match.repository.RoomRepository;
import ssafy.E207.domain.user.service.UserBattleService;

@Slf4j
@RequiredArgsConstructor
@Service
@Transactional
public class StompMessageService {
	private final SimpMessageSendingOperations messageTemplate;
	private final RoomParticipantRepository roomParticipantRepository;
	private final RoomRepository roomRepository;
	private final UserRepository userRepository;
	private final UserBattleService userBattleService;

	public void handleMessage(Long roomId, UUID senderId, StompRequest stompRequest) {
		StompMessageType type = stompRequest.getType();

		log.info("Event: {} | Room: {} | User: {}",
			stompRequest.getType(), roomId, senderId);

		if (StompMessageType.REQUEST_READY_CHANGE == type) {
			handleReadyChange(roomId, senderId, stompRequest);
		} else if (StompMessageType.REQUEST_TURN_SWAP == type) {
			handleTurnSwap(roomId, senderId, stompRequest);
		} else if (StompMessageType.REQUEST_LAUGHED == type) {
			handleLaughed(roomId, senderId, stompRequest);
		} else if (StompMessageType.REQUEST_SURRENDER == type) {
			handleSurrender(roomId, senderId, stompRequest);
		} else if (StompMessageType.REQUEST_BATTLE_START == type) {
			handleBattleStart(roomId, senderId, stompRequest);
		} else if (StompMessageType.REQUEST_REPORT == type) {
			handleReport(roomId, senderId, stompRequest);
		} else {
			sendSystemMessageToUser(senderId, roomId, StompMessageType.RESPONSE_ERROR, "알 수 없는 타입입니다.", null);
		}

	}

	// 준비상태 변경
	public void handleReadyChange(Long roomId, UUID senderId, StompRequest stompRequest) {
		Room room = roomRepository.findById(roomId).orElseThrow();
		// 대기 상태에서만 준비 변경 가능
		if (!RoomStatus.WAITING.equals(room.getStatus())) {
			sendSystemMessageToUser(senderId, roomId,
				StompMessageType.RESPONSE_ERROR, "대기중일 때만 준비 상태 변경이 가능합니다.", null);
			return;
		}

		RoomParticipant senderAsParticipant = roomParticipantRepository.findByRoomIdAndUserId(roomId, senderId)
			.orElseThrow(() -> new NotFoundUserException("참가자 정보 없음"));
		// 방장은 준비상태 변경할 필요 없음
		if (ParticipantRole.HOST.equals(senderAsParticipant.getRole())) {
			sendSystemMessageToUser(senderId, roomId,
				StompMessageType.RESPONSE_ERROR, "방장은 항상 준비 상태입니다.", null);
			return;
		}

		// 참가자 준비상태 변경
		boolean isReady = (boolean)stompRequest.getData().get("isReady");
		senderAsParticipant.setReady(isReady);
		roomParticipantRepository.save(senderAsParticipant);

		// 준비 메세지 보냄
		User sender = userRepository.findById(senderId).orElseThrow(() -> new NotFoundUserException("참가자 정보 없음"));
		sendSystemMessageToRoom(roomId,
			StompMessageType.RESPONSE_READY_CHANGE,
			sender.getNickname() + "님이 " + (isReady ? "준비되었습니다." : "준비를 취소했습니다."),
			Map.of("userId", sender.getId(), "isReady", isReady));

		// 방 종류에 따라 자동시작 처리
		if (RoomType.CASUAL == room.getRoomType()) {
			;
		} else if (room.getRoomType() == RoomType.RANKED) {
			List<RoomParticipant> participants = room.getRoomParticipants();
			if (participants.size() == 2 && participants.stream().allMatch(RoomParticipant::isReady)) {
				log.info("{}번 방 자동 시작", roomId);

				// 방 상태 변경(선공, 방 상태, 시작시간)
				Collections.shuffle(participants);
				User firstAttacker = participants.getFirst().getUser();
				room.updateAttacker(firstAttacker);
				room.updateStatus(RoomStatus.PLAYING);
				room.updateTurnStartedAt(LocalDateTime.now());
				roomRepository.save(room);

				sendSystemMessageToRoom(roomId,
					StompMessageType.RESPONSE_BATTLE_START,
					"게임이 시작되었습니다.",
					Map.of(
						"attackerId", firstAttacker.getId(),
						// "limitTime", 30
						"currentTurn", room.getTurnCount(),
						"currentRound", room.getRoundCount(),
						"currentScores", Map.of(participants.get(0).getUser().getId(),
							0,
							participants.get(1).getUser().getId(),
							0)
					));
			}
		}
	}

	// 게임 시작
	public void handleBattleStart(Long roomId, UUID senderId, StompRequest stompRequest) {
		Room room = roomRepository.findById(roomId).orElseThrow();
		List<RoomParticipant> participants = room.getRoomParticipants();

		// 대기 상태에서만 게임 시작 가능
		if (!RoomStatus.WAITING.equals(room.getStatus())) {
			sendSystemMessageToUser(senderId, roomId,
				StompMessageType.RESPONSE_ERROR, "대기중일 때만 게임 시작이 가능합니다.", null);
			return;
		}

		// 방 생성으로 만들어진 방만 수동으로 게임 시작
		if (RoomType.CASUAL == room.getRoomType()) {
			RoomParticipant senderAsParticipant = roomParticipantRepository.findByRoomIdAndUserId(roomId, senderId)
				.orElseThrow(() -> new NotFoundUserException("참가자 정보 없음"));

			// 방장 체크
			if (!ParticipantRole.HOST.equals(senderAsParticipant.getRole())) {
				sendSystemMessageToUser(senderId, roomId,
					StompMessageType.RESPONSE_ERROR, "방장만 시작할 수 있습니다.", null);
				return;
			}

			// 참여자 인원수 체크
			if (participants.size() != 2) {
				sendSystemMessageToUser(senderId, roomId,
					StompMessageType.RESPONSE_ERROR, "2명이 다 모이지 않았습니다.", null);
				return;
			}
			// 이미 시작했거나 종료결과 보는 상태인지 체크
			else if (RoomStatus.PLAYING.equals(room.getStatus()) || RoomStatus.TERMINATED.equals(room.getStatus())) {
				sendSystemMessageToUser(senderId, roomId,
					StompMessageType.RESPONSE_ERROR, "게임이 이미 시작되었거나 종료된 상태입니다.	", null);
				return;
			}
			// 전부 준비되었는지 체크
			else if (participants.stream().allMatch(RoomParticipant::isReady)) {
				// 방 상태 변경(선공, 방 상태, 시작시간)
				Collections.shuffle(participants);
				User firstAttacker = participants.getFirst().getUser();
				room.updateAttacker(firstAttacker);
				room.updateStatus(RoomStatus.PLAYING);
				room.updateTurnStartedAt(LocalDateTime.now());
				roomRepository.save(room);

				sendSystemMessageToRoom(roomId,
					StompMessageType.RESPONSE_BATTLE_START,
					"게임이 시작되었습니다.",
					Map.of(
						"attackerId", firstAttacker.getId(),
						//"limitTime", 30,
						"currentTurn", room.getTurnCount(),
						"currentRound", room.getRoundCount(),
						"currentScores", Map.of(participants.get(0).getUser().getId(),
							0,
							participants.get(1).getUser().getId(),
							0)
					));
			} else {
				sendSystemMessageToUser(senderId, roomId,
					StompMessageType.RESPONSE_ERROR, "준비되지 않은 사용자가 있습니다.", null);
			}
		} else if (room.getRoomType() == RoomType.RANKED) {
			sendSystemMessageToUser(senderId, roomId,
				StompMessageType.RESPONSE_ERROR, "현재 이 방에서는 두 사람 다 준비 버튼을 누르면 자동으로 시작됩니다.", null);
		}

	}

	// 턴 스왑 검사
	public void handleTurnSwap(Long roomId, UUID senderId, StompRequest stompRequest) {
		Room room = roomRepository.findById(roomId).orElseThrow();
		// 게임중에만 턴 넘기기 가능
		if (!room.getStatus().equals(RoomStatus.PLAYING)) {
			sendSystemMessageToUser(senderId, roomId, StompMessageType.RESPONSE_ERROR, "게임 중에만 턴을 넘길 수 있습니다.", null);
			return;
		}

		User currentAttacker = room.getCurrentAttacker();
		// 공격자만 턴 넘기기 가능
		if (!currentAttacker.getId().equals(senderId)) {
			sendSystemMessageToUser(senderId, roomId, StompMessageType.RESPONSE_ERROR, "공격자만 턴을 넘길 수 있습니다.", null);
			return;
		}

		// 턴 전환 한 번도 안 했을 경우 그냥 턴 전환
		if (room.getTurnCount() == 1) {
			room.incrementTurnCount();

			// 공수교대
			List<RoomParticipant> participants = room.getRoomParticipants();

			int currentIndex = -1;
			for (int i = 0; i < participants.size(); i++) {
				if (participants.get(i).getUser().equals(currentAttacker)) {
					currentIndex = i;
					break;
				}
			}
			int nextIndex = (currentIndex + 1) % participants.size();
			User nextAttacker = participants.get(nextIndex).getUser();

			room.updateAttacker(nextAttacker);
			room.updateTurnStartedAt(LocalDateTime.now());
			roomRepository.save(room);

			sendSystemMessageToRoom(roomId,
				StompMessageType.RESPONSE_TURN_SWAP,
				"턴이 스왑됐습니다. 공격자는 " + nextAttacker.getNickname() + "님입니다!",
				Map.of(
					"reason", StompMessageType.REQUEST_TURN_SWAP,
					"attackerId", nextAttacker.getId(),
					"currentTurn", room.getTurnCount(),
					"currentRound", room.getRoundCount(),
					"currentScores", Map.of(participants.get(0).getUser().getId(), participants.get(0).getWinCount(),
						participants.get(1).getUser().getId(), participants.get(1).getWinCount())
				)
			);
		}
		// 만약 공수교대 한 번씩 했는데 턴 넘기기 들어오면
		// 무승부 처리하고 다음 라운드 갈 준비
		else {
			List<RoomParticipant> participants = room.getRoomParticipants();

			// 근데 이미 3라운드 했으면 게임 종료
			if (room.getRoundCount() == 3) {
				room.updateStatus(RoomStatus.TERMINATED);
				roomRepository.save(room);

				RoomParticipant p1 = participants.get(0);
				RoomParticipant p2 = participants.get(1);
				UUID winnerId = getWinnerId(p1, p2);
				if (winnerId == null) {
					// 무승부인 경우 전적 처리
					userBattleService.recordDraw(room, p1.getUser().getId());
					sendSystemMessageToRoom(roomId,
						StompMessageType.RESPONSE_BATTLE_END,
						"경기 종료! 무승부입니다.",
						Map.of(
							"reason", StompMessageType.REQUEST_TURN_SWAP,
							"winnerId", "",
							"finalTurn", room.getTurnCount(),
							"finalRound", room.getRoundCount(),
							"finalScores",
							Map.of(participants.get(0).getUser().getId(), participants.get(0).getWinCount(),
								participants.get(1).getUser().getId(), participants.get(1).getWinCount())
						)
					);
				} else {
					userBattleService.recordBattleResult(room, winnerId);
					sendSystemMessageToRoom(roomId,
						StompMessageType.RESPONSE_BATTLE_END,
						"경기 종료! 승자가 결정되었습니다.",
						Map.of(
							"reason", StompMessageType.REQUEST_TURN_SWAP,
							"winnerId", winnerId.toString(),
							"finalTurn", room.getTurnCount(),
							"finalRound", room.getRoundCount(),
							"finalScores",
							Map.of(participants.get(0).getUser().getId(), participants.get(0).getWinCount(),
								participants.get(1).getUser().getId(), participants.get(1).getWinCount())
						)
					);
				}
			}
			// 무승부 처리하고 다음 라운드 갈 준비
			else {
				room.resetTurnCount();
				room.incrementRoundCount();

				int currentIndex = -1;
				for (int i = 0; i < participants.size(); i++) {
					if (participants.get(i).getUser().equals(currentAttacker)) {
						currentIndex = i;
						break;
					}
				}
				int nextIndex = (currentIndex + 1) % participants.size();
				User nextAttacker = participants.get(nextIndex).getUser();

				room.updateAttacker(nextAttacker);
				room.updateTurnStartedAt(LocalDateTime.now());
				roomRepository.save(room);
				sendSystemMessageToRoom(roomId,
					StompMessageType.RESPONSE_ROUND_END,
					"공수교대를 한 번씩 해 무승부입니다. 새로운 공격자는 " + nextAttacker.getNickname() + "님입니다!",
					Map.of(
						"reason", StompMessageType.REQUEST_TURN_SWAP,
						"attackerId", nextAttacker.getId(),
						"currentTurn", room.getTurnCount(),
						"currentRound", room.getRoundCount(),
						"currentScores",
						Map.of(participants.get(0).getUser().getId(), participants.get(0).getWinCount(),
							participants.get(1).getUser().getId(), participants.get(1).getWinCount())
					)
				);
				return;
			}
		}

	}

	// 웃었다고 보냄
	public void handleLaughed(Long roomId, UUID senderId, StompRequest stompRequest) {
		Room room = roomRepository.findById(roomId).orElseThrow();
		// 게임 중인지 체크
		if (!room.getStatus().equals(RoomStatus.PLAYING)) {
			sendSystemMessageToUser(senderId, roomId, StompMessageType.RESPONSE_ERROR, "게임 중에만 웃었다는 신호를 보낼 수 있습니다.",
				null);
			return;
		}

		// 공격자가 웃었다고 보냈는지 체크
		User currentAttacker = room.getCurrentAttacker();
		UUID attackerId = currentAttacker.getId();
		if (senderId.equals(attackerId)) {
			sendSystemMessageToUser(senderId, roomId, StompMessageType.RESPONSE_ERROR, "공격자는 웃어도 됩니다.", null);
			return;
		}

		// 공격자 승수 추가
		List<RoomParticipant> participants = room.getRoomParticipants();
		participants.stream()
			.filter(p -> p.getUser().getId().equals(attackerId))
			.findFirst()
			.ifPresent(p -> p.setWinCount(p.getWinCount() + 1));

		// 2승했으면 게임 종료
		boolean hasWinner = participants.stream()
			.anyMatch(p -> p.getWinCount() >= 2);
		if (hasWinner) {
			room.updateStatus(RoomStatus.TERMINATED);
			roomRepository.save(room);

			// 전적 기록/집계 업데이트 (winner: attackerId)
			userBattleService.recordBattleResult(room, attackerId);

			sendSystemMessageToRoom(roomId,
				StompMessageType.RESPONSE_BATTLE_END,
				"경기 종료! " + currentAttacker.getNickname() + "님이 최종 승리하였습니다.",
				Map.of(
					"reason", StompMessageType.REQUEST_LAUGHED,
					"finalTurn", room.getTurnCount(),
					"finalRound", room.getRoundCount(),
					"winnerId", attackerId,
					"finalScores", Map.of(participants.get(0).getUser().getId(), participants.get(0).getWinCount(),
						participants.get(1).getUser().getId(), participants.get(1).getWinCount())
				)
			);

			// 2승한 사람이 없음
		} else {
			// 그렇다면 턴 스왑하는 경우 / 라운드 넘어가는 경우.
			// 턴 스왑하는 경우
			if (room.getTurnCount() == 1) {
				room.incrementTurnCount();

				// 공수교대
				int currentIndex = -1;
				for (int i = 0; i < participants.size(); i++) {
					if (participants.get(i).getUser().equals(currentAttacker)) {
						currentIndex = i;
						break;
					}
				}
				int nextIndex = (currentIndex + 1) % participants.size();
				User nextAttacker = participants.get(nextIndex).getUser();

				room.updateAttacker(nextAttacker);
				room.updateTurnStartedAt(LocalDateTime.now());
				roomRepository.save(room);

				sendSystemMessageToRoom(roomId,
					StompMessageType.RESPONSE_TURN_SWAP,
					"수비자가 웃어 턴이 스왑됩니다. 공격자는 " + nextAttacker.getNickname() + "님입니다!",
					Map.of(
						"reason", StompMessageType.REQUEST_LAUGHED,
						"attackerId", nextAttacker.getId(),
						"currentTurn", room.getTurnCount(),
						"currentRound", room.getRoundCount(),
						"currentScores",
						Map.of(participants.get(0).getUser().getId(), participants.get(0).getWinCount(),
							participants.get(1).getUser().getId(), participants.get(1).getWinCount())
					)
				);
				// 공수교대 끝, 라운드 넘어가는 경우
			} else {
				// 라운드 넘어가는 경우에서, 지금 3라운드라면 종료
				if (room.getRoundCount() == 3) {
					room.updateStatus(RoomStatus.TERMINATED);
					roomRepository.save(room);
					RoomParticipant p1 = participants.get(0);
					RoomParticipant p2 = participants.get(1);

					UUID winnerId = getWinnerId(p1, p2);
					// 3라운드에서 승자가 있는 경우
					if (winnerId != null) {
						userBattleService.recordBattleResult(room, winnerId);
						sendSystemMessageToRoom(roomId,
							StompMessageType.RESPONSE_BATTLE_END,
							"경기 종료! 승자가 결정되었습니다.",
							Map.of(
								"reason", StompMessageType.REQUEST_LAUGHED,
								"finalTurn", room.getTurnCount(),
								"finalRound", room.getRoundCount(),
								"winnerId", winnerId.toString(),
								"finalScores",
								Map.of(participants.get(0).getUser().getId(), participants.get(0).getWinCount(),
									participants.get(1).getUser().getId(), participants.get(1).getWinCount())
							)
						);
						// 3라운드가 끝났는데 무승부인 경우
					} else {
						userBattleService.recordDraw(room, p1.getUser().getId());
						sendSystemMessageToRoom(roomId,
							StompMessageType.RESPONSE_BATTLE_END,
							"경기 종료! 무승부입니다.",
							Map.of(
								"reason", StompMessageType.REQUEST_LAUGHED,
								"finalTurn", room.getTurnCount(),
								"finalRound", room.getRoundCount(),
								"winnerId", "",
								"finalScores",
								Map.of(participants.get(0).getUser().getId(), participants.get(0).getWinCount(),
									participants.get(1).getUser().getId(), participants.get(1).getWinCount())
							)
						);
					}
					// 라운드 넘어가는 경우에서, 지금 2라운드 이하라면 +1라운드.
				} else if (room.getRoundCount() < 3) {
					room.incrementRoundCount();
					room.resetTurnCount();
					int currentIndex = -1;
					for (int i = 0; i < participants.size(); i++) {
						if (participants.get(i).getUser().equals(currentAttacker)) {
							currentIndex = i;
							break;
						}
					}
					int nextIndex = (currentIndex + 1) % participants.size();
					User nextAttacker = participants.get(nextIndex).getUser();

					room.updateAttacker(nextAttacker);
					room.updateTurnStartedAt(LocalDateTime.now());
					roomRepository.save(room);

					sendSystemMessageToRoom(roomId,
						StompMessageType.RESPONSE_ROUND_END,
						"수비자가 웃었습니다. 라운드가 새로 시작됩니다. 새로운 공격자는 " + nextAttacker.getNickname() + "님입니다!",
						Map.of(
							"reason", StompMessageType.REQUEST_LAUGHED,
							"attackerId", nextAttacker.getId(),
							"currentTurn", room.getTurnCount(),
							"currentRound", room.getRoundCount(),
							"currentScores",
							Map.of(participants.get(0).getUser().getId(), participants.get(0).getWinCount(),
								participants.get(1).getUser().getId(), participants.get(1).getWinCount())
						)
					);
				}
			}
		}
	}

	// 기권
	public void handleSurrender(Long roomId, UUID senderId, StompRequest stompRequest) {
		Room room = roomRepository.findById(roomId).orElseThrow();
		if (!room.getStatus().equals(RoomStatus.PLAYING)) {
			sendSystemMessageToUser(senderId, roomId, StompMessageType.RESPONSE_ERROR, "게임 중에만 항복할 수 있습니다.", null);
			return;
		}
		room.updateStatus(RoomStatus.TERMINATED);
		roomRepository.save(room);

		List<RoomParticipant> participants = room.getRoomParticipants();
		User sender = userRepository.findById(senderId).orElseThrow(() -> new NotFoundUserException("참가자 정보 없음"));
		User winner = participants.stream()
			.map(RoomParticipant::getUser)
			.filter(user -> !user.getId().equals(senderId))
			.findFirst()
			.orElseThrow(() -> new IllegalStateException("승리자를 결정할 수 없습니다."));

		// 전적 기록/집계 업데이트
		userBattleService.recordBattleResult(room, winner.getId());

		sendSystemMessageToRoom(roomId,
			StompMessageType.RESPONSE_BATTLE_END,
			"경기 종료! " + sender.getNickname() + "님이 기권하셨습니다.",
			Map.of(
				"reason", StompMessageType.REQUEST_SURRENDER,
				"finalTurn", room.getTurnCount(),
				"finalRound", room.getRoundCount(),
				"winnerId", winner.getId(),
				"finalScores", Map.of(participants.get(0).getUser().getId(), participants.get(0).getWinCount(),
					participants.get(1).getUser().getId(), participants.get(1).getWinCount())
			)
		);
	}

	// 신고 처리
	public void handleReport(Long roomId, UUID senderId, StompRequest stompRequest) {
		Room room = roomRepository.findById(roomId).orElseThrow();
		List<RoomParticipant> participants = room.getRoomParticipants();

		int currentIndex = 0;
		for (int i = 0; i < participants.size(); i++) {
			if (participants.get(i).getUser().getId().equals(senderId)) {
				currentIndex = i;
				break;
			}
		}
		int nextIndex = (currentIndex + 1) % participants.size();
		User targetUser = participants.get(nextIndex).getUser();

		sendSystemMessageToRoom(roomId,
			StompMessageType.RESPONSE_REPORTED,
			targetUser.getNickname() + "님이 신고당하셨습니다.",
			Map.of(
				"reportedUserId", targetUser.getId()
			)
		);
	}

	public void sendSystemMessageToRoom(Long roomId, StompMessageType messageType, String message,
		Map<String, Object> data) {
		StompResponse response = StompResponse.builder()
			.type(messageType)
			.senderId(null)
			.senderNickname("시스템")
			.message(message)
			.data(data)
			.build();
		messageTemplate.convertAndSend("/topic/" + roomId, response);
	}

	public void sendSystemMessageToUser(UUID userId, Long roomId, StompMessageType messageType, String message,
		Map<String, Object> data) {
		log.info("send message to user: {}, message: {}", userId, message);
		StompResponse response = StompResponse.builder()
			.type(messageType)
			.senderId(null)
			.senderNickname("시스템")
			.message(message)
			.data(data)
			.build();
		messageTemplate.convertAndSendToUser(userId.toString(), "/queue/errors/" + roomId, response);
	}

	public UUID getWinnerId(RoomParticipant p1, RoomParticipant p2) {
		if (p1.getWinCount() > p2.getWinCount()) {
			return p1.getUser().getId();
		} else if (p2.getWinCount() > p1.getWinCount()) {
			return p2.getUser().getId();
		} else
			return null;
	}
}
