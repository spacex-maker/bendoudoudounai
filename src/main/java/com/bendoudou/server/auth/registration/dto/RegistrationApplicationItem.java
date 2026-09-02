package com.bendoudou.server.auth.registration.dto;

public record RegistrationApplicationItem(
        long id,
        String email,
        String displayName,
        String message,
        String status,
        long createdAt,
        Long resolvedAt,
        String resolutionNote
) {}
