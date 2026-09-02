package com.bendoudou.server.activity.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RecordActivityRequest(
        @NotBlank @Size(max = 64) String action,
        @Size(max = 32) String scope,
        @Size(max = 512) String query,
        @Size(max = 32) String targetType,
        Long targetId,
        /** 任意 JSON 字符串；过长会截断 */
        @Size(max = 8000) String detailJson
) {}
