package com.bendoudou.server.music.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdatePlaylistNameRequest(
        @NotBlank @Size(max = 128) String name
) {}
