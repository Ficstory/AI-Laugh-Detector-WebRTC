package ssafy.E207.domain.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import ssafy.E207.global.common.entity.BaseEntity;
import ssafy.E207.global.common.enums.OAuthProvider;

import java.util.UUID;

@Getter
@Entity
@Table(name = "users")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class User extends BaseEntity {

	/**
	 * [Identity] UUID
	 * <p>
	 * - <b>GenerationType.UUID</b>: 기본적으로 무작위(v4) 방식을 사용하면 DB Insert 성능 저하(Index
	 * Fragmentation) 문제가 발생함 그래서 단순 GenerationType은 사용 안함
	 * - <b>UuidGenerator (Time-based)</b>: 이를 해결하기 위해 타임스탬프가 포함된 <b>UUID v7</b> 방식을
	 * 적용.
	 * - 효과: 생성 시간순 정렬이 보장되어 Clustered Index 성능이 최적화된다 카드라 통신..
	 * </p>
	 */
	@Id
	@GeneratedValue
	@UuidGenerator(style = UuidGenerator.Style.TIME)
	@Column
	private UUID id;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private OAuthProvider oauthProvider;

	@Column(nullable = false, length = 128)
	private String oauthId;

	@Column(nullable = false, unique = true, length = 50)
	private String nickname;

	@Column(length = 512)
	private String profileImage;

	@Column(nullable = false)
	private boolean isMarketing;

	// ==================== Stats ====================
	@Column(nullable = false)
	@Builder.Default
	private int totalGames = 0;

	@Column(nullable = false)
	@Builder.Default
	private int totalWins = 0;

	@Column(nullable = false)
	@Builder.Default
	private int totalDraws = 0;

	@Column(nullable = false)
	@Builder.Default
	private int totalLosses = 0;

	@Column(nullable = false)
	@Builder.Default
	private int currentWinStreak = 0;

	@Column(nullable = false)
	@Builder.Default
	private int maxWinStreak = 0;

	// ==================== Methods ====================
	public void applyWinResult() {
		this.totalGames++;
		this.totalWins++;
		this.currentWinStreak++;
		if (this.currentWinStreak > this.maxWinStreak) {
			this.maxWinStreak = this.currentWinStreak;
		}
	}

	public void applyLossResult() {
		this.totalGames++;
		this.totalLosses++;
		this.currentWinStreak = 0;
	}

	public void applyDrawResult() {
		this.totalGames++;
		this.totalDraws++;
		this.currentWinStreak = 0;
	}

	public void updateMarketing(boolean isMarketing) {
		this.isMarketing = isMarketing;
	}

	public void updateProfileImage(String profileImageUrl) {
		this.profileImage = profileImageUrl;
	}

	public void updateNickname(String nickname) {
		this.nickname = nickname;
	}

	public void withdraw() {
		this.nickname = "(알수없음)_" + UUID.randomUUID().toString();
		this.oauthId = "WITHDRAWN_" + UUID.randomUUID();
		this.profileImage = null;
		this.isMarketing = false;
		this.currentWinStreak = 0;
	}
}