package com.bendoudou.server.auth.dto;

import java.util.List;

public record AuthResponse(
        String token,
        String email,
        String displayName,
        String role,
        List<String> roles
) {}
