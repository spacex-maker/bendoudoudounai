package com.bendoudou.server.activity.dto;

public record UserActivityEventResponse(
        long id,
        String action,
        String scope,
        String query,
        String targetType,
        Long targetId,
        String detailJson,
        long createdAtMillis
) {}
