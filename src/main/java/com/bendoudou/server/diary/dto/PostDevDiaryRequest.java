package com.bendoudou.server.diary.dto;

import jakarta.annotation.Nullable;
import jakarta.validation.constraints.NotBlank;

public record PostDevDiaryRequest(
        @NotBlank String title,
        @Nullable
        String bodyMd
) {}
