package com.bendoudou.server.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    Optional<User> findByInviteCode(String inviteCode);

    boolean existsByInviteCode(String inviteCode);

    List<User> findByInviteCodeIsNull();

    Optional<User> findFirstByInvitedByUserId(Long invitedByUserId);
}
