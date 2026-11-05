package com.bendoudou.server;

import com.bendoudou.server.music.CosProperties;
import com.bendoudou.server.music.netease.NeteaseProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties({CosProperties.class, NeteaseProperties.class})
public class BendoudouServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(BendoudouServerApplication.class, args);
    }
}
