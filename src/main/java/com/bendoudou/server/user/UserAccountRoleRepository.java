package com.bendoudou.server.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserAccountRoleRepository extends JpaRepository<UserAccountRole, Long> {

    List<UserAccountRole> findByUserId(long userId);

    boolean existsByUserIdAndRole(long userId, UserRole role);

    void deleteByUserIdAndRoleIn(long userId, List<UserRole> roles);

    void deleteByUserIdAndRole(long userId, UserRole role);

    void deleteByUserId(long userId);
}
