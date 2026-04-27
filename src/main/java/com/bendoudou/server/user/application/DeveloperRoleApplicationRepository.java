package com.bendoudou.server.user.application;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeveloperRoleApplicationRepository extends JpaRepository<DeveloperRoleApplication, Long> {

    List<DeveloperRoleApplication> findByStatusOrderByCreatedAtAsc(RoleApplicationStatus status);

    List<DeveloperRoleApplication> findByUserIdOrderByCreatedAtDesc(long userId);

    boolean existsByUserIdAndStatus(long userId, RoleApplicationStatus status);
}
