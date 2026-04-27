package com.bendoudou.server.user.application.dto;

import jakarta.annotation.Nullable;

public record DeveloperApplicationItem(
        long id,
        long userId,
        String userLabel,
        String userEmail,
        @Nullable
        String message,
        String status,
        long createdAtMillis,
        @Nullable
        Long resolvedAtMillis,
        @Nullable
        String resolutionNote
) {}
