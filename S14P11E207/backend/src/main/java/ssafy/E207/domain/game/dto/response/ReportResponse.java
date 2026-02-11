package ssafy.E207.domain.game.dto.response;

import lombok.Builder;
import ssafy.E207.domain.game.entity.Report;
import ssafy.E207.global.common.enums.ReportReason;

import java.time.LocalDateTime;

/**
 * 신고 응답 DTO.
 */
@Builder
public record ReportResponse(
    Long reportId, // 생성된 신고 ID
    String targetNickname, // 신고 대상 닉네임
    ReportReason reason, // 신고 사유
    LocalDateTime createdAt // 신고 접수시간
) {
    /**
     * Report 엔티티를 ReportResponse로 변환.
     */
    public static ReportResponse from(Report report) {
        return ReportResponse.builder()
            .reportId(report.getId())
            .targetNickname(report.getTargetNickname())
            .reason(report.getReason())
            .createdAt(report.getCreatedAt())
            .build();
    }
}
