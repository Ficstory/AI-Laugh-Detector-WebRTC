package ssafy.E207.domain.game.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ssafy.E207.domain.game.dto.request.ReportRequest;
import ssafy.E207.domain.game.dto.response.ReportResponse;
import ssafy.E207.domain.game.service.ReportService;
import ssafy.E207.global.common.template.ResTemplate;
import ssafy.E207.global.jwt.UserPrincipal;

/**
 * 신고 관련 API 컨트롤러.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/reports")
public class ReportController {

    private final ReportService reportService;

    /**
     * 사용자 신고
     *
     * @param principal 인증된 사용자 정보 (신고자)
     * @param request   신고 요청 정보
     * @return 신고 접수 결과
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResTemplate<ReportResponse> createReport(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ReportRequest request) {

        ReportResponse response = reportService.createReport(principal.getUserId(), request);

        return ResTemplate.success(HttpStatus.CREATED, "신고가 정상적으로 접수되었습니다.", response);
    }
}
