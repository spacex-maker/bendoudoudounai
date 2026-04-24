package com.bendoudou.server.auth.dto;

public record MeResponse(
        long id,
        String email,
        String displayName,
        boolean hasAvatar,
        String role
) {}
