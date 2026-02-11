package ssafy.E207.domain.user.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ssafy.E207.domain.user.entity.BattleRecord;
import ssafy.E207.global.common.enums.BattleResult;

import java.util.List;
import java.util.UUID;

public interface BattleRecordRepository extends JpaRepository<BattleRecord, Long> {

    @Query("select br.result from BattleRecord br where br.user.id = :userId order by br.createdAt desc")
    List<BattleResult> findRecentResults(@Param("userId") UUID userId, Pageable pageable);

    boolean existsByRoomIdAndUser_Id(Long roomId, UUID userId);
}
