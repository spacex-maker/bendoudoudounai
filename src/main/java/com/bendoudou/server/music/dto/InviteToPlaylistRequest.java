package com.bendoudou.server.music.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record InviteToPlaylistRequest(
        @NotNull Long playlistId,
        @NotBlank @Email String inviteeEmail
) {}
