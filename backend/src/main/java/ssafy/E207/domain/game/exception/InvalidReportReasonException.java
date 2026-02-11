package ssafy.E207.domain.game.exception;

import ssafy.E207.global.error.exception.InvalidGroupException;

/**
 * 신고 요청 유효성 검증 실패 예외.
 * HTTP 400 Bad Request로 처리된다.
 */
public class InvalidReportReasonException extends InvalidGroupException {

    public InvalidReportReasonException(String message) {
        super(message);
    }

    /** 기타 사유 선택 시 상세 내용 누락 */
    public static InvalidReportReasonException detailRequired() {
        return new InvalidReportReasonException("기타 사유 선택 시 상세 내용을 입력은 필수입니다.");
    }

    /** 상세 내용 길이 초과 (500자) */
    public static InvalidReportReasonException detailTooLong() {
        return new InvalidReportReasonException("상세 내용은 최대 500자까지 입력 가능합니다.");
    }

    /** 신고 대상 닉네임 누락 */
    public static InvalidReportReasonException targetNicknameRequired() {
        return new InvalidReportReasonException("신고 대상 닉네임을 입력해주세요.");
    }

    /** 신고 사유 누락 */
    public static InvalidReportReasonException reasonRequired() {
        return new InvalidReportReasonException("신고 사유를 선택해주세요.");
    }
}
