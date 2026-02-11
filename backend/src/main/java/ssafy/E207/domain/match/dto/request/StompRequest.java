package ssafy.E207.domain.match.dto.request;

import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import ssafy.E207.global.common.enums.StompMessageType;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StompRequest {
	private StompMessageType type;
	private String message;
	private Map<String, Object> data;
}
