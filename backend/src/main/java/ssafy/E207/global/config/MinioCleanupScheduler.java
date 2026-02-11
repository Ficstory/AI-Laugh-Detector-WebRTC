package ssafy.E207.global.config;

import io.minio.ListObjectsArgs;
import io.minio.MinioClient;
import io.minio.RemoveObjectArgs;
import io.minio.Result;
import io.minio.messages.Item;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import ssafy.E207.domain.user.repository.UserRepository;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * MinIO 미사용 파일 정리 스케줄러
 *
 * - Presigned URL 발급 후 업로드/확인되지 않은 파일 정리
 * - DB에 등록되지 않은 고아 파일 삭제
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MinioCleanupScheduler {

    private final MinioClient minioClient;
    private final MinioConfig minioConfig;
    private final UserRepository userRepository;

    // 파일 보관 기간 (시간 단위) - 이 시간이 지난 미사용 파일 삭제
    private static final int RETENTION_HOURS = 1;

    /**
     * 매 시간마다 미사용 파일 정리
     *
     * - DB에 등록되지 않은 파일 중 1시간 이상 지난 파일 삭제
     * - temp_ 로 시작하는 회원가입 미완료 파일도 정리
     */
    @Scheduled(cron = "0 0 * * * *") // 매 시간 정각
    public void cleanupOrphanedFiles() {
        log.info("[MinIO Cleanup] 미사용 파일 정리 시작");

        String bucket = minioConfig.getBucket();
        Instant cutoffTime = Instant.now().minus(RETENTION_HOURS, ChronoUnit.HOURS);
        int deletedCount = 0;
        int checkedCount = 0;

        try {
            Iterable<Result<Item>> results = minioClient.listObjects(
                    ListObjectsArgs.builder()
                            .bucket(bucket)
                            .prefix("profile/")
                            .recursive(true)
                            .build()
            );

            for (Result<Item> result : results) {
                try {
                    checkedCount++;
                    Item item = result.get();
                    String objectKey = item.objectName();

                    // lastModified가 null일 수 있음
                    if (item.lastModified() == null) {
                        log.warn("[MinIO Cleanup] lastModified가 null: {}", objectKey);
                        continue;
                    }

                    Instant lastModified = item.lastModified().toInstant();

                    // 1. 최근 파일은 스킵 (아직 확인 중일 수 있음)
                    if (lastModified.isAfter(cutoffTime)) {
                        continue;
                    }

                    // 2. temp_ 로 시작하는 회원가입 미완료 파일 삭제
                    if (objectKey.contains("/temp_")) {
                        deleteObject(bucket, objectKey);
                        deletedCount++;
                        continue;
                    }

                    // 3. DB에 등록되지 않은 파일 삭제
                    if (!isObjectInDatabase(objectKey)) {
                        deleteObject(bucket, objectKey);
                        deletedCount++;
                    }
                } catch (Exception e) {
                    log.warn("[MinIO Cleanup] 파일 처리 중 오류: {}", e.getMessage());
                }
            }

            log.info("[MinIO Cleanup] 정리 완료: 검사={}, 삭제={}", checkedCount, deletedCount);

        } catch (Exception e) {
            log.error("[MinIO Cleanup] 정리 중 오류 발생: {}", e.getMessage(), e);
        }
    }

    /**
     * DB에 해당 objectKey가 등록되어 있는지 확인
     */
    private boolean isObjectInDatabase(String objectKey) {
        return userRepository.existsByProfileImage(objectKey);
    }

    /**
     * MinIO에서 파일 삭제
     */
    private void deleteObject(String bucket, String objectKey) {
        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .build()
            );
            log.info("[MinIO Cleanup] 파일 삭제: {}", objectKey);
        } catch (Exception e) {
            log.warn("[MinIO Cleanup] 파일 삭제 실패: {}, error={}", objectKey, e.getMessage());
        }
    }
}

