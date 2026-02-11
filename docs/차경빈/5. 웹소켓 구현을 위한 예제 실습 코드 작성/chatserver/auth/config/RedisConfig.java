package com.example.chatserver.auth.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;

import java.time.Duration;

public class RedisConfig {

    @Value("${spring.redis.host}")
    private String host;
    @Value("${spring.reids.port}")
    private int port;

    // 기본 커넥션 객체
    @Bean
    @Qualifier("chatPubSub")
    public RedisConnectionFactory chatPubSubFactory(){
        RedisStandaloneConfiguration redisConfig = new RedisStandaloneConfiguration();
        redisConfig.setHostName(host);
        redisConfig.setPort(port);
        LettuceClientConfiguration clientConfig =
                LettuceClientConfiguration.builder()
                        .commandTimeout(Duration.ofSeconds(1))
                        .shutdownTimeout(Duration.ZERO)
                        .build();

        // redis pub/sub는 특정 데이터베이스에 의존적이지 않음
        // 설정해두면 커넥션 객체별로 db 연결 가능
//        configuration.setDatabase(0);
        return new LettuceConnectionFactory(redisConfig, clientConfig);
    }


//    // publish객체
//    // 일반적으로 RedisTemplate<키데이터타입, 밸류데이터타입> 사용
//    @Bean
//    @Qualifier("chatPubSub")
//    public StringRedisTemplate stringRedisTemplate(@Qualifier("chatPubSub") RedisConnectionFactory redisConnectionFactory){
//        return new StringRedisTemplate(redisConnectionFactory);
//    }
//
//    // subscribe객체
//    @Bean
//    @Qualifier("chatPubSub")
//    public RedisMessageListenerContainer redisMessageListenerContainer(@Qualifier("chatPubSub") RedisConnectionFactory redisConnectionFactory, MessageListenerAdapter messageListenerAdapter){
//        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
//        container.setConnectionFactory(redisConnectionFactory);
//        container.addMessageListener(messageListenerAdapter, new PatternTopic("chat"));
//        return container;
//    }
//
//    // redis에서 수신된 메세지를 처리하는 객체 생성
//    @Bean
//    public MessageListenerAdapter messageListenerAdapter(RedisPubSubService redisPubSubService){
//        // RedisPubSub의 특정 메서드가 수신된 메세지를 처리할 수 있도록 지정
//        return new MessageListenerAdapter(redisPubSubService, "onMessage");
//    }

}
