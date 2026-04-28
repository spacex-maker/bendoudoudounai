package com.bendoudou.server.bean;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserBeanAccountRepository extends JpaRepository<UserBeanAccount, Long> {
    Optional<UserBeanAccount> findByUserId(Long userId);
}
