package ssafy.E207.domain.match.controller;

import java.util.Map;

import org.json.simple.JSONObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import io.openvidu.java.client.OpenViduHttpException;
import io.openvidu.java.client.OpenViduJavaClientException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import ssafy.E207.domain.auth.entity.User;
import ssafy.E207.domain.match.dto.request.RoomCreateRequest;
import ssafy.E207.domain.match.dto.request.RoomJoinByCodeRequest;
import ssafy.E207.domain.match.dto.response.RoomCreateResponse;
import ssafy.E207.domain.match.dto.request.RoomJoinRequest;
import ssafy.E207.domain.match.dto.response.RoomJoinResponse;
import ssafy.E207.domain.match.dto.response.RoomListResponse;
import ssafy.E207.domain.match.service.RoomService;
import ssafy.E207.global.common.template.ResTemplate;
import ssafy.E207.global.jwt.UserPrincipal;

@RestController
@RequiredArgsConstructor
public class RoomController {
	private final RoomService roomService;

	// openVidu 웹훅
	// 세션(방) 종료, 참가자 퇴장 처리
	@PostMapping("/api/webhook")
	public ResponseEntity<String> handleWebhook(@RequestBody JSONObject json) {
		System.out.println("Webhook Received: " + json.toJSONString());
		roomService.handleWebhook(json);
		return new ResponseEntity<>(HttpStatus.OK);
	}

	// 방 리스트
	@GetMapping("/room/list")
	public ResTemplate<Page<RoomListResponse>> getRoomList(
		@PageableDefault(size = 9, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
		Page<RoomListResponse> roomList = roomService.getRoomList(pageable);
		return ResTemplate.success(HttpStatus.OK, "방 목록 조회 성공", roomList);
	}

	// 방 개설
	@PostMapping("/room/create")
	public ResTemplate<RoomCreateResponse> createRoom(@AuthenticationPrincipal UserPrincipal principal,
		@RequestBody RoomCreateRequest roomCreateRequest, HttpServletRequest request) throws
		OpenViduJavaClientException,
		OpenViduHttpException {
		RoomCreateResponse response = roomService.createRoom(principal.getUserId(), roomCreateRequest, request);
		return ResTemplate.success(HttpStatus.OK, "방 개설 성공", response);
	}

	@PostMapping("/room/join")
	public ResTemplate<?> joinRoom(@AuthenticationPrincipal UserPrincipal principal,
		@RequestBody RoomJoinRequest roomJoinRequest, HttpServletRequest request) throws
		OpenViduJavaClientException,
		OpenViduHttpException {
		try {
			RoomJoinResponse response = roomService.joinRoom(principal.getUserId(), roomJoinRequest, request);
			return ResTemplate.success(HttpStatus.OK, "방 참여 성공", response);
		} catch (Exception e) {
			return ResTemplate.error(HttpStatus.BAD_REQUEST, e.getMessage());
		}
	}

	@PostMapping("/room/join-by-code")
	public ResTemplate<?> joinRoom(@AuthenticationPrincipal UserPrincipal principal,
		@RequestBody RoomJoinByCodeRequest roomJoinByCodeRequest, HttpServletRequest request) {
		try {
			RoomJoinResponse response = roomService.joinRoomByCode(principal.getUserId(), roomJoinByCodeRequest, request);
			return ResTemplate.success(HttpStatus.OK, "초대코드로 방 참여 성공", response);
		} catch (Exception e) {
			return ResTemplate.error(HttpStatus.BAD_REQUEST, e.getMessage());
		}
	}

	@GetMapping("/room/{roomId}/code")
	public ResTemplate<?> getRoomCode(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long roomId) {
		String roomCode = roomService.verifyAndRetrieveRoomCode(principal.getUserId(), roomId);
		return ResTemplate.success(HttpStatus.OK, "방 코드 조회 성공", Map.of("roomCode", roomCode));
	}

	// 명시적으로 참가자 퇴장 처리
	@PostMapping("/room/{roomId}/exit")
	public ResTemplate<?> handleExit(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long roomId) {
		System.out.println("detected participant exit:"+principal);
		roomService.handleUserExit(roomId, principal.getUserId());
		return ResTemplate.success(HttpStatus.OK, "방 퇴장 성공", null);
	}
}
