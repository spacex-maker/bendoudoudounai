package com.bendoudou.server.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "请填写邮箱") @Email(message = "邮箱格式不正确") String email,
        @NotBlank(message = "请填写密码") @Size(min = 6, max = 72, message = "密码至少 6 位") String password,
        @NotBlank(message = "请填写邮箱验证码") @Size(min = 4, max = 16, message = "验证码格式不正确") String code,
        @NotBlank(message = "请填写邀请码") @Size(min = 4, max = 32, message = "邀请码格式不正确") String inviteCode,
        @Size(max = 64, message = "称呼过长") String displayName
) {}
