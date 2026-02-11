package ssafy.E207.domain.match.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import io.lettuce.core.dynamic.annotation.Param;
import jakarta.persistence.LockModeType;
import ssafy.E207.domain.match.entity.Room;
import ssafy.E207.global.common.enums.RoomType;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
	Page<Room> findAll(Pageable pageable);
	Page<Room> findByRoomType(RoomType roomType, Pageable pageable);
	Optional<Room> findByRoomCode(String roomCode);
	boolean existsByRoomCode(String roomCode);

	@org.springframework.data.jpa.repository.Modifying
	@org.springframework.data.jpa.repository.Query("UPDATE Room r SET r.hostId = NULL WHERE r.hostId = :userId")
	void nullifyHostId(@org.springframework.data.repository.query.Param("userId") java.util.UUID userId);

	@org.springframework.data.jpa.repository.Modifying
	@org.springframework.data.jpa.repository.Query("UPDATE Room r SET r.currentAttacker = NULL WHERE r.currentAttacker.id = :userId")
	void nullifyCurrentAttackerId(@org.springframework.data.repository.query.Param("userId") java.util.UUID userId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select r from Room r where r.id = :id")
	Optional<Room> findByIdWithLock(@Param("id") Long id);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select r from Room r where r.roomCode = :roomCode")
	Optional<Room> findByRoomCodeWithLock(String roomCode);

}