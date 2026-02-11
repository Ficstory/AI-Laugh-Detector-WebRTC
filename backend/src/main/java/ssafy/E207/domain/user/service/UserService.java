package ssafy.E207.domain.user.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ssafy.E207.domain.auth.entity.User;
import ssafy.E207.domain.auth.exception.DuplicateNicknameException;
import ssafy.E207.domain.user.dto.request.UpdateUserInfoRequest;
import ssafy.E207.domain.user.dto.response.MyInfoResponse;
import ssafy.E207.domain.user.dto.response.UserChangeResponse;
import ssafy.E207.domain.user.exception.EmptyUpdateRequestException;
import ssafy.E207.domain.user.exception.InvalidNicknamePolicyException;
import ssafy.E207.domain.user.repository.BattleRecordRepository;
import ssafy.E207.domain.user.repository.UserRepository;
import ssafy.E207.global.common.enums.BattleResult;
import ssafy.E207.global.error.exception.NotFoundUserException;

import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final BattleRecordRepository battleRecordRepository;
    private final ssafy.E207.global.config.MinioConfig minioConfig; // Config 주입

    //닉네임 정책: 1~10자, 한글/영문/숫자만 허용
    private static final Pattern NICKNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9가-힣]+$");

    /**
     * [API] 내 정보 조회
     */
    @Transactional(readOnly = true)
    public MyInfoResponse getMyInfo(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(NotFoundUserException::notFound);

        List<BattleResult> recent = battleRecordRepository.findRecentResults(userId, PageRequest.of(0, 5));
        List<String> recentResults = recent.stream().map(Enum::name).toList();

        // URL 변환
        String profileImageUrl = resolveProfileImageUrl(user.getProfileImage());

        return MyInfoResponse.from(
                user,
                profileImageUrl,
                recentResults
        );
    }

    @Transactional
    public void changeMarketing(UUID userId, boolean isMarketing) {
        User user = userRepository.findById(userId)
                .orElseThrow(NotFoundUserException::notFound);
        user.updateMarketing(isMarketing);
        userRepository.save(user);
    }


    @Transactional
    public UserChangeResponse changeUserInfo(UUID userId, UpdateUserInfoRequest request) {
        if (request == null || (request.nickname() == null && request.isMarketing() == null)) {
            throw EmptyUpdateRequestException.empty();
        }

        User user = userRepository.findById(userId)
                .orElseThrow(NotFoundUserException::notFound);

        // nickname 변경 (optional)
        if (request.nickname() != null) {
            String newNickname = request.nickname().trim();
            validateNicknameFormatOrThrow(newNickname);

            // 동일 닉네임으로 변경 요청은 무시(정상 처리)
            if (!newNickname.equals(user.getNickname())) {
                if (userRepository.existsByNickname(newNickname)) {
                    throw DuplicateNicknameException.duplicateNickname();
                }
                user.updateNickname(newNickname);
            }
        }

        // marketing 변경 (optional)
        if (request.isMarketing() != null) {
            user.updateMarketing(request.isMarketing());
        }

        User saved = userRepository.save(user);
        
        // URL 변환
        String profileImageUrl = resolveProfileImageUrl(saved.getProfileImage());
        
        return UserChangeResponse.from(saved, profileImageUrl);
    }

    /**
     * [API] 프로필 이미지 확인 및 저장 (로그인 유저용)
     *
     * MinIO에 파일이 존재하는지 확인 후 DB에 저장
     */
    @Transactional
    public String confirmProfileImage(UUID userId, String objectKey) {
        User user = userRepository.findById(userId)
                .orElseThrow(NotFoundUserException::notFound);

        user.updateProfileImage(objectKey);
        userRepository.save(user);
        
        // URL 변환해서 반환
        return resolveProfileImageUrl(objectKey);
    }

    /******* 메서드 ********/

    /**
     * ObjectKey -> Full URL 변환
     * 
     * DB에는 "profile/user1/image.png" 같은 키만 저장됨.
     * 프론트엔드에 줄 때는 "https://도메인/objects/버킷명/profile/user1/image.png" 형태로 반환.
     * 
     * 만약 null이면 null 반환
     */
    private String resolveProfileImageUrl(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return null;
        }
        // 이미 http로 시작하면(혹시 모를 구 데이터) 그대로 반환
        if (objectKey.startsWith("http")) {
            return objectKey;
        }
        
        String externalEndpoint = minioConfig.getExternalEndpoint();
        String bucket = minioConfig.getBucket();

        // externalEndpoint가 '/'로 끝나는지 확인하여 처리
        if (!externalEndpoint.endsWith("/")) {
            externalEndpoint += "/";
        }

        return externalEndpoint + bucket + "/" + objectKey;
    }

    public boolean isValidNickname(String nickname) {
        if (nickname == null) return false;
        String v = nickname.trim();
        if (v.isBlank()) return false;
        if (v.length() > 10) return false;
        return NICKNAME_PATTERN.matcher(v).matches();
    }

    public boolean isNicknameTaken(String nickname) {
        if (nickname == null) return false;
        return userRepository.existsByNickname(nickname.trim());
    }

    public void validateNicknameFormatOrThrow(String nickname) {
        if (nickname == null || nickname.trim().isBlank()) {
            throw InvalidNicknamePolicyException.invalidChars();
        }
        String v = nickname.trim();
        if (v.length() > 10) {
            throw InvalidNicknamePolicyException.tooLong();
        }
        if (!NICKNAME_PATTERN.matcher(v).matches()) {
            throw InvalidNicknamePolicyException.invalidChars();
        }
    }
}
