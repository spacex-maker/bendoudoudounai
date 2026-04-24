package com.bendoudou.server.music;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlaylistMemberRepository extends JpaRepository<PlaylistMember, Long> {

    List<PlaylistMember> findByPlaylistId(long playlistId);

    List<PlaylistMember> findByUserIdOrderByPlaylistIdDesc(long userId);

    boolean existsByPlaylistIdAndUserId(long playlistId, long userId);

    Optional<PlaylistMember> findByPlaylistIdAndUserId(long playlistId, long userId);

    long countByPlaylistId(long playlistId);

    void deleteByPlaylistId(long playlistId);
}
