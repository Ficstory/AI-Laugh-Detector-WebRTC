package ssafy.E207.domain.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import ssafy.E207.domain.auth.entity.User;
import ssafy.E207.global.common.enums.OAuthProvider;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    /**
     * OAuth 제공자와 ID로 사용자 조회.
     *
     * @param oauthProvider OAuth 제공자 (KAKAO, GOOGLE 등)
     * @param oauthId       OAuth 제공자 측의 사용자 식별자
     * @return 사용자 엔티티 (Optional)
     */
    Optional<User> findByOauthProviderAndOauthId(OAuthProvider oauthProvider, String oauthId);

    /**
     * 닉네임 중복 여부 확인.
     *
     * @param nickname 확인할 닉네임
     * @return 중복 시 true, 사용 가능 시 false
     */
    boolean existsByNickname(String nickname);

    /**
     * 프로필 이미지 URL(objectKey)이 DB에 등록되어 있는지 확인.
     *
     * @param profileImage MinIO objectKey
     * @return 등록 시 true
     */
    boolean existsByProfileImage(String profileImage);

    /**
     * 닉네임으로 사용자 조회.
     *
     * @param nickname 조회할 닉네임
     * @return 사용자 엔티티 (Optional)
     */
    Optional<User> findByNickname(String nickname);
}
