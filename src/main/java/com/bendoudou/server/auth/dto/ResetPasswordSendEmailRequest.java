package com.bendoudou.server.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ResetPasswordSendEmailRequest(
        @NotBlank @Email String email,
        String locale
) {}
