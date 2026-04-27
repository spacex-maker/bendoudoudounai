package com.bendoudou.server.auth.dto;

import java.util.List;

public record MeResponse(
        long id,
        String email,
        String displayName,
        boolean hasAvatar,
        String role,
        List<String> roles
) {}
