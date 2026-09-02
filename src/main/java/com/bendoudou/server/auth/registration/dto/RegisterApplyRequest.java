package com.bendoudou.server.auth.registration.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterApplyRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(min = 6, max = 100) String password,
        @NotBlank @Size(min = 4, max = 16) String code,
        @Size(max = 64) String displayName,
        @Size(max = 1000) String message,
        String locale
) {}
