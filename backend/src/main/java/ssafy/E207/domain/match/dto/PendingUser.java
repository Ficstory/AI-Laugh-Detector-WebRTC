package ssafy.E207.domain.match.dto;

import java.util.UUID;

public record PendingUser(UUID userId, boolean isElectron) {
}
