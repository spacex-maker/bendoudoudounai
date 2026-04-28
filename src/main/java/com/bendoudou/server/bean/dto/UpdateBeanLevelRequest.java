package com.bendoudou.server.bean.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateBeanLevelRequest(
        Long id,
        @NotBlank String code,
        @NotBlank String name,
        long minBeans,
        int sortOrder
) {}
