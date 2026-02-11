package ssafy.E207.domain.user.exception;

import ssafy.E207.global.error.exception.InvalidGroupException;

/**
 * [User][Exception] FileSizeExceededException
 * 파일 크기가 제한을 초과했을 때.
 *
 * HTTP 400 BAD_REQUEST
 */
public class FileSizeExceededException extends InvalidGroupException {
    private FileSizeExceededException(String message) {
        super(message);
    }

    public static FileSizeExceededException exceeded() {
        return new FileSizeExceededException("파일 크기가 제한(5MB)을 초과했습니다.");
    }
}

