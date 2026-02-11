package ssafy.E207.domain.match.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Service;

import io.openvidu.java.client.Connection;
import io.openvidu.java.client.ConnectionProperties;
import io.openvidu.java.client.ConnectionType;
import io.openvidu.java.client.OpenVidu;
import io.openvidu.java.client.OpenViduHttpException;
import io.openvidu.java.client.OpenViduJavaClientException;
import io.openvidu.java.client.OpenViduRole;
import io.openvidu.java.client.Session;
import io.openvidu.java.client.SessionProperties;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import ssafy.E207.domain.auth.entity.User;
import ssafy.E207.domain.match.dto.PendingUser;
import ssafy.E207.domain.match.dto.request.RoomJoinByCodeRequest;
import ssafy.E207.domain.match.exception.ElectronNeededException;
import ssafy.E207.domain.user.repository.UserRepository;
import ssafy.E207.domain.match.dto.response.MatchmakingResultDto;
import ssafy.E207.domain.match.dto.response.ParticipantDetailDto;
import ssafy.E207.domain.match.dto.response.StompResponse;
import ssafy.E207.domain.match.dto.request.RoomCreateRequest;
import ssafy.E207.domain.match.dto.response.RoomCreateResponse;
import ssafy.E207.domain.match.dto.request.RoomJoinRequest;
import ssafy.E207.domain.match.dto.response.RoomJoinResponse;
import ssafy.E207.domain.match.dto.response.RoomListResponse;
import ssafy.E207.global.common.enums.StompMessageType;
import ssafy.E207.global.common.enums.ParticipantRole;
import ssafy.E207.domain.match.entity.Room;
import ssafy.E207.domain.match.entity.RoomParticipant;
import ssafy.E207.global.common.enums.RoomStatus;
import ssafy.E207.global.common.enums.RoomType;
import ssafy.E207.domain.match.repository.RoomParticipantRepository;
import ssafy.E207.domain.match.repository.RoomRepository;
import ssafy.E207.global.config.MinioConfig;
import ssafy.E207.domain.match.exception.InvalidRoomException;
import ssafy.E207.domain.match.exception.NotFoundRoomException;
import ssafy.E207.global.error.exception.NotFoundUserException;

@Transactional
@RequiredArgsConstructor
@Service
public class RoomService {
	private final UserRepository userRepository;
	private final RoomRepository roomRepository;
	private final ElectronSignatureCheckService electronSignatureCheckService;
	private final RoomParticipantRepository roomParticipantRepository;
	private final SimpMessageSendingOperations messageTemplate;
	private final MinioConfig minioConfig;
	private OpenVidu openVidu;

	// Map<세션고유식별자, 세션>
	private Map<String, Session> mapSessions = new ConcurrentHashMap<>();
	// Map<세션고유식별자, Map<사용자식별토큰, 사용자역할>>
	private Map<String, Map<String, OpenViduRole>> mapSessionNamesTokens = new ConcurrentHashMap<>();
	// 도커로 올린 openVidu 서버
	@Value("${openvidu.url}")
	private String OPENVIDU_URL;
	// 도커로 올린 openVidu 서버 시크릿키
	@Value("${openvidu.secret}")
	private String SECRET;

	@PostConstruct
	public void init() {
		this.openVidu = new OpenVidu(OPENVIDU_URL, SECRET);
	}

	public void handleWebhook(JSONObject json) {
		String event = (String)json.get("event");
		Long sessionId = Long.parseLong((String)json.get("sessionId")); // 방 ID
		System.out.println("webhook event detected.");
		// 참가자가 나간 경우
		if ("participantLeft".equals(event)) {
			try {
				JSONParser parser = new JSONParser();
				JSONObject serverData = (JSONObject)parser.parse((String)json.get("serverData"));

				UUID userId = UUID.fromString(serverData.get("userId").toString());
				String nickname = (String)serverData.get("nickname");

				System.out.println("from [" + sessionId + "] user [" + userId + "][" + nickname + "] left.");

				handleUserExit(sessionId, userId);
			} catch (Exception e) {
				System.err.println("Webhook participantLeft 처리 중 오류: " + e.getMessage());
			}
		}
		if ("sessionDestroyed".equals(event)) {
			try {
				System.out.println("room [" + sessionId + "] destroyed");

				// 방 삭제
				// roomparticipant cascade 삭제됨
				roomRepository.deleteById(sessionId);

				// 메모리에서 제거
				this.mapSessions.remove(sessionId);
				this.mapSessionNamesTokens.remove(sessionId);

			} catch (Exception e) {
				System.err.println("Webhook sessionDestroyed 처리 중 오류: " + e.getMessage());
			}
		}
	}

	public void handleUserExit(Long roomId, UUID userId) {
		try {
			Optional<RoomParticipant> participantOptional = roomParticipantRepository.findByRoomIdAndUserId(
				roomId, userId);
			if (participantOptional.isEmpty()) {
				return;
			}
			// 나간 사람 삭제
			RoomParticipant leavingParticipant = participantOptional.get();
			System.out.println("participant left:" + leavingParticipant);
			roomParticipantRepository.delete(leavingParticipant);
			roomParticipantRepository.flush();

			// 남은 참가자 수 0명이면 방 폭파
			long remainingParticipants = roomParticipantRepository.countByRoomId(roomId);
			Room room = roomRepository.findById(roomId).orElseThrow();
			if (remainingParticipants == 0) {
				System.out.println("방에 남은 인원이 없어 방을 폭파합니다: " + roomId);
				roomRepository.delete(room);
			}
			// 다른 참가자 남아 있을 때
			// 비밀방
			else if (RoomType.CASUAL.equals(room.getRoomType())) {
				// 비밀방 플레이중
				if (RoomStatus.PLAYING.equals(room.getStatus())) {
					System.out.println("playing room");
					StompResponse leaveMessage = new StompResponse();
					leaveMessage.setType(StompMessageType	.RESPONSE_ROOM_DESTROYED);
					leaveMessage.setMessage("참여자가 나가 게임이 종료되었습니다.");
					room.updateStatus(RoomStatus.TERMINATED);
					messageTemplate.convertAndSend("/topic/" + roomId, leaveMessage);
					// 비밀방 대기중
				} else {
					// 나간 사람이 방장이면 새 방장 선정
					if (leavingParticipant.getRole().equals(ParticipantRole.HOST)) {
						Optional<RoomParticipant> nextHost = roomParticipantRepository.findFirstByRoomIdOrderByCreatedAtAsc(
							roomId);
						if (nextHost.isPresent()) {
							// 새 방장 선정
							UUID nextHostId = nextHost.get().getUser().getId();
							room.updateHostId(nextHostId);
							roomRepository.save(room);
							nextHost.get().updateIsReady(true);
							nextHost.get().updateRole(ParticipantRole.HOST);

							// 웹소켓으로 방장 변경 알림
							StompResponse hostChangeMessage = new StompResponse();
							hostChangeMessage.setType(StompMessageType.RESPONSE_HOST_CHANGED);
							hostChangeMessage.setMessage(
								"기존 방장이 나가 방장이 " + nextHost.get().getUser().getNickname() + " 님으로 변경되었습니다.");
							hostChangeMessage.setData(
								Map.of("prevHostId", leavingParticipant.getUser().getId(), "nextHostId", nextHostId));
							messageTemplate.convertAndSend("/topic/" + roomId, hostChangeMessage);
						}
						// 나간 사람이 방장이 아닐 때
					} else {
						StompResponse participantLeftMessage = new StompResponse();
						participantLeftMessage.setType(StompMessageType.RESPONSE_PARTICIPANT_LEFT);
						participantLeftMessage.setMessage(leavingParticipant.getUser().getNickname() + "님이 나가셨습니다.");
						participantLeftMessage.setData(Map.of("leftUserId", leavingParticipant.getUser().getId()));
						messageTemplate.convertAndSend("/topic/" + roomId, participantLeftMessage);
					}
				}
				// 매칭전
			} else if (RoomType.RANKED.equals(room.getRoomType())) {

				if (!RoomStatus.TERMINATED.equals(room.getStatus())) {
					StompResponse leaveMessage = new StompResponse();
					leaveMessage.setType(StompMessageType.RESPONSE_ROOM_DESTROYED);
					leaveMessage.setMessage("참여자가 나가 게임이 종료되었습니다.");
					room.updateStatus(RoomStatus.TERMINATED);
					messageTemplate.convertAndSend("/topic/" + roomId, leaveMessage);
				}
			}

		} catch (Exception e) {
			System.err.println("Webhook participantLeft 처리 중 오류: " + e.getMessage());
		}
	}

	public Page<RoomListResponse> getRoomList(Pageable pageable) {
		Page<Room> roomPage = roomRepository.findByRoomType(RoomType.CASUAL, pageable);

		Page<RoomListResponse> roomList = roomPage.map(room -> {
			UUID hostId = room.getHostId();
			String hostNickname = null;
			if (hostId != null) {
				hostNickname = userRepository.findById(room.getHostId()).get().getNickname();
			}
			return RoomListResponse.builder()
				.id(room.getId())
				.name(room.getName())
				.hostNickname(hostNickname)
				.status(room.getStatus())
				.isPrivate(room.getPassword() != null && !room.getPassword().isEmpty())
				.participantCount(room.getRoomParticipants().size())
				.createdTime(room.getCreatedAt().toString())
				.build();
		});

		return roomList;
	}

	public RoomCreateResponse createRoom(UUID userId, RoomCreateRequest roomCreateRequest,
		HttpServletRequest request) throws
		OpenViduJavaClientException,
		OpenViduHttpException {
		User user = userRepository.findById(userId)
			.orElseThrow(() -> new NotFoundUserException("해당 유저를 찾을 수 없습니다."));

		boolean isElectron = false;
		if (roomCreateRequest.isElectronNeeded()) {
			 isElectron = electronSignatureCheckService.checkIsValidElectronApp(request);
		} else{
			isElectron = electronSignatureCheckService.isElectronApp(request);
		}

		// 1. DB에 방 정보 저장
		Room savedRoom = Room.builder()
			.name(roomCreateRequest.getName())
			.roomCode(generateUniqueRoomCode())
			.password(roomCreateRequest.getPassword())
			.hostId(userId)
			.roomType(RoomType.CASUAL)
			.isElectronNeeded(roomCreateRequest.isElectronNeeded())
			.build();
		roomRepository.save(savedRoom);
		Long roomId = savedRoom.getId();

		// 2. OpenVidu 세션 및 커넥션 생성
		// 2-1. 세션 생성(=방 생성)
		Session session = createSession(roomId);
		// 2-2. 참가자 커넥션 생성(=참가자가 PUBLISHER 역햘, userId, nickname 가지고 방에 참가)
		Connection connection = createConnection(session, user, OpenViduRole.PUBLISHER);
		// 2-3. 참가자 토큰 생성(=참가자를 식별할 수 있는 정보 생성)
		String token = connection.getToken();

		// 3. 서버 메모리에 세션, 토큰, 롤 저장
		this.mapSessions.put(String.valueOf(roomId), session);
		this.mapSessionNamesTokens.put(String.valueOf(roomId), new ConcurrentHashMap<>());
		this.mapSessionNamesTokens.get(String.valueOf(roomId)).put(token, OpenViduRole.PUBLISHER);

		// 4. 방 참가자 DB에 저장
		createAndSaveParticipant(savedRoom, user, ParticipantRole.HOST, isElectron);

		// 5. 응답
		RoomCreateResponse response = RoomCreateResponse.builder()
			.id(savedRoom.getId())
			.name(savedRoom.getName())
			.token(token)
			.build();

		return response;
	}

	public MatchmakingResultDto createRoomFromMatchmaking(PendingUser pendingUser1, PendingUser pendingUser2) throws
		OpenViduJavaClientException,
		OpenViduHttpException {
		User user1 = userRepository.findById(pendingUser1.userId())
			.orElseThrow(() -> new NotFoundUserException("해당 유저를 찾을 수 없습니다."));

		User user2 = userRepository.findById(pendingUser2.userId())
			.orElseThrow(() -> new NotFoundUserException("해당 유저를 찾을 수 없습니다."));

		// 1. DB에 방 정보 저장
		Room savedRoom = Room.builder()
			.name(user1.getNickname() + " vs " + user2.getNickname())
			.roomCode(generateUniqueRoomCode())
			.hostId(user1.getId())
			.roomType(RoomType.RANKED)
			.build();
		roomRepository.save(savedRoom);
		Long roomId = savedRoom.getId();

		// 2. OpenVidu 세션 및 커넥션 생성
		// 2-1. 세션 생성(=방 생성)
		Session session = createSession(roomId);

		// 2-2. 참가자 커넥션 생성(=참가자가 아래 정보를 가지고 방에 참가)
		Connection connection1 = createConnection(session, user1, OpenViduRole.PUBLISHER);
		Connection connection2 = createConnection(session, user2, OpenViduRole.PUBLISHER);

		// 2-3. 참가자 토큰 생성(=참가자를 식별할 수 있는 정보 생성)
		String token1 = connection1.getToken();
		String token2 = connection2.getToken();

		// 3. 서버 메모리에 세션, 토큰, 롤 저장 (키: roomId로 일관성 유지)
		String sessionKey = String.valueOf(roomId);
		this.mapSessions.put(sessionKey, session);
		this.mapSessionNamesTokens.put(sessionKey, new ConcurrentHashMap<>());
		this.mapSessionNamesTokens.get(sessionKey).put(token1, OpenViduRole.PUBLISHER);
		this.mapSessionNamesTokens.get(sessionKey).put(token2, OpenViduRole.PUBLISHER);
		// 4. 방 참가자 DB에 저장
		RoomParticipant p1 = createAndSaveParticipant(savedRoom, user1, ParticipantRole.PARTICIPANT,
			pendingUser1.isElectron());
		RoomParticipant p2 = createAndSaveParticipant(savedRoom, user2, ParticipantRole.PARTICIPANT,
			pendingUser2.isElectron());

		// 5. 반환할 참가자 정보 생성
		List<ParticipantDetailDto> participantInfos = new ArrayList<>();
		ParticipantDetailDto participantInfo1 = ParticipantDetailDto.builder()
			.isReady(p1.isReady())
			.isHost(false)
			.isElectron(p1.isElectron())
			.nickname(p1.getUser().getNickname())
			.userId(p1.getUser().getId())
			.profileImageUrl(generateProfileImageUrl(p1.getUser().getProfileImage()))
			.stats(ParticipantDetailDto.PlayerStats.builder()
				.totalGames(p1.getUser().getTotalGames())
				.totalWins(p1.getUser().getTotalWins())
				.totalLosses(p1.getUser().getTotalLosses())
				.totalDraws(p1.getUser().getTotalDraws())
				.currentWinStreak(p1.getUser().getCurrentWinStreak())
				.maxWinStreak(p1.getUser().getMaxWinStreak())
				.build())

			.build();
		participantInfos.add(participantInfo1);
		ParticipantDetailDto participantInfo2 = ParticipantDetailDto.builder()
			.isReady(p2.isReady())
			.isHost(false)
			.isElectron(p2.isElectron())
			.nickname(p2.getUser().getNickname())
			.userId(p2.getUser().getId())
			.profileImageUrl(generateProfileImageUrl(p2.getUser().getProfileImage()))
			.stats(ParticipantDetailDto.PlayerStats.builder()
				.totalGames(p2.getUser().getTotalGames())
				.totalWins(p2.getUser().getTotalWins())
				.totalLosses(p2.getUser().getTotalLosses())
				.totalDraws(p2.getUser().getTotalDraws())
				.currentWinStreak(p2.getUser().getCurrentWinStreak())
				.maxWinStreak(p2.getUser().getMaxWinStreak())
				.build())
			.build();
		participantInfos.add(participantInfo2);
		// 6. 응답
		return MatchmakingResultDto.builder()
			.id(savedRoom.getId())
			.name(savedRoom.getName())
			.token1(token1)
			.token2(token2)
			.participants(participantInfos)
			.build();
	}

	public RoomJoinResponse joinRoom(UUID userId, RoomJoinRequest roomJoinRequest, HttpServletRequest request) throws
		OpenViduJavaClientException,
		OpenViduHttpException {
		User user = userRepository.findById(userId)
			.orElseThrow(() -> new NotFoundUserException("사용자를 찾을 수 없습니다."));
		Room room = roomRepository.findByIdWithLock(roomJoinRequest.getId())
			.orElseThrow(() -> new NotFoundRoomException("존재하지 않는 방입니다."));
		List<RoomParticipant> participants = roomParticipantRepository.findAllByRoomId(room.getId());

		// 일렉트론 앱이 필요한지 검사
		boolean isElectron = false;
		if (room.isElectronNeeded()) {
			isElectron = electronSignatureCheckService.checkIsValidElectronApp(request);
		}else{
			isElectron = electronSignatureCheckService.isElectronApp(request);
		}

		// 인원수 제한 검사
		if (participants.size() >= room.getMaxParticipants()) {
			throw new IllegalStateException("방이 꽉 찼습니다.");
		}

		// 비번 검사
		if (room.getPassword() != null && !room.getPassword().isEmpty()) {
			if (!room.getPassword().equals(roomJoinRequest.getPassword())) {
				throw new IllegalStateException("비밀번호가 틀렸습니다.");
			}
		}

		// 1. OpenVidu 세션 가져오기
		String sessionId = String.valueOf(room.getId());
		Session session = this.mapSessions.get(sessionId);
		if (session == null) {
			throw new NotFoundRoomException("존재하지 않는 방입니다.");
		}

		// 2. 참가자 커넥션/토큰 생성
		Connection connection = createConnection(session, user, OpenViduRole.PUBLISHER);
		String token = connection.getToken();

		// 3. 서버 메모리에 토큰 저장
		this.mapSessionNamesTokens.get(sessionId).put(token, OpenViduRole.PUBLISHER);


		// 4. 기존 방 참가자 정보 생성, 신규 참가자 중복 체크
		List<ParticipantDetailDto> participantInfos = new ArrayList<>();
		boolean hasJoined = false;
		for (RoomParticipant p : participants) {
			if (p.getUser().getId().equals(userId)) {
				hasJoined = true;
			}
			ParticipantDetailDto participantInfo = ParticipantDetailDto.builder()
				.isReady(p.isReady())
				.isHost(p.getRole().equals(ParticipantRole.HOST) ? true : false)
				.isElectron(p.isElectron())
				.nickname(p.getUser().getNickname())
				.userId(p.getUser().getId())
				.profileImageUrl(generateProfileImageUrl(p.getUser().getProfileImage()))
				.stats(ParticipantDetailDto.PlayerStats.builder()
					.totalGames(p.getUser().getTotalGames())
					.totalWins(p.getUser().getTotalWins())
					.totalLosses(p.getUser().getTotalLosses())
					.totalDraws(p.getUser().getTotalDraws())
					.currentWinStreak(p.getUser().getCurrentWinStreak())
					.maxWinStreak(p.getUser().getMaxWinStreak())
					.build())
				.build();
			participantInfos.add(participantInfo);
		}


		// 5. 신규 참가자 DB에 저장
		if (!hasJoined) {
			RoomParticipant chatParticipant = RoomParticipant.builder()
				.room(room)
				.user(user)
				.isElectron(isElectron)
				.role(ParticipantRole.PARTICIPANT)
				.build();
			roomParticipantRepository.save(chatParticipant);


			// 자신도 들어가게
			ParticipantDetailDto myInfo = ParticipantDetailDto.builder()
				.userId(chatParticipant.getUser().getId())
				.nickname(chatParticipant.getUser().getNickname())
				.profileImageUrl(generateProfileImageUrl(chatParticipant.getUser().getProfileImage()))
				.isHost(false)
				.isReady(chatParticipant.isReady())
				.isElectron(chatParticipant.isElectron())
				.stats(ParticipantDetailDto.PlayerStats.builder()
					.totalGames(user.getTotalGames())
					.totalWins(user.getTotalWins())
					.totalLosses(user.getTotalLosses())
					.totalDraws(user.getTotalDraws())
					.currentWinStreak(user.getCurrentWinStreak())
					.maxWinStreak(user.getMaxWinStreak())
					.build())
				.build();
			participantInfos.add(myInfo);

			StompResponse joinedMessage = new StompResponse();
			joinedMessage.setType(StompMessageType.RESPONSE_PARTICIPANT_JOINED);
			joinedMessage.setMessage("새로운 참가자가 참여했습니다.");
			Map<String, Object> data = new HashMap<>();
			data.put("isReady", myInfo.isReady());
			data.put("isHost", myInfo.isHost());
			data.put("isElectron", myInfo.isElectron());
			data.put("nickname", myInfo.getNickname());
			data.put("userId", myInfo.getUserId());
			data.put("profileImageUrl", myInfo.getProfileImageUrl()); // null이어도 에러 안 남
			data.put("stats", myInfo.getStats());
			joinedMessage.setData(data);
			messageTemplate.convertAndSend("/topic/" + sessionId, joinedMessage);
		}

		// 6. 응답
		RoomJoinResponse response = RoomJoinResponse.builder()
			.id(room.getId())
			.name(room.getName())
			.token(token)
			.participants(participantInfos)
			.build();

		return response;

	}

	public RoomJoinResponse joinRoomByCode(UUID userId, RoomJoinByCodeRequest roomJoinByCodeRequest,
		HttpServletRequest request) throws
		OpenViduJavaClientException,
		OpenViduHttpException {
		User user = userRepository.findById(userId)
			.orElseThrow(() -> new NotFoundUserException("사용자를 찾을 수 없습니다."));
		Room room = roomRepository.findByRoomCodeWithLock(roomJoinByCodeRequest.roomCode())
			.orElseThrow(() -> new NotFoundRoomException("존재하지 않는 방입니다."));
		List<RoomParticipant> participants = roomParticipantRepository.findAllByRoomId(room.getId());

		// 일렉트론 앱이 필요한지 검사
		boolean isElectron = false;
		if (room.isElectronNeeded()) {
			isElectron = electronSignatureCheckService.checkIsValidElectronApp(request);
		}else{
			isElectron = electronSignatureCheckService.isElectronApp(request);
		}


		// 인원수 제한 검사
		if (participants.size() >= room.getMaxParticipants()) {
			throw new IllegalStateException("방이 꽉 찼습니다.");
		}

		// 비번 검사 안함

		// 1. OpenVidu 세션 가져오기
		String sessionId = String.valueOf(room.getId());
		Session session = this.mapSessions.get(sessionId);
		if (session == null) {
			throw new NotFoundRoomException("존재하지 않는 방입니다.");
		}

		// 2. 참가자 커넥션/토큰 생성
		Connection connection = createConnection(session, user, OpenViduRole.PUBLISHER);
		String token = connection.getToken();

		// 3. 서버 메모리에 토큰 저장
		this.mapSessionNamesTokens.get(sessionId).put(token, OpenViduRole.PUBLISHER);

		// 4. 기존 방 참가자 정보 생성, 신규 참가자 중복 체크
		List<ParticipantDetailDto> participantInfos = new ArrayList<>();
		boolean hasJoined = false;
		for (RoomParticipant p : participants) {
			if (p.getUser().getId().equals(userId)) {
				hasJoined = true;
			}
			ParticipantDetailDto participantInfo = ParticipantDetailDto.builder()
				.isReady(p.isReady())
				.isHost(p.getRole().equals(ParticipantRole.HOST) ? true : false)
				.isElectron(p.isElectron())
				.nickname(p.getUser().getNickname())
				.userId(p.getUser().getId())
				.profileImageUrl(generateProfileImageUrl(p.getUser().getProfileImage()))
				.stats(ParticipantDetailDto.PlayerStats.builder()
					.totalGames(p.getUser().getTotalGames())
					.totalWins(p.getUser().getTotalWins())
					.totalLosses(p.getUser().getTotalLosses())
					.totalDraws(p.getUser().getTotalDraws())
					.currentWinStreak(p.getUser().getCurrentWinStreak())
					.maxWinStreak(p.getUser().getMaxWinStreak())
					.build())
				.build();
			participantInfos.add(participantInfo);
		}

		// 5. 신규 참가자 DB에 저장
		if (!hasJoined) {
			RoomParticipant chatParticipant = RoomParticipant.builder()
				.room(room)
				.user(user)
				.isElectron(isElectron)
				.role(ParticipantRole.PARTICIPANT)
				.build();
			roomParticipantRepository.save(chatParticipant);
			// 자신도 들어가게
			ParticipantDetailDto myInfo = ParticipantDetailDto.builder()
				.isReady(chatParticipant.isReady())
				.isHost(false)
				.isElectron(chatParticipant.isElectron())
				.nickname(chatParticipant.getUser().getNickname())
				.userId(chatParticipant.getUser().getId())
				.profileImageUrl(generateProfileImageUrl(chatParticipant.getUser().getProfileImage()))
				.stats(ParticipantDetailDto.PlayerStats.builder()
					.totalGames(user.getTotalGames())
					.totalWins(user.getTotalWins())
					.totalLosses(user.getTotalLosses())
					.totalDraws(user.getTotalDraws())
					.currentWinStreak(user.getCurrentWinStreak())
					.maxWinStreak(user.getMaxWinStreak())
					.build())
				.build();
			participantInfos.add(myInfo);

			StompResponse joinedMessage = new StompResponse();
			joinedMessage.setType(StompMessageType.RESPONSE_PARTICIPANT_JOINED);
			joinedMessage.setMessage("새로운 참가자가 참여했습니다.");
			Map<String, Object> data = new HashMap<>();
			data.put("isReady", myInfo.isReady());
			data.put("isHost", myInfo.isHost());
			data.put("isElectron", myInfo.isElectron());
			data.put("nickname", myInfo.getNickname());
			data.put("userId", myInfo.getUserId());
			data.put("profileImageUrl", myInfo.getProfileImageUrl()); // null이어도 에러 안 남
			data.put("stats", myInfo.getStats());

			joinedMessage.setData(data);
			messageTemplate.convertAndSend("/topic/" + sessionId, joinedMessage);
		}

		// 6. 응답
		RoomJoinResponse response = RoomJoinResponse.builder()
			.id(room.getId())
			.name(room.getName())
			.token(token)
			.participants(participantInfos)
			.build();

		return response;

	}

	public String verifyAndRetrieveRoomCode(UUID userId, Long roomId) {
		Room room = roomRepository.findById(roomId)
			.orElseThrow(() -> new NotFoundRoomException("해당 방을 찾을 수 없습니다."));

		if (RoomType.RANKED.equals(room.getRoomType())) {
			throw new InvalidRoomException("매칭으로 만들어진 방은 초대 링크를 생성할 수 없습니다.");
		}

		RoomParticipant participant = roomParticipantRepository.findByRoomIdAndUserId(roomId, userId)
			.orElseThrow(() -> new NotFoundUserException("해당 방에 해당 유저가 없습니다."));

		return room.getRoomCode();
	}

	private String generateUniqueRoomCode() {
		String code;
		do {
			// 6자리 랜덤 코드 생성
			code = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
		} while (roomRepository.existsByRoomCode(code)); // DB에 이미 있는지 체크

		return code;
	}

	private Session createSession(Long roomId) throws OpenViduJavaClientException, OpenViduHttpException {
		SessionProperties properties = new SessionProperties.Builder().customSessionId(String.valueOf(roomId)).build();
		Session session = this.openVidu.createSession(properties);
		return session;
	}

	private Connection createConnection(Session session, User user, OpenViduRole role) throws
		OpenViduJavaClientException,
		OpenViduHttpException {
		String data = String.format("{\"userId\":\"%s\", \"nickname\":\"%s\"}",
			user.getId(),
			user.getNickname());
		ConnectionProperties connectionProperties = new ConnectionProperties.Builder()
			.type(ConnectionType.WEBRTC)
			.data(data)
			.role(role)
			.build();
		return session.createConnection(connectionProperties);
	}

	public RoomParticipant createAndSaveParticipant(Room room, User user, ParticipantRole role, boolean isElectron) {
		boolean isReady = false;
		if (role.equals(ParticipantRole.HOST)) {
			isReady = true;
		}

		RoomParticipant savedParticipant = RoomParticipant.builder()
			.room(room)
			.user(user)
			.role(role)
			.isReady(isReady)
			.isElectron(isElectron)
			.build();

		roomParticipantRepository.save(savedParticipant);
		return savedParticipant;
	}

	private String generateProfileImageUrl(String objectKey) {
		if (objectKey == null || objectKey.isBlank()) {
			return null;
		}
		// http로 시작하면 그대로 반환
		if (objectKey.startsWith("http")) {
			return objectKey;
		}

		String endpoint = minioConfig.getExternalEndpoint();
		String bucket = minioConfig.getBucket();

		if (!endpoint.endsWith("/")) {
			endpoint += "/";
		}
		return endpoint + bucket + "/" + objectKey;
	}

}
