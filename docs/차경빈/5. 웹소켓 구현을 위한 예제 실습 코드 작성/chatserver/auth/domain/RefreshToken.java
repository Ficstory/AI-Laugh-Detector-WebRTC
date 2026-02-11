package com.example.chatserver.auth.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.redis.core.RedisHash;
import org.springframework.data.redis.core.TimeToLive;
import org.springframework.data.redis.core.index.Indexed;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@RedisHash(value = "refreshToken", timeToLive = 60*60*24*14)
@Builder
public class RefreshToken {
    @Id
    @Indexed
    private String refreshToken;

    private String key;

    @Builder.Default
    @TimeToLive
    private Long ttl = 1000L*60*60*24*14;

}
