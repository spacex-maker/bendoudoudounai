package com.bendoudou.server.music;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlaylistInvitationRepository extends JpaRepository<PlaylistInvitation, Long> {
    List<PlaylistInvitation> findByInviteeIdAndStatusOrderByCreatedAtDesc(long inviteeId, PlaylistInvitationStatus status);

    List<PlaylistInvitation> findByInviterIdOrderByCreatedAtDesc(long inviterId);

    Optional<PlaylistInvitation> findByIdAndInviteeId(long id, long inviteeId);

    Optional<PlaylistInvitation> findByPlaylistIdAndInviteeIdAndStatus(
            long playlistId, long inviteeId, PlaylistInvitationStatus status
    );

    List<PlaylistInvitation> findByPlaylistIdAndStatusOrderByCreatedAtDesc(
            long playlistId, PlaylistInvitationStatus status
    );

    void deleteByPlaylistId(long playlistId);
}
