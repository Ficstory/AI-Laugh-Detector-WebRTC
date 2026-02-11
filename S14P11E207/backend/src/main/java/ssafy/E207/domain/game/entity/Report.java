package ssafy.E207.domain.game.entity;

import jakarta.persistence.*;
import lombok.*;
import ssafy.E207.global.common.entity.BaseEntity;
import ssafy.E207.global.common.enums.ReportReason;

import java.util.UUID;

/**
 * 신고 엔티티.
 * 사용자 간 신고 내역을 저장
 */
@Entity
@Table(
    name = "reports",
    indexes = {
        @Index(name = "idx_reports_reporter", columnList = "reporter_id"),
        @Index(name = "idx_reports_target", columnList = "target_id"),
        @Index(name = "idx_reports_created", columnList = "created_at")
    }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class Report extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 신고한 사용자 ID */
    @Column(name = "reporter_id", nullable = false)
    private UUID reporterId;

    /** 신고 대상 사용자 ID */
    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    /** 신고 대상 닉네임 (조회 편의를 위해 저장) */
    @Column(name = "target_nickname", nullable = false, length = 50)
    private String targetNickname;

    /** 신고 사유 */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ReportReason reason;

    /** 상세 내용 (최대 500자, reason이 OTHER인 경우 필수) */
    @Column(length = 500)
    private String detail;
}
