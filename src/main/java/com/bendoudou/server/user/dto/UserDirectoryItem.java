package com.bendoudou.server.user.dto;

/**
 * 留言板等场景：选择可见对象时展示站内用户（需登录后拉取）。
 */
public record UserDirectoryItem(
        long id,
        String label,
        String email,
        boolean hasAvatar,
        /** USER 或 ADMIN */
        String role
) {}
