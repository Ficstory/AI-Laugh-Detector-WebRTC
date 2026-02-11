package ssafy.E207.domain.match.dto.response;

import java.util.UUID;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ParticipantDetailDto {
	private UUID userId;
	private String nickname;
	private boolean isHost;
	private boolean isReady;
	private boolean isElectron;
	private String profileImageUrl;
	private PlayerStats stats; // 내부 클래스를 필드로 사용

	@Getter
	@Builder
	public static class PlayerStats {
		private int totalGames;
		private int totalWins;
		private int totalLosses;
		private int totalDraws;
		private int currentWinStreak;
		private int maxWinStreak;
	}
}
