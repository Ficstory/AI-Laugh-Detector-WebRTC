package ssafy.E207.domain.match.dto.response;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchmakingResultDto {
	private Long id;
	private String name;
	private String token1;
	private String token2;
	private List<ParticipantDetailDto> participants;
}
