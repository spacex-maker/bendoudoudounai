package com.bendoudou.server.music.dto;

public record DiscoverSearchItemResponse(
        long neteaseSongId,
        String title,
        String artist,
        String album,
        int durationSeconds,
        String coverUrl,
        /** 当前用户是否已将该网易云曲红心收藏 */
        boolean hearted
) {}
