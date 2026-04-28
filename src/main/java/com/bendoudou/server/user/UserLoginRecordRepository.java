package com.bendoudou.server.user;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserLoginRecordRepository extends JpaRepository<UserLoginRecord, Long> {
}
