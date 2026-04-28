package com.bendoudou.server.user.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * 管理端部分更新用户；未出现的字段表示不修改。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AdminUserPatchRequest(
        String displayName,
        String gender,
        String role,
        Boolean enabled,
        /** 管理员为其他用户设置新密码时传入；6 位以上，不能用于修改自己的密码 */
        String newPassword
) {}
