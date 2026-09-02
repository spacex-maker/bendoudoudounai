package com.bendoudou.server.user.dto;

public record InviteCodeItemResponse(
        long id,
        String code,
        boolean used,
        String source,
        String inviteeLabel,
        String createdAt,
        String usedAt
) {}
