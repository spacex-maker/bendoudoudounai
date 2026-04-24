package com.bendoudou.server.music.dto;

public record MusicTrackResponse(
        long id,
        long playlistId,
        String title,
        String artist,
        String album,
        String note,
        int durationSeconds,
        String originalFilename,
        boolean metadataFromFile,
        long createdAtMillis,
        String audioUrl,
        String lyricsUrl,
        boolean hasLyrics,
        String coverUrl,
        boolean hasCover,
        long playCount
) {}
