package ssafy.E207.global.config;

import io.minio.MinioClient;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "minio")
public class MinioConfig {

    private String endpoint;
    private String externalEndpoint; // 외부 접근용 (Presigned URL)
    private String accessKey;
    private String secretKey;
    private String bucket;
    private int presignedUrlExpiry;

    @Bean
    public MinioClient minioClient() {
        return MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
    }

    /**
     * ⚠️ 사용 중단: minioExternalClient는 Nginx를 거쳐 XML 파싱 에러 발생
     *
     * 대신 minioClient를 사용하여 presigned URL을 생성한 후,
     * URL의 도메인 부분만 externalEndpoint로 교체하는 방식 사용
     * (MinioService.generatePresignedUrl 참조)
     */
    /*
    @Bean
    public MinioClient minioExternalClient() {
        // MinIO Client는 endpoint에 Path(예: /objects)가 들어가는 것을 허용하지 않음
        // 따라서 scheme://domain:port 만 추출해서 설정해야 함
        String baseUrl = externalEndpoint;
        try {
            java.net.URI uri = new java.net.URI(externalEndpoint);
            baseUrl = uri.getScheme() + "://" + uri.getAuthority();
        } catch (Exception e) {
            // URI 파싱 실패 시 원래 값 사용 (로그만 남김)
            System.err.println("[MinioConfig] URL parsing failed: " + e.getMessage());
        }

        return MinioClient.builder()
                .endpoint(baseUrl)
                .credentials(accessKey, secretKey)
                .build();
    }
    */
}
