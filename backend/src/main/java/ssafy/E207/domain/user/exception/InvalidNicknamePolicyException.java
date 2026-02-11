package ssafy.E207.domain.user.exception;

import ssafy.E207.global.error.exception.InvalidGroupException;

/**
 * [User][Exception] InvalidNicknamePolicyException
 * 닉네임 정책 위반(허용문자/최대길이 등).
 *
 * HTTP 400 BAD_REQUEST
 */
public class InvalidNicknamePolicyException extends InvalidGroupException {
    public InvalidNicknamePolicyException(String message) {
        super(message);
    }

    public static InvalidNicknamePolicyException invalidChars() {
        return new InvalidNicknamePolicyException("닉네임에는 한글, 영어, 숫자만 사용가능합니다.");
    }

    public static InvalidNicknamePolicyException tooLong() {
        return new InvalidNicknamePolicyException("닉네임은 최대 10자 입니다.");
    }
}

