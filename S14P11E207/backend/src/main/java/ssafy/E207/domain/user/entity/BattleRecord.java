package ssafy.E207.domain.user.entity;

import jakarta.persistence.*;
import lombok.*;
import ssafy.E207.domain.auth.entity.User;
import ssafy.E207.global.common.entity.BaseEntity;
import ssafy.E207.global.common.enums.BattleResult;

/**
 * 사용자 전적 기록(1게임 단위, 사용자 기준)
 * - 한 판(룸)당 사용자 2명 각각 1행 생성
 */
@Getter
@Entity
@Table(
        name = "battle_records",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_battle_records_room_user", columnNames = {"room_id", "user_id"})
        },
        indexes = {
                @Index(name = "idx_battle_records_user_created", columnList = "user_id, created_at"),
                @Index(name = "idx_battle_records_room", columnList = "room_id")
        }
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class BattleRecord extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** match.room.id */
    @Column(name = "room_id", nullable = false)
    private Long roomId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 1)
    private BattleResult result;

    /** 상대 유저 UUID(조회 편의) */
    @Column(name = "opponent_user_id", nullable = false, length = 36)
    private String opponentUserId;
}
