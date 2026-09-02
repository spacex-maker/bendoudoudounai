package com.bendoudou.server.user.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record GenerateInviteCodesRequest(
        @NotNull @Min(1) @Max(50) Integer count
) {}
