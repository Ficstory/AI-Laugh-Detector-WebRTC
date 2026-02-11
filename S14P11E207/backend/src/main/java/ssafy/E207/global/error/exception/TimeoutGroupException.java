package ssafy.E207.global.error.exception;

public abstract class TimeoutGroupException extends RuntimeException {
	public TimeoutGroupException(String message) {
		super(message);
	}
}
