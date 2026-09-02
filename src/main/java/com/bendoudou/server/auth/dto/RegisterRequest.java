package com.bendoudou.server.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(min = 6, max = 72) String password,
        @NotBlank @Size(min = 4, max = 16) String code,
        @NotBlank @Size(min = 4, max = 32) String inviteCode,
        @Size(max = 64) String displayName
) {}
