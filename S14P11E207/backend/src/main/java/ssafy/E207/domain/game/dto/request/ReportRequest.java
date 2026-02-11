package ssafy.E207.domain.game.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ssafy.E207.global.common.enums.ReportReason;

/*
신고 요청 DTO
*/

public record ReportRequest(
    @NotBlank(message = "신고 대상 닉네임을 입력해주세요.")
    String targetNickname, // 신고 대상자 닉네임

    @NotNull(message = "신고 사유를 선택해주세요.")
    ReportReason reason, // 신고 사유

    @Size(max = 500, message = "상세 내용은 최대 500자까지 입력 가능합니다.")
    String detail // 상세 내용(최대 500자, reason 이 OTHER 인 경우 필수)
) {
}
