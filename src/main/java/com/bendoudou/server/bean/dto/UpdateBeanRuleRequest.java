package com.bendoudou.server.bean.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateBeanRuleRequest(
        @NotBlank String actionType,
        int beanDelta,
        boolean enabled
) {}
