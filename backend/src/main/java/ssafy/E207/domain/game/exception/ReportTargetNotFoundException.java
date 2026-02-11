package ssafy.E207.domain.game.exception;

import ssafy.E207.global.error.exception.NotFoundGroupException;

/**
 * 신고 대상 사용자를 찾을 수 없을 때 발생하는 예외.
 * HTTP 404 Not Found로 처리된다.
 */
public class ReportTargetNotFoundException extends NotFoundGroupException {

    public ReportTargetNotFoundException(String message) {
        super(message);
    }

    /** 신고 대상 사용자 없음 */
    public static ReportTargetNotFoundException notFound() {
        return new ReportTargetNotFoundException("신고 대상 사용자를 찾을 수 없습니다.");
    }
}
