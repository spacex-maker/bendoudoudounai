package com.bendoudou.server.music;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Set;

public interface UserTrackHeartRepository extends JpaRepository<UserTrackHeart, Long> {

    boolean existsByUserIdAndTrackId(long userId, long trackId);

    void deleteByUserIdAndTrackId(long userId, long trackId);

    void deleteByTrackId(long trackId);

    List<UserTrackHeart> findByUserIdOrderByCreatedAtDesc(long userId);

    @Query("select h.trackId from UserTrackHeart h where h.userId = :userId and h.trackId in :ids")
    Set<Long> findTrackIdsByUserIdAndTrackIdIn(@Param("userId") long userId, @Param("ids") Collection<Long> ids);
}
