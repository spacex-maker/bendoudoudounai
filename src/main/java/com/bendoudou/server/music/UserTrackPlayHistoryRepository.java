package com.bendoudou.server.music;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserTrackPlayHistoryRepository extends JpaRepository<UserTrackPlayHistory, Long> {

    List<UserTrackPlayHistory> findTop200ByUserIdOrderByPlayedAtDesc(long userId);

    void deleteByTrackId(long trackId);
}

