package ssafy.E207.domain.user.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ssafy.E207.domain.auth.entity.User;
import ssafy.E207.domain.match.entity.Room;
import ssafy.E207.domain.match.entity.RoomParticipant;
import ssafy.E207.domain.user.entity.BattleRecord;
import ssafy.E207.domain.user.repository.BattleRecordRepository;
import ssafy.E207.domain.user.repository.UserRepository;
import ssafy.E207.global.common.enums.BattleResult;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class UserBattleService {

    private final UserRepository userRepository;
    private final BattleRecordRepository battleRecordRepository;

    /**
     * 게임이 TERMINATED 되었을 때 호출
     * @param room 룸 엔티티(참가자 포함)
     * @param winnerId 승리 유저 UUID
     */
    public void recordBattleResult(Room room, UUID winnerId) {
        List<RoomParticipant> participants = room.getRoomParticipants();
        if (participants == null || participants.size() < 2) {
            return; // 방어: 기록 불가
        }

        User winner = participants.stream().map(RoomParticipant::getUser)
                .filter(u -> u.getId().equals(winnerId))
                .findFirst()
                .orElse(null);
        User loser = participants.stream().map(RoomParticipant::getUser)
                .filter(u -> !u.getId().equals(winnerId))
                .findFirst()
                .orElse(null);

        if (winner == null || loser == null) return;

        // 중복 저장 방지 (같은 roomId에 대해 동일 유저 기록이 이미 있으면 스킵)
        if (battleRecordRepository.existsByRoomIdAndUser_Id(room.getId(), winner.getId())
                || battleRecordRepository.existsByRoomIdAndUser_Id(room.getId(), loser.getId())) {
            return;
        }

        // 영속 상태 확보
        winner = userRepository.findById(winner.getId()).orElse(winner);
        loser = userRepository.findById(loser.getId()).orElse(loser);

        // BattleRecord 2건 저장 (유저 기준)
        battleRecordRepository.save(BattleRecord.builder()
                .roomId(room.getId())
                .user(winner)
                .result(BattleResult.W)
                .opponentUserId(loser.getId().toString())
                .build());

        battleRecordRepository.save(BattleRecord.builder()
                .roomId(room.getId())
                .user(loser)
                .result(BattleResult.L)
                .opponentUserId(winner.getId().toString())
                .build());

        // 누적 스탯 업데이트
        winner.applyWinResult();
        loser.applyLossResult();

        userRepository.save(winner);
        userRepository.save(loser);
    }

	/**
	 * 게임이 TERMINATED 되었을 때 호출
	 * @param room 룸 엔티티(참가자 포함)
	 */
	public void recordDraw(Room room, UUID userId) {
		List<RoomParticipant> participants = room.getRoomParticipants();
		if (participants == null || participants.size() < 2) {
			return; // 방어: 기록 불가
		}

		User someone = participants.stream().map(RoomParticipant::getUser)
			.filter(u -> u.getId().equals(userId))
			.findFirst()
			.orElse(null);
		User opponent = participants.stream().map(RoomParticipant::getUser)
			.filter(u -> !u.getId().equals(userId))
			.findFirst()
			.orElse(null);

		if (someone == null || opponent == null) return;

		// 중복 저장 방지 (같은 roomId에 대해 동일 유저 기록이 이미 있으면 스킵)
		if (battleRecordRepository.existsByRoomIdAndUser_Id(room.getId(), someone.getId())
			|| battleRecordRepository.existsByRoomIdAndUser_Id(room.getId(), opponent.getId())) {
			return;
		}

		// 영속 상태 확보
		someone = userRepository.findById(someone.getId()).orElse(someone);
		opponent = userRepository.findById(opponent.getId()).orElse(opponent);

		// BattleRecord 2건 저장 (유저 기준)
		battleRecordRepository.save(BattleRecord.builder()
			.roomId(room.getId())
			.user(someone)
			.result(BattleResult.D)
			.opponentUserId(opponent.getId().toString())
			.build());

		battleRecordRepository.save(BattleRecord.builder()
			.roomId(room.getId())
			.user(opponent)
			.result(BattleResult.D)
			.opponentUserId(someone.getId().toString())
			.build());

		// 누적 스탯 업데이트
		someone.applyDrawResult();
		opponent.applyDrawResult();

		userRepository.save(someone);
		userRepository.save(opponent);
	}
}
