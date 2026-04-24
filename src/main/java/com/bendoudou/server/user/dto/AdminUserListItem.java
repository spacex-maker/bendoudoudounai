package com.bendoudou.server.user.dto;

/**
 * 管理后台：用户列表行（无敏感字段）。
 */
public record AdminUserListItem(
        long id,
        String email,
        String displayName,
        String role,
        boolean hasAvatar,
        long createdAtMillis,
        boolean enabled
) {}
