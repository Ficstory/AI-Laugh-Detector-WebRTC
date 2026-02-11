package ssafy.E207.domain.auth.exception;

import lombok.Getter;
import ssafy.E207.global.error.exception.NotFoundGroupException;

@Getter
public class NeedRegistrationException extends NotFoundGroupException {

	private final String registerToken;

	public NeedRegistrationException(String registerToken) {
		super("회원가입이 필요합니다.");
		this.registerToken = registerToken;
	}
}
