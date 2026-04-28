package com.bendoudou.server.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserPrivacySettingRepository extends JpaRepository<UserPrivacySetting, Long> {
    Optional<UserPrivacySetting> findByUserId(Long userId);
}
