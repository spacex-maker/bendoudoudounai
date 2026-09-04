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
        long playCount,
        /** 当前登录用户是否已红心 */
        boolean hearted,
        /**
         * 实际入库音质：standard / higher / exhigh / lossless / hires；非网易云导入可为空。
         */
        String audioQuality,
        String translatedLyricsUrl,
        boolean hasTranslatedLyrics,
        String romaLyricsUrl,
        boolean hasRomaLyrics,
        String yrcLyricsUrl,
        boolean hasYrcLyrics,
        Long neteaseSongId,
        Long albumId,
        String artistsJson,
        String titleAlias,
        String titleTranslated,
        String albumArtist,
        Integer releaseYear,
        /** 网易云详情原始 JSON；体积较大，列表也会返回（小站可接受） */
        String sourceDetailJson
) {}
