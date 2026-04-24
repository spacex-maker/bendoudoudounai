package com.bendoudou.server.music;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MusicTrackRepository extends JpaRepository<MusicTrack, Long> {
    Optional<MusicTrack> findFirstByFileSha256OrderByIdAsc(String fileSha256);

    List<MusicTrack> findByFileSha256(String fileSha256);

    List<MusicTrack> findByUserIdAndPlaylistIdOrderByCreatedAtDesc(long userId, long playlistId);

    List<MusicTrack> findByPlaylistIdOrderByCreatedAtDesc(long playlistId);

    long countByUserIdAndPlaylistId(long userId, long playlistId);

    long countByPlaylistId(long playlistId);

    @Query("SELECT COALESCE(SUM(m.playCount), 0) FROM MusicTrack m WHERE m.playlistId = :playlistId")
    long sumPlayCountByPlaylistId(@Param("playlistId") long playlistId);
}
