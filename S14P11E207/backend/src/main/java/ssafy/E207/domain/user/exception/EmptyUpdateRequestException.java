package ssafy.E207.domain.user.exception;

import ssafy.E207.global.error.exception.InvalidGroupException;

/**
 * [User][Exception] EmptyUpdateRequestException
 * 개인정보 수정 요청에 변경할 필드가 하나도 없을 때.
 *
 * HTTP 400 BAD_REQUEST
 */
public class EmptyUpdateRequestException extends InvalidGroupException {
    private EmptyUpdateRequestException() {
        super("잘못된 요청입니다.");
    }

    public static EmptyUpdateRequestException empty() {
        return new EmptyUpdateRequestException();
    }
}

