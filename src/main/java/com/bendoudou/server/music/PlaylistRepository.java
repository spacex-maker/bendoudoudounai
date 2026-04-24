package com.bendoudou.server.music;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PlaylistRepository extends JpaRepository<Playlist, Long> {
    Optional<Playlist> findByUserIdAndDefaultPlaylistTrue(long userId);
}
