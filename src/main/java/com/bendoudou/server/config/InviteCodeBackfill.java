package com.bendoudou.server.config;

import com.bendoudou.server.user.User;
import com.bendoudou.server.user.UserRepository;
import com.bendoudou.server.user.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** 迁移旧 User.invite_code，并为无码用户补发初始邀请码 */
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
    @Transactional
    public void run(ApplicationArguments args) {
        List<User> all = userRepository.findAll();
        int n = 0;
        for (User u : all) {
            userService.ensureInviteCode(u);
            n++;
        }
        log.info("Ensured invite codes for {} users (legacy migrate + initial grant)", n);
    }
}
