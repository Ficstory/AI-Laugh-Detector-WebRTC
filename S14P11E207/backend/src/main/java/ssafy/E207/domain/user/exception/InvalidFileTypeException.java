package ssafy.E207.domain.user.exception;

import ssafy.E207.global.error.exception.InvalidGroupException;

/**
 * [User][Exception] InvalidFileTypeException
 * 허용되지 않은 파일 타입일 때.
 *
 * HTTP 400 BAD_REQUEST
 */
public class InvalidFileTypeException extends InvalidGroupException {
    private InvalidFileTypeException(String message) {
        super(message);
    }

    public static InvalidFileTypeException invalidType() {
        return new InvalidFileTypeException("허용되지 않은 파일 형식입니다. (png, jpeg, jpg, gif, webp만 가능)");
    }
}

