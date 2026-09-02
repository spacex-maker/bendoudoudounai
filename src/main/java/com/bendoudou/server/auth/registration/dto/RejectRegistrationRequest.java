package com.bendoudou.server.auth.registration.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RejectRegistrationRequest(
        @NotBlank @Size(max = 1000) String reason
) {}
