package ssafy.E207.domain.match.dto.response;


import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import ssafy.E207.global.common.enums.RoomStatus;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomListResponse {
	private Long id;
	private String name;
	private String hostNickname;
	private RoomStatus status;
	private boolean isPrivate;
	private int participantCount;
	private String createdTime; // 정렬용
}
