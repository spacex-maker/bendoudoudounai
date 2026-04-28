package com.bendoudou.server.music.dto;

public record UpdatePlaylistListeningStateRequest(
        Long trackId,
        boolean playing
) {}
