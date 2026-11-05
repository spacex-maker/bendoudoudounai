package com.bendoudou.server.moments.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateMomentUploadTicketRequest(
        @NotBlank @Size(max = 16) String ext,
        @Size(max = 128) String contentType
) {}
