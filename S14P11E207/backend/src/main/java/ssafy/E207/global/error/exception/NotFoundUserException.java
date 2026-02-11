package ssafy.E207.global.error.exception;

public class NotFoundUserException extends RuntimeException {
	public NotFoundUserException(String message) {
		super(message);
	}

	public static NotFoundUserException notFound() {
		return new NotFoundUserException("존재하지 않는 유저입니다.");
	}
}
