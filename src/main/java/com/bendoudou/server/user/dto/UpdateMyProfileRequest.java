package com.bendoudou.server.user.dto;

public record UpdateMyProfileRequest(
        String displayName,
        String gender
) {}
