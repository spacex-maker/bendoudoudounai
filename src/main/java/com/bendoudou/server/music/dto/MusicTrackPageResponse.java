package com.bendoudou.server.music.dto;

import java.util.List;

public record MusicTrackPageResponse(
        List<MusicTrackResponse> items,
        int page,
        int size,
        long total,
        boolean hasMore
) {}
