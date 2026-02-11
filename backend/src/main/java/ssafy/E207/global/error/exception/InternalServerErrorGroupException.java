package ssafy.E207.global.error.exception;

public abstract class InternalServerErrorGroupException extends RuntimeException {
	public InternalServerErrorGroupException(String message, Throwable cause) {
		super(message);
	}
}
