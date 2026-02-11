package ssafy.E207.domain.match.entity;



import java.time.LocalDateTime;
import java.util.UUID;

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
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ssafy.E207.domain.auth.entity.User;
import ssafy.E207.global.common.entity.BaseEntity;
import ssafy.E207.global.common.enums.ParticipantRole;

@Entity
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Getter
@Setter
public class RoomParticipant extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

	@Enumerated(EnumType.STRING)
	private ParticipantRole role;
	public void updateRole(ParticipantRole participantRole) {
		this.role = participantRole;
	}

	@Column(nullable = false)
	@Builder.Default
	private boolean isReady = false;
	public void updateIsReady(boolean isReady) {
		this.isReady = isReady;
	}


	@Builder.Default
	private int winCount = 0;

	@Builder.Default
	private boolean isConnected = true;

	private LocalDateTime lastDisconnectedAt;

	@Builder.Default
	private boolean isElectron = false;

}
