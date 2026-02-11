package ssafy.E207.domain.match.dto.response;

import java.util.List;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomJoinResponse {
	Long id;
	String name;
	String token;
	private List<ParticipantDetailDto> participants;


}
