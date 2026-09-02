package com.bendoudou.server.auth.dto;

import java.util.List;

public record MeResponse(
        long id,
        String email,
        String displayName,
        boolean hasAvatar,
        String role,
        List<String> roles,
        String gender,
        long beanBalance,
        String beanLevelCode,
        String beanLevelName,
        /** 一枚未使用邀请码（兼容旧前端；完整列表见 /api/users/me/invites） */
        String inviteCode,
        /** 是否已无可用邀请码 */
        boolean inviteCodeUsed,
        /** 最近一次成功邀请的被邀请人展示名 */
        String inviteeLabel,
        long inviteTotalCount,
        long inviteUnusedCount
) {}
