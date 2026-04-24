package com.bendoudou.server.config;

import com.bendoudou.server.music.Playlist;
import com.bendoudou.server.music.PlaylistMember;
import com.bendoudou.server.music.PlaylistMemberRepository;
import com.bendoudou.server.music.PlaylistMemberRole;
import com.bendoudou.server.music.PlaylistRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 历史数据：旧版歌单无成员表，把「拥有者」补为 OWNER 成员，避免无法访问歌单。
 */
@Component
@Order(20)
public class PlaylistMembershipBackfill implements ApplicationRunner {

    private final PlaylistRepository playlistRepository;
    private final PlaylistMemberRepository playlistMemberRepository;

    public PlaylistMembershipBackfill(
            PlaylistRepository playlistRepository,
            PlaylistMemberRepository playlistMemberRepository
    ) {
        this.playlistRepository = playlistRepository;
        this.playlistMemberRepository = playlistMemberRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Playlist> all = playlistRepository.findAll();
        for (Playlist p : all) {
            if (!playlistMemberRepository.existsByPlaylistIdAndUserId(p.getId(), p.getUserId())) {
                PlaylistMember m = new PlaylistMember();
                m.setPlaylistId(p.getId());
                m.setUserId(p.getUserId());
                m.setRole(PlaylistMemberRole.OWNER);
                playlistMemberRepository.save(m);
            }
        }
    }
}
