package com.bendoudou.server.music;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserTrackPlayHistoryRepository extends JpaRepository<UserTrackPlayHistory, Long> {

    List<UserTrackPlayHistory> findTop200ByUserIdOrderByPlayedAtDesc(long userId);

    @Query("""
            select h from UserTrackPlayHistory h
            where h.userId = :userId
              and exists (
                select 1 from MusicTrack t, PlaylistMember m
                where t.id = h.trackId
                  and m.playlistId = t.playlistId
                  and m.userId = :userId
              )
            order by h.playedAt desc
            """)
    Page<UserTrackPlayHistory> findAccessibleByUserId(@Param("userId") long userId, Pageable pageable);

    @Query("""
            select h.userId as userId, count(h.id) as playCount
            from UserTrackPlayHistory h
            where h.trackId = :trackId
            group by h.userId
            order by count(h.id) desc
            """)
    List<TrackUserPlayCountView> countByTrackGroupedByUser(@Param("trackId") long trackId);

    void deleteByTrackId(long trackId);

    interface TrackUserPlayCountView {
        Long getUserId();

        long getPlayCount();
    }
}

