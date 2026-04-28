package com.bendoudou.server.music;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface PlaylistListeningStatusRepository extends JpaRepository<PlaylistListeningStatus, Long> {
    Optional<PlaylistListeningStatus> findByPlaylistIdAndUserId(long playlistId, long userId);

    List<PlaylistListeningStatus> findByPlaylistIdAndUpdatedAtAfter(long playlistId, Instant updatedAt);

    void deleteByPlaylistIdAndUserId(long playlistId, long userId);

    @Modifying
    @Query(
            value = """
                    insert into playlist_listening_status (playlist_id, user_id, track_id, updated_at)
                    values (:playlistId, :userId, :trackId, :updatedAt)
                    on duplicate key update
                      track_id = values(track_id),
                      updated_at = values(updated_at)
                    """,
            nativeQuery = true
    )
    void upsertListeningStatus(
            @Param("playlistId") long playlistId,
            @Param("userId") long userId,
            @Param("trackId") long trackId,
            @Param("updatedAt") Instant updatedAt
    );
}
