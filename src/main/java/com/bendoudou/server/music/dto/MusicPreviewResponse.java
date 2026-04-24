package com.bendoudou.server.music.dto;

public record MusicPreviewResponse(
        String title,
        String artist,
        String album,
        int durationSeconds,
        String originalFilename,
        boolean fileHadEmbeddedOrParsed
) {}
