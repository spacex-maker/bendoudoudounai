package com.bendoudou.server.music.dto;

public record PlayHistoryItemResponse(
        long historyId,
        long playedAtMillis,
        MusicTrackResponse track
) {}
