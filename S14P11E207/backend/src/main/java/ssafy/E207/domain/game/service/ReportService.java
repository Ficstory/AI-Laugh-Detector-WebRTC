package ssafy.E207.domain.game.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ssafy.E207.domain.auth.entity.User;
import ssafy.E207.domain.game.dto.request.ReportRequest;
import ssafy.E207.domain.game.dto.response.ReportResponse;
import ssafy.E207.domain.game.entity.Report;
import ssafy.E207.domain.game.exception.InvalidReportReasonException;
import ssafy.E207.domain.game.exception.ReportTargetNotFoundException;
import ssafy.E207.domain.game.repository.ReportRepository;
import ssafy.E207.domain.user.repository.UserRepository;
import ssafy.E207.global.common.enums.ReportReason;

import java.util.UUID;

/**
 * 신고 관련 비즈니스 로직을 처리하는 서비스.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;
    private final GoogleSheetsService googleSheetsService;

    /**
     * 신고를 접수한다.
     *
     * @param reporterId 신고자 ID
     * @param request    신고 요청 정보
     * @return 생성된 신고 응답
     */
    @Transactional
    public ReportResponse createReport(UUID reporterId, ReportRequest request) {
        // 기타 사유인 경우 상세 내용 필수
        validateOtherReasonDetail(request);

        // 신고 대상 사용자 존재 여부 확인
        User targetUser = userRepository.findByNickname(request.targetNickname())
            .orElseThrow(ReportTargetNotFoundException::notFound);

        // 자기 자신 신고 방지
        if (targetUser.getId().equals(reporterId)) {
            throw new InvalidReportReasonException("자기 자신은 신고할 수 없습니다.");
        }

        // 신고 엔티티 생성 및 저장
        Report report = Report.builder()
            .reporterId(reporterId)
            .targetId(targetUser.getId())
            .targetNickname(request.targetNickname())
            .reason(request.reason())
            .detail(request.detail())
            .build();

        Report savedReport = reportRepository.save(report);

        // Google Sheets 기록 — 실패해도 신고 접수는 정상 처리
        try {
            String reporterNickname = userRepository.findById(reporterId)
                .map(User::getNickname)
                .orElse(reporterId.toString());
            googleSheetsService.appendReport(savedReport, reporterNickname);
        } catch (Exception e) {
            log.error("[Report] Google Sheets 기록 실패 — 신고 접수는 정상 처리됨: reportId={}", savedReport.getId(), e);
        }

        return ReportResponse.from(savedReport);
    }

    /**
     * 기타 사유 선택 시 상세 내용 필수 검증.
     */
    private void validateOtherReasonDetail(ReportRequest request) {
        if (request.reason() == ReportReason.OTHER) {
            if (request.detail() == null || request.detail().isBlank()) {
                throw InvalidReportReasonException.detailRequired();
            }
        }
    }
}
