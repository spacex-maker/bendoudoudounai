package com.bendoudou.server.moments.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record CreateMomentPhotoRequest(
        @NotBlank @Size(max = 512) String objectKey,
        Integer width,
        Integer height,
        @Size(max = 200) String caption,
        Instant takenAt,
        @Min(0) @Max(359) Integer dominantHue,
        @Min(0) @Max(100) Integer dominantSat,
        @Min(0) @Max(100) Integer dominantLight,
        @Size(max = 1024) String paletteJson
) {}
