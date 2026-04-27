package com.bendoudou.server.user.application.dto;

import jakarta.annotation.Nullable;

public record ResolutionRequest(
        @Nullable
        String note
) {}
