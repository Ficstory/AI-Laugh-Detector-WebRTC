package ssafy.E207.domain.auth.exception;

import ssafy.E207.global.error.exception.InvalidGroupException;

/**
 * [Auth][Exception] InvalidNicknameFormatException
 * 닉네임 형식(길이/허용문자)이 유효하지 않을 때 발생.
 *
 * HTTP 400 BAD_REQUEST
 */
public class InvalidNicknameFormatException extends InvalidGroupException {
    public InvalidNicknameFormatException() {
        super("유효하지 않은 닉네임 형식입니다.");
    }

    public static InvalidNicknameFormatException invalid() {
        return new InvalidNicknameFormatException();
    }
}

