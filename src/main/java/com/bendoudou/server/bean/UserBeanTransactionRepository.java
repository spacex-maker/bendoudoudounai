package com.bendoudou.server.bean;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserBeanTransactionRepository extends JpaRepository<UserBeanTransaction, Long> {
    Page<UserBeanTransaction> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    Page<UserBeanTransaction> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
