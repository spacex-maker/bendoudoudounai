package com.bendoudou.server.music;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface PlaylistRepository extends JpaRepository<Playlist, Long> {
    Optional<Playlist> findByUserIdAndDefaultPlaylistTrue(long userId);

    Optional<Playlist> findFirstByMomentsFeaturedTrue();

    @Modifying
    @Query("update Playlist p set p.momentsFeatured = false where p.momentsFeatured = true")
    int clearMomentsFeatured();
}
