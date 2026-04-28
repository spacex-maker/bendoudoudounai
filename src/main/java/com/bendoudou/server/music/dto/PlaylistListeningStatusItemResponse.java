package com.bendoudou.server.music.dto;

public record PlaylistListeningStatusItemResponse(
        long trackId,
        long userId,
        String userLabel,
        long updatedAtMillis
) {}
