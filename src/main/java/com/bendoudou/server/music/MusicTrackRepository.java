package com.bendoudou.server.music;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MusicTrackRepository extends JpaRepository<MusicTrack, Long> {
    Optional<MusicTrack> findFirstByFileSha256OrderByIdAsc(String fileSha256);

    List<MusicTrack> findByFileSha256(String fileSha256);

    Optional<MusicTrack> findFirstByNoteOrderByIdAsc(String note);

    Optional<MusicTrack> findFirstByUserIdAndNoteOrderByIdAsc(long userId, String note);

    Optional<MusicTrack> findFirstByPlaylistIdAndNoteOrderByIdAsc(long playlistId, String note);

    Optional<MusicTrack> findFirstByPlaylistIdAndFileSha256OrderByIdAsc(long playlistId, String fileSha256);

    List<MusicTrack> findByUserIdAndPlaylistIdOrderByCreatedAtDesc(long userId, long playlistId);

    List<MusicTrack> findByPlaylistIdOrderByCreatedAtDesc(long playlistId);

    List<MusicTrack> findByPlaylistId(long playlistId);

    long countByUserIdAndPlaylistId(long userId, long playlistId);

    long countByPlaylistId(long playlistId);

    @Query("SELECT COALESCE(SUM(m.playCount), 0) FROM MusicTrack m WHERE m.playlistId = :playlistId")
    long sumPlayCountByPlaylistId(@Param("playlistId") long playlistId);

    long countByFileSha256(String fileSha256);

    /** 当前用户已红心、且 note 为网易云导入标记的曲目 note 列表 */
    @Query("""
            select t.note from MusicTrack t, UserTrackHeart h
            where h.userId = :userId and h.trackId = t.id
              and t.note is not null and t.note like 'netease:%'
            """)
    List<String> findHeartedNeteaseNotesByUserId(@Param("userId") long userId);
}
