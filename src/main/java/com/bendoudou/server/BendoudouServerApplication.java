package com.bendoudou.server;

import com.bendoudou.server.music.CosProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(CosProperties.class)
public class BendoudouServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(BendoudouServerApplication.class, args);
    }
}
