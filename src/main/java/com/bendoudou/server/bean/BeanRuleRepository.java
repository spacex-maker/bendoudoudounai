package com.bendoudou.server.bean;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BeanRuleRepository extends JpaRepository<BeanRule, Long> {
    Optional<BeanRule> findByActionType(BeanActionType actionType);
}
