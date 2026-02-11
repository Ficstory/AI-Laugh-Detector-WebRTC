package ssafy.E207.domain.user.service;

import io.jsonwebtoken.Claims;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.RemoveObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ssafy.E207.domain.auth.exception.InvalidTokenException;
import ssafy.E207.domain.user.dto.request.UploadProfileImageRequest;
import ssafy.E207.domain.user.dto.response.UploadProfileImageResponse;
import ssafy.E207.domain.user.exception.InvalidFileTypeException;
import ssafy.E207.domain.user.exception.FileSizeExceededException;
import ssafy.E207.domain.user.exception.MinioException;
import ssafy.E207.global.config.MinioConfig;
import ssafy.E207.global.jwt.JwtTokenProvider;
import ssafy.E207.global.jwt.UserPrincipal;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class MinioService {

    private final MinioClient minioClient;
    // minioExternalClient 제거: 사용하지 않음 (XML 파싱 에러 원인)
    private final MinioConfig minioConfig;
    private final JwtTokenProvider jwtTokenProvider;

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/gif",
            "image/webp"
    );

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    /**
     * 프로필 이미지 업로드용 Presigned URL 생성
     *
     * 인증 방식:
     * 1. 로그인 유저: UserPrincipal(accessToken)에서 userId 추출
     * 2. 회원가입 중: registerToken에서 oauthId+provider 추출하여 임시 키 생성
     */
    public UploadProfileImageResponse generatePresignedUrl(UserPrincipal principal, UploadProfileImageRequest request) {
        // 1. Content-Type 검증
        if (!ALLOWED_CONTENT_TYPES.contains(request.contentType().toLowerCase())) {
            throw InvalidFileTypeException.invalidType();
        }

        // 2. 파일 크기 검증
        if (request.fileSize() > MAX_FILE_SIZE) {
            throw FileSizeExceededException.exceeded();
        }

        // 3. 사용자 식별자 결정 (로그인 유저 or 회원가입 유저)
        String userIdentifier = resolveUserIdentifier(principal, request.registerToken());

        // 4. objectKey 생성
        String objectKey = generateObjectKey(userIdentifier, request.originalFileName());

        // 5. Presigned PUT URL 생성
        try {
            // ⚠️ 중요: 내부 minioClient를 사용해야 함!
            // minioExternalClient를 사용하면 Nginx를 거쳐 XML 파싱 에러 발생
            String presignedUrl = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.PUT)
                            .bucket(minioConfig.getBucket())
                            .object(objectKey)
                            .expiry(minioConfig.getPresignedUrlExpiry(), TimeUnit.SECONDS)
                            .build()
            );

            // MinioClient는 내부 엔드포인트(예: http://dev-minio:9000)로 URL을 생성
            // 프론트엔드에서 접근 가능하도록 외부 엔드포인트로 도메인 교체
            // 예: http://dev-minio:9000/bucket/key?sig=xxx
            //  → http://i14e207.p.ssafy.io/dev/objects/bucket/key?sig=xxx
            try {
                java.net.URI internalUri = new java.net.URI(minioConfig.getEndpoint());
                String internalBase = internalUri.getScheme() + "://" + internalUri.getAuthority();

                String cleanExternalEndpoint = minioConfig.getExternalEndpoint();
                if (cleanExternalEndpoint.endsWith("/")) {
                    cleanExternalEndpoint = cleanExternalEndpoint.substring(0, cleanExternalEndpoint.length() - 1);
                }
                
                presignedUrl = presignedUrl.replaceFirst(
                    java.util.regex.Pattern.quote(internalBase),
                    cleanExternalEndpoint
                );

            } catch (Exception e) {
                log.warn("[MinIO] URL Domain Replacement Failed: {}", e.getMessage());
                // 실패해도 원본 유지
            }

            log.info("[MinIO] Presigned URL 생성 완료: userIdentifier={}, objectKey={}", userIdentifier, objectKey);
            return UploadProfileImageResponse.of(presignedUrl, objectKey);

        } catch (Exception e) {
            log.error("[MinIO] Presigned URL 생성 실패: userIdentifier={}, error={}", userIdentifier, e.getMessage(), e);
            throw MinioException.presignedUrlFailed();
        }
    }

    /**
     * 사용자 식별자 결정
     *
     * 1순위: accessToken (UserPrincipal)
     * 2순위: registerToken
     */
    private String resolveUserIdentifier(UserPrincipal principal, String registerToken) {
        // 로그인 유저 (accessToken 있음)
        if (principal != null && principal.getUserId() != null) {
            return principal.getUserId().toString();
        }

        // 회원가입 유저 (registerToken 있음)
        if (registerToken != null && !registerToken.isBlank()) {
            try {
                Claims claims = jwtTokenProvider.parseClaims(registerToken);
                String type = claims.get("type", String.class);

                if (!"register".equals(type)) {
                    throw InvalidTokenException.invalidToken();
                }

                String oauthId = claims.getSubject();
                String provider = claims.get("provider", String.class);

                // 회원가입 전이므로 oauthId+provider로 임시 식별자 생성
                return "temp_" + provider + "_" + oauthId;

            } catch (Exception e) {
                log.warn("[MinIO] registerToken 파싱 실패: {}", e.getMessage());
                throw InvalidTokenException.invalidToken();
            }
        }

        // 둘 다 없으면 인증 실패
        throw InvalidTokenException.invalidToken();
    }

    /**
     * objectKey 생성
     * 형식: profile/{userIdentifier}/{year}/{month}/{uuid}.{extension}
     */
    private String generateObjectKey(String userIdentifier, String originalFileName) {
        LocalDate now = LocalDate.now();
        String year = now.format(DateTimeFormatter.ofPattern("yyyy"));
        String month = now.format(DateTimeFormatter.ofPattern("MM"));

        String extension = extractExtension(originalFileName);
        String uniqueId = UUID.randomUUID().toString();

        return String.format("profile/%s/%s/%s/%s.%s", userIdentifier, year, month, uniqueId, extension);
    }

    /**
     * 파일 확장자 추출
     */
    private String extractExtension(String fileName) {
        if (fileName == null || !fileName.contains(".")) {
            return "png"; // 기본값
        }
        return fileName.substring(fileName.lastIndexOf(".") + 1).toLowerCase();
    }

    /**
     * MinIO에 해당 objectKey의 파일이 존재하는지 확인
     *
     * @param objectKey 확인할 파일의 objectKey
     * @return 파일이 존재하면 true
     */
    public boolean checkObjectExists(String objectKey) {
        try {
            minioClient.statObject(
                    StatObjectArgs.builder()
                            .bucket(minioConfig.getBucket())
                            .object(objectKey)
                            .build()
            );
            log.info("[MinIO] 파일 존재 확인: objectKey={}", objectKey);
            return true;
        } catch (Exception e) {
            log.warn("[MinIO] 파일 존재하지 않음: objectKey={}, error={}", objectKey, e.getMessage());
            return false;
        }
    }

    /**
     * 프로필 이미지 확인 시 사용자 식별자 결정
     */
    public String resolveUserIdentifierForConfirm(UserPrincipal principal, String registerToken) {
        return resolveUserIdentifier(principal, registerToken);
    }

    /**
     * MinIO에서 파일 삭제
     *
     * @param objectKey 삭제할 파일의 objectKey
     * @param userIdentifier 요청자 식별자 (권한 검증용)
     * @return 삭제 성공 여부
     */
    public boolean deleteObject(String objectKey, String userIdentifier) {
        // 보안: 자신의 파일만 삭제 가능하도록 검증
        if (!objectKey.contains("/" + userIdentifier + "/")) {
            log.warn("[MinIO] 파일 삭제 권한 없음: objectKey={}, userIdentifier={}", objectKey, userIdentifier);
            return false;
        }

        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(minioConfig.getBucket())
                            .object(objectKey)
                            .build()
            );
            log.info("[MinIO] 파일 삭제 완료: objectKey={}", objectKey);
            return true;
        } catch (Exception e) {
            log.error("[MinIO] 파일 삭제 실패: objectKey={}, error={}", objectKey, e.getMessage(), e);
            return false;
        }
    }
}
