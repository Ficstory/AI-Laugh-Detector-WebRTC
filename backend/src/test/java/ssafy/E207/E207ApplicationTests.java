package ssafy.E207;

import static org.junit.Assert.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;

import io.openvidu.java.client.OpenViduHttpException;
import io.openvidu.java.client.OpenViduJavaClientException;
import jakarta.transaction.Transactional;
import ssafy.E207.domain.auth.entity.User;
import ssafy.E207.domain.match.dto.request.RoomCreateRequest;
import ssafy.E207.domain.match.dto.request.RoomJoinRequest;
import ssafy.E207.domain.match.dto.response.RoomCreateResponse;
import ssafy.E207.domain.match.entity.Room;
import ssafy.E207.domain.match.entity.RoomParticipant;
import ssafy.E207.domain.match.repository.RoomParticipantRepository;
import ssafy.E207.domain.match.repository.RoomRepository;
import ssafy.E207.domain.match.service.RoomService;
import ssafy.E207.domain.user.repository.UserRepository;
import ssafy.E207.domain.user.service.UserService;
import ssafy.E207.global.common.enums.OAuthProvider;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@ActiveProfiles("test")
class E207ApplicationTests {
	@LocalServerPort
	private int port;
	@Autowired
	private UserRepository userRepository;
	@Autowired
	private RoomRepository roomRepository;
	@Autowired
	private RoomParticipantRepository roomParticipantRepository;

	@Autowired
	private RoomService roomService;

	private List<User> users;

	@BeforeEach
	public void createUsers() {
		users = new ArrayList<>();
		for (int i = 1; i <= 10; i++) {
			User savedUser = User.builder()
				.oauthId("h" + i)
				.oauthProvider(OAuthProvider.KAKAO)
				.nickname("hong gildong" + i)
				.isMarketing(true)
				.build();
			userRepository.save(savedUser);
			users.add(savedUser);
		}
	}

	class joinRoomWorker implements Runnable {
		private CountDownLatch latch;
		private UUID userId;
		private Long roomId;

		public joinRoomWorker(CountDownLatch latch, UUID userId, Long roomId) {
			this.latch = latch;
			this.userId = userId;
			this.roomId = roomId;
		}

		@Override
		public void run() {
			try {
				RoomJoinRequest roomJoinRequest = RoomJoinRequest.builder()
					.id(roomId)
					.build();
				roomService.joinRoom(userId, roomJoinRequest, new MockHttpServletRequest());
				//System.out.println("thread ");
			} catch (Exception e) {
				//e.printStackTrace();
			} finally {
				if (this.latch == null) {
					return;
				}
				latch.countDown();
			}
		}
	}

	@Test
	void contextLoads() {
	}

	@Test
	public void 동시에_9명이_입장시도() throws InterruptedException, OpenViduJavaClientException, OpenViduHttpException {
		// 임시 방장
		User host = users.get(0);
		RoomCreateRequest roomCreateRequest = RoomCreateRequest.builder()
			.name("test room")
			.build();
		RoomCreateResponse response = roomService.createRoom(host.getId(), roomCreateRequest,
			new MockHttpServletRequest());
		Room createdRoom = roomRepository.findById(response.getId()).orElseThrow();
		System.out.println("max participant: " + createdRoom.getMaxParticipants());

		// 방 들어가기
		CountDownLatch latch = new CountDownLatch(9);
		System.out.println("latch start");
		for (int i = 1; i < 10; i++) {
			User participant = users.get(i);
			new Thread(new joinRoomWorker(latch, participant.getId(), response.getId())).start();
		}
		latch.await();

		assertEquals(2L, roomParticipantRepository.countByRoomId(response.getId()).longValue());

		System.out.println("latch end");
	}

	@Test
	public void 인원수별_입장소요시간_조사() throws InterruptedException, OpenViduJavaClientException, OpenViduHttpException {
		int MAX_PARTICIPANTS = 3000;
		Map<Integer, Long> performanceMap = new LinkedHashMap<>();

		System.out.println("인원수별 입장 시간(1~"+MAX_PARTICIPANTS+"명)");
		System.out.println("Count\tTotal Time(ms)\tAvg per Person(ms)");

		for (int count = 1; count <= MAX_PARTICIPANTS; count+=100) {
			User host = users.get(0);
			RoomCreateRequest createReq = RoomCreateRequest.builder()
				.name("Scale Test Room " + count)
				.build();
			RoomCreateResponse roomResp = roomService.createRoom(host.getId(), createReq, new MockHttpServletRequest());
			Long roomId = roomResp.getId();

			CountDownLatch latch = new CountDownLatch(count);
			long startTime = System.currentTimeMillis();

			for (int i = 1; i <= count; i++) {
				User participant = users.get(i % users.size());
				new Thread(new joinRoomWorker(latch, participant.getId(), roomId)).start();
			}

			latch.await();
			long endTime = System.currentTimeMillis();
			long totalTime = endTime - startTime;

			performanceMap.put(count, totalTime);
			//System.out.printf("%d\t%d\t\t%.2f\n", count, totalTime, (double) totalTime / count);
		}

		performanceMap.forEach((count, totalTime) -> {
			double avgTime = (double) totalTime / count;
			System.out.printf("%d\t\t%d\t\t%.2f\n", count, totalTime, avgTime);
		});
	}
}
