package ssafy.E207.global.config;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * MinIO 버킷 초기화 컴포넌트
 * 애플리케이션 시작 완료 후 버킷이 없으면 자동 생성
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MinioInitializer {

    private final MinioClient minioClient;
    private final MinioConfig minioConfig;

    @EventListener(ApplicationReadyEvent.class)
    public void initBucket() {
        String bucket = minioConfig.getBucket();

        try {
            boolean exists = minioClient.bucketExists(
                    BucketExistsArgs.builder().bucket(bucket).build()
            );

            if (!exists) {
                minioClient.makeBucket(
                        MakeBucketArgs.builder().bucket(bucket).build()
                );
                log.info("[MinIO] 버킷 생성 완료: {}", bucket);
            } else {
                log.info("[MinIO] 버킷 이미 존재: {}", bucket);
            }

            // 설정: 퍼블릭 읽기 정책 적용 (누구나 이미지 보기 가능) - 기존 버킷에도 강제 적용
            // JSON 정책 생성
            String policy = "{\n" +
                    "    \"Version\": \"2012-10-17\",\n" +
                    "    \"Statement\": [\n" +
                    "        {\n" +
                    "            \"Effect\": \"Allow\",\n" +
                    "            \"Principal\": {\"AWS\": [\"*\"]},\n" +
                    "            \"Action\": [\"s3:GetObject\"],\n" +
                    "            \"Resource\": [\"arn:aws:s3:::" + bucket + "/*\"]\n" +
                    "        }\n" +
                    "    ]\n" +
                    "}";

            minioClient.setBucketPolicy(
                    io.minio.SetBucketPolicyArgs.builder()
                            .bucket(bucket)
                            .config(policy)
                            .build()
            );

            log.info("[MinIO] 버킷 정책 설정 완료 (Public Read): {}", bucket);
        } catch (Exception e) {
            log.error("[MinIO] 버킷 초기화 실패: bucket={}, error={}", bucket, e.getMessage(), e);
        }
    }
}

