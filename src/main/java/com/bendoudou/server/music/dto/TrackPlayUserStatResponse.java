package com.bendoudou.server.music.dto;

public record TrackPlayUserStatResponse(
        long userId,
        String userLabel,
        long playCount
) {}
