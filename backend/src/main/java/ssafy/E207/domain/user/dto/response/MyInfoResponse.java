package ssafy.E207.domain.user.dto.response;

import lombok.Builder;
import ssafy.E207.domain.auth.entity.User;

import java.util.List;
import java.util.UUID;

@Builder
public record MyInfoResponse(
        UUID id,
        String nickname,
        String profileImageUrl,
        Boolean isMarketing,
        int totalGames,
        int totalWins,
        int totalDraws,
        int totalLosses,
        int currentWinStreak,
        int maxWinStreak,
        List<String> recentResults
) {
    public static MyInfoResponse from(User user, String profileImageUrl, List<String> recentResults) {
        return MyInfoResponse.builder()
                .id(user.getId())
                .nickname(user.getNickname())
                .profileImageUrl(profileImageUrl) // 해결된 URL 사용
                .isMarketing(user.isMarketing())
                .totalGames(user.getTotalGames())
                .totalWins(user.getTotalWins())
                .totalDraws(user.getTotalDraws())
                .totalLosses(user.getTotalLosses())
                .currentWinStreak(user.getCurrentWinStreak())
                .maxWinStreak(user.getMaxWinStreak())
                .recentResults(recentResults)
                .build();
    }
}
