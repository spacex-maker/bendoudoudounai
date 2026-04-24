package com.bendoudou.server.auth.dto;

public record AuthResponse(
        String token,
        String email,
        String displayName,
        String role
) {}
