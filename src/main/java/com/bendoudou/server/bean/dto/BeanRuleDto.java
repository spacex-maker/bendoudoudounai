package com.bendoudou.server.bean.dto;

public record BeanRuleDto(
        String actionType,
        int beanDelta,
        boolean enabled
) {}
