package com.bendoudou.server.music.dto;

public record CosUploadTicketResponse(
        String tmpSecretId,
        String tmpSecretKey,
        String sessionToken,
        long startTime,
        long expiredTime,
        String bucket,
        String region,
        String host,
        String audioObjectKey,
        String lyricsObjectKey,
        String coverObjectKey
) {}
