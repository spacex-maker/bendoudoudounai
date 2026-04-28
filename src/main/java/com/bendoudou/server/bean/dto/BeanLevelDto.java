package com.bendoudou.server.bean.dto;

public record BeanLevelDto(
        long id,
        String code,
        String name,
        long minBeans,
        int sortOrder
) {}
