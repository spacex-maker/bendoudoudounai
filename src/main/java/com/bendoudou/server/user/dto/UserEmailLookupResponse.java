package com.bendoudou.server.user.dto;

/**
 * 精确邮箱查找：仅用于歌单邀请等需确认对方已注册的场景。
 */
public record UserEmailLookupResponse(
        boolean exists,
        /** 存在时为展示名（无昵称则回落邮箱） */
        String label,
        String email
) {}
