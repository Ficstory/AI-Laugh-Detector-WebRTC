package ssafy.E207.domain.match.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomCreateRequest {
	String name;
	String password;
	@JsonProperty("isElectronNeeded")
	boolean isElectronNeeded;
}

