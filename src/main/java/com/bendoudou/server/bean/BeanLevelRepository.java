package com.bendoudou.server.bean;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BeanLevelRepository extends JpaRepository<BeanLevel, Long> {
    List<BeanLevel> findAllByOrderByMinBeansAsc();
}
