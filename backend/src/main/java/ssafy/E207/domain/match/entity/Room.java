package ssafy.E207.domain.match.entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import ssafy.E207.domain.auth.entity.User;
import ssafy.E207.global.common.entity.BaseEntity;
import ssafy.E207.global.common.enums.RoomStatus;
import ssafy.E207.global.common.enums.RoomType;

@Entity
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Getter
public class Room extends BaseEntity {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	// 방 제목
	@Column(nullable = false)
	private String name;

	// 방 입장 코드
	@Column(unique = true, nullable = false)
	private String roomCode;

	// 방장 아이디
	@Column
	private UUID hostId;
	public void updateHostId(UUID userId) {
		this.hostId = userId;
	}

	// 방 비번
	@Column(nullable = true)
	private String password;

	@Builder.Default
	private Integer maxParticipants = 2;

	// 참가자
	@OneToMany(mappedBy = "room", cascade = CascadeType.REMOVE, orphanRemoval = true)
	@OrderBy("id ASC")
	@Builder.Default
	private List<RoomParticipant> roomParticipants = new ArrayList<>();

	// 방 상태
	@Enumerated(EnumType.STRING)
	@Builder.Default
	private RoomStatus status = RoomStatus.WAITING;

	public void updateStatus(RoomStatus status) {
		this.status = status;
	}

	@Enumerated(EnumType.STRING)
	private RoomType roomType;

	// 현재 공격하는 유저 ID
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "current_attacker_id")
	private User currentAttacker;
	public void updateAttacker(User user) {
		this.currentAttacker = user;
	}

	@Builder.Default
	private int turnCount = 1; // 초기값 1
	public void incrementTurnCount() {
		this.turnCount++;
	}
	public void resetTurnCount() {
		this.turnCount = 1;
	}

	@Builder.Default
	private int roundCount = 1; // 초기값 1
	public void incrementRoundCount() {
		this.roundCount++;
	}

	private LocalDateTime turnStartedAt;
	public void updateTurnStartedAt(LocalDateTime time) {
		this.turnStartedAt = time;
	}

	private boolean isElectronNeeded;

	public boolean isPrivate() {
		return this.password != null && !this.password.isEmpty();
	}
}
