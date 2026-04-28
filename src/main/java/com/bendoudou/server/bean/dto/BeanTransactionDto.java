package com.bendoudou.server.bean.dto;

public record BeanTransactionDto(
    long id,
    long userId,
    String userLabel,
    int delta,
    String reason,
    String actionType,
    Long relatedId,
    long createdAtMillis
) {}
