package ssafy.E207.domain.game.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import ssafy.E207.domain.game.entity.Report;

import java.util.List;
import java.util.UUID;

/**
 * 신고 Repository.
 */
@Repository
public interface ReportRepository extends JpaRepository<Report, Long> {

    /**
     * 특정 사용자가 신고한 내역 조회 (최신순).
     */
    List<Report> findByReporterIdOrderByCreatedAtDesc(UUID reporterId);

    /**
     * 특정 사용자가 신고당한 내역 조회 (최신순).
     */
    List<Report> findByTargetIdOrderByCreatedAtDesc(UUID targetId);

    /**
     * 전체 신고 내역 조회 (최신순).
     */
    List<Report> findAllByOrderByCreatedAtDesc();
}
