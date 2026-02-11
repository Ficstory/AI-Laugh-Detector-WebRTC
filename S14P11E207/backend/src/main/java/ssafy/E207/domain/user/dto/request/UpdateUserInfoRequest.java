package ssafy.E207.domain.user.dto.request;

public record UpdateUserInfoRequest(
        String nickname,
        Boolean isMarketing
) {
}
