package com.bendoudou.server.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * 管理端创建用户：登录邮箱、展示昵称（可选）、角色（可选，缺省 USER）；密码在创建时填写。未传密码时由服务端生成随机值。
 */
public record AdminUserCreateRequest(
        @NotBlank(message = "请填写邮箱")
        @Email(message = "邮箱格式无效")
        String email,
        /** 可空，空串与缺省由服务端在创建时处理 */
        String password,
        /** 可空，空串视为无昵称 */
        String displayName,
        /** 可空；未传时默认 USER。USER | ADMIN */
        String role
) {}
