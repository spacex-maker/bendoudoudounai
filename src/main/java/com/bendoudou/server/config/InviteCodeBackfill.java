package com.bendoudou.server.config;

import com.bendoudou.server.user.User;
import com.bendoudou.server.user.UserRepository;
import com.bendoudou.server.user.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/** 为历史用户补发邀请码 */
@Component
public class InviteCodeBackfill implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(InviteCodeBackfill.class);

    private final UserRepository userRepository;
    private final UserService userService;

    public InviteCodeBackfill(UserRepository userRepository, UserService userService) {
        this.userRepository = userRepository;
        this.userService = userService;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<User> missing = userRepository.findByInviteCodeIsNull();
        if (missing.isEmpty()) return;
        int n = 0;
        for (User u : missing) {
            userService.ensureInviteCode(u);
            n++;
        }
        log.info("Backfilled invite codes for {} users", n);
    }
}
