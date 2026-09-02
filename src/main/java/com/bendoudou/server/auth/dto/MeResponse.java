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
        /** 我的邀请码 */
        String inviteCode,
        /** 邀请码是否已被使用（每人仅可邀请一人） */
        boolean inviteCodeUsed,
        /** 若已邀请成功，被邀请人展示名 */
        String inviteeLabel
) {}
