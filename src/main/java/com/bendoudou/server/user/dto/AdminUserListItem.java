package com.bendoudou.server.user.dto;

import java.util.List;

/**
 * 管理后台：用户列表行（无敏感字段）。
 */
public record AdminUserListItem(
        long id,
        String email,
        String displayName,
        String gender,
        /** 展示用主角色，兼容旧字段 */
        String role,
        /** 当前已授予的全部角色 */
        List<String> roles,
        boolean hasAvatar,
        long createdAtMillis,
        boolean enabled
) {}
