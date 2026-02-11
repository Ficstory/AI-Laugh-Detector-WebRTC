package ssafy.E207.domain.match.dto.response;

import java.util.Map;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import ssafy.E207.global.common.enums.StompMessageType;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StompResponse {
	private StompMessageType type;
	private UUID senderId;
	private String senderNickname;
	private String message;
	Map<String, Object> data;
}