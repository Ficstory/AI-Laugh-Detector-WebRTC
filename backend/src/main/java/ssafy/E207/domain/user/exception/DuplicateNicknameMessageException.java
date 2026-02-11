package ssafy.E207.domain.user.exception;

import ssafy.E207.global.error.exception.ConflictGroupException;

/**
 * [User][Exception] DuplicateNicknameMessageException
 * 닉네임이 이미 사용 중일 때.
 *
 * HTTP 409 CONFLICT
 */
public class DuplicateNicknameMessageException extends ConflictGroupException {
    public DuplicateNicknameMessageException() {
        super("이미 해당 닉네임이 존재합니다.");
    }

    public static DuplicateNicknameMessageException duplicated() {
        return new DuplicateNicknameMessageException();
    }
}

