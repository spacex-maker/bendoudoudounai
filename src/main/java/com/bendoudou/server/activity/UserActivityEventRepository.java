package com.bendoudou.server.activity;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserActivityEventRepository extends JpaRepository<UserActivityEvent, Long> {

    List<UserActivityEvent> findByUserIdOrderByCreatedAtDesc(long userId, Pageable pageable);

    List<UserActivityEvent> findByUserIdAndActionOrderByCreatedAtDesc(
            long userId, String action, Pageable pageable
    );
}
