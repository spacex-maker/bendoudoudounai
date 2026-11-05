package com.bendoudou.server.moments.dto;

import java.time.Instant;

public record MomentPhotoResponse(
        long id,
        String objectKey,
        String publicUrl,
        String thumbUrl,
        String largeUrl,
        Integer width,
        Integer height,
        String caption,
        Instant takenAt,
        long sortOrder,
        Instant createdAt,
        Integer dominantHue,
        Integer dominantSat,
        Integer dominantLight,
        String paletteJson
) {}
