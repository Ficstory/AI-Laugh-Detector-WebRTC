package ssafy.E207.domain.match.service;

import java.nio.charset.StandardCharsets;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import ssafy.E207.domain.match.exception.ElectronNeededException;

@Service
@RequiredArgsConstructor
public class ElectronSignatureCheckService {
	@Value("${electron.secret-key}")
	private String secretKey;

	private boolean isValidElectronSignature(String signature, String timestamp) {
		try {
			// [방어 1] 시간차 검증 (Replay Attack 방지)
			// 요청 생성 시간과 서버 시간의 차이가 5분(300,000ms) 이상이면 거부
			long requestTime = Long.parseLong(timestamp);
			long currentTime = System.currentTimeMillis();
			if (Math.abs(currentTime - requestTime) > 300000) {
				return false;
			}

			// [방어 2] HMAC-SHA256 계산
			// 일렉트론 메인 프로세스와 동일하게 'timestamp'만 볶습니다.
			Mac sha256_HMAC = Mac.getInstance("HmacSHA256");
			SecretKeySpec secret_key = new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
			sha256_HMAC.init(secret_key);

			byte[] hash = sha256_HMAC.doFinal(timestamp.getBytes(StandardCharsets.UTF_8));

			// 바이트 배열을 16진수 문자열로 변환 (Hex Encoding)
			// Apache Commons Codec의 Hex.encodeHexString 또는 아래 방식 사용
			StringBuilder hexString = new StringBuilder();
			for (byte b : hash) {
				String hex = Integer.toHexString(0xff & b);
				if (hex.length() == 1)
					hexString.append('0');
				hexString.append(hex);
			}
			String computedSignature = hexString.toString();

			// 계산된 서명과 받은 서명이 일치하는지 비교
			return computedSignature.equalsIgnoreCase(signature);

		} catch (Exception e) {
			return false;
		}
	}

	public boolean checkIsValidElectronApp(HttpServletRequest request) {
		String signature = request.getHeader("X-Signature");
		String timestamp = request.getHeader("X-Timestamp");

		// 2. 헤더 누락 확인
		if (signature == null || timestamp == null) {
			throw new ElectronNeededException("일렉트론 앱의 보안 서명이 없습니다.");
		}

		// 3. 서명 검증 (Data 제외, Timestamp만 사용)
		if (!isValidElectronSignature(signature, timestamp)) {
			throw new ElectronNeededException("유효하지 않은 보안 서명입니다. 공식 앱을 사용해 주세요.");
		}
		return true;
	}

	public boolean isElectronApp(HttpServletRequest request) {
		String signature = request.getHeader("X-Signature");
		String timestamp = request.getHeader("X-Timestamp");

		// 2. 헤더 누락 확인
		if (signature == null || timestamp == null) {
			return false;
		}

		// 3. 서명 검증 (Data 제외, Timestamp만 사용)
		return isValidElectronSignature(signature, timestamp);
	}
}
