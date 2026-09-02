package com.bendoudou.server.music.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record ImportNeteaseTrackRequest(
        @Min(1) long neteaseSongId,
        Long playlistId,
        /** true：导入后加入「我喜欢的音乐」 */
        Boolean heart,
        /**
         * 期望音质：standard / higher / exhigh / lossless / hires。
         * 不可用时自动降级。
         */
        @Size(max = 32) String quality
) {}
