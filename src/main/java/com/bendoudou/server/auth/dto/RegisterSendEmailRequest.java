package com.bendoudou.server.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterSendEmailRequest(
        @NotBlank @Email String email,
        String locale
) {}
