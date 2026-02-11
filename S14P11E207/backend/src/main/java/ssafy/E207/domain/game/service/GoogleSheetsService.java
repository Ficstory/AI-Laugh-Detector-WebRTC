package ssafy.E207.domain.game.service;

import com.google.api.services.sheets.v4.Sheets;
import com.google.api.services.sheets.v4.model.AppendValuesResponse;
import com.google.api.services.sheets.v4.model.ValueRange;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ssafy.E207.domain.game.entity.Report;
import ssafy.E207.global.config.GoogleSheetsConfig;

import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class GoogleSheetsService {

    private final Sheets sheetsClient;
    private final GoogleSheetsConfig googleSheetsConfig;

    private static final String SHEET_RANGE = "시트1!A:F";
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /**
     * 신고 데이터를 Google Sheets에 한 줄 추가
     */
    public void appendReport(Report report, String reporterNickname) {
        try {
            List<Object> row = List.of(
                    report.getId(),
                    reporterNickname,
                    report.getTargetNickname(),
                    report.getReason().name(),
                    report.getDetail() != null ? report.getDetail() : "",
                    report.getCreatedAt().format(FORMATTER)
            );

            ValueRange body = new ValueRange()
                    .setValues(Collections.singletonList(row));

            AppendValuesResponse response = sheetsClient.spreadsheets().values()
                    .append(googleSheetsConfig.getSpreadsheetId(), SHEET_RANGE, body)
                    .setValueInputOption("USER_ENTERED")
                    .execute();

            log.info("[GoogleSheets] 신고 데이터 기록 완료: reportId={}, updatedRange={}",
                    report.getId(), response.getUpdates().getUpdatedRange());

        } catch (Exception e) {
            log.error("[GoogleSheets] 신고 데이터 기록 실패: reportId={}, error={}", report.getId(), e.getMessage(), e);
        }
    }

    /**
     * Google Sheets에서 전체 신고 데이터 조회
     */
    public List<List<Object>> getReports() {
        try {
            ValueRange result = sheetsClient.spreadsheets().values()
                    .get(googleSheetsConfig.getSpreadsheetId(), SHEET_RANGE)
                    .execute();

            List<List<Object>> values = result.getValues();
            if (values == null || values.isEmpty()) {
                log.info("[GoogleSheets] 시트에 데이터가 없습니다.");
                return Collections.emptyList();
            }

            log.info("[GoogleSheets] 신고 데이터 조회 완료: {}건", values.size());
            return values;

        } catch (Exception e) {
            log.error("[GoogleSheets] 신고 데이터 조회 실패: error={}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }
}
