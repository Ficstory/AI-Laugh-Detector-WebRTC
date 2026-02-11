package ssafy.E207.domain.user.exception;

import ssafy.E207.global.error.exception.InternalServerErrorGroupException;

/**
 * [User][Exception] MinioException
 * MinIO 관련 작업 실패 시.
 *
 * HTTP 500 INTERNAL_SERVER_ERROR
 */
public class MinioException extends InternalServerErrorGroupException {
    public MinioException(String message) {
        super(message, null);
    }

    public MinioException(String message, Throwable cause) {
        super(message, cause);
    }

    public static MinioException presignedUrlFailed() {
        return new MinioException("이미지 업로드 URL 생성에 실패했습니다.");
    }

    public static MinioException presignedUrlFailed(Throwable cause) {
        return new MinioException("이미지 업로드 URL 생성에 실패했습니다.", cause);
    }
}
