package com.bendoudou.server.moments.dto;

public record MomentUploadTicketResponse(
        String tmpSecretId,
        String tmpSecretKey,
        String sessionToken,
        long startTime,
        long expiredTime,
        String bucket,
        String region,
        String host,
        String objectKey
) {}
