package com.bendoudou.server.bean.dto;

public record BeanBalanceResponse(
        long balance,
        String levelCode,
        String levelName,
        Long nextLevelMinBeans
) {}
