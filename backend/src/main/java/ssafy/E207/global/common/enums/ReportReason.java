package ssafy.E207.global.common.enums;

/**
 * 신고 사유 Enum.
 * 사용자가 다른 사용자를 신고할 때 선택하는 사유 유형.
 */
public enum ReportReason {
    PROFANITY,              // 욕설/비속어 사용
    INAPPROPRIATE_BEHAVIOR, // 부적절한 행동 (부적절한 영상 노출 등)
    HARASSMENT,             // 괴롭힘/따돌림
    OTHER                   // 기타 (detail 필수)
}
