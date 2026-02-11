package ssafy.E207.domain.match.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import ssafy.E207.domain.auth.entity.User;
import ssafy.E207.domain.match.entity.Room;
import ssafy.E207.domain.match.entity.RoomParticipant;

@Repository
public interface RoomParticipantRepository extends JpaRepository<RoomParticipant, Long> {
	List<RoomParticipant> findByRoom(Room room);
	Optional<RoomParticipant> findByRoomAndUser(Room Room, User user);
	Optional<RoomParticipant> findByRoomIdAndUserId(Long roomId, UUID userId);
	Optional<RoomParticipant> findFirstByRoomIdOrderByCreatedAtAsc(Long roomId);
	void deleteByRoomIdAndUserId(Long roomId, UUID userId);
	List<RoomParticipant> findAllByRoomId(Long roomId);
	Long countByRoomId(Long roomId);
	void deleteByUserId(UUID userId);
	List<RoomParticipant> findAllByUserId(UUID userId);
}
