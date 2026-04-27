package com.bendoudou.server.diary.dto;

import jakarta.annotation.Nullable;

public record PatchDevDiaryRequest(
        @Nullable
        String title,
        @Nullable
        String bodyMd
) {}
