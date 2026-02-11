package ssafy.E207.domain.user.exception;

import ssafy.E207.global.error.exception.InvalidGroupException;

/**
 * [User][Exception] ImageNotUploadedException
 * MinIO에 이미지가 업로드되지 않았을 때.
 *
 * HTTP 400 BAD_REQUEST
 */
public class ImageNotUploadedException extends InvalidGroupException {
    private ImageNotUploadedException(String message) {
        super(message);
    }

    public static ImageNotUploadedException notUploaded() {
        return new ImageNotUploadedException("이미지가 업로드되지 않았습니다. 먼저 이미지를 업로드해주세요.");
    }
}

