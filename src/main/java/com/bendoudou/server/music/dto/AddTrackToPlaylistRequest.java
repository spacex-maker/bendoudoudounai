package com.bendoudou.server.music.dto;

import jakarta.validation.constraints.NotNull;

public record AddTrackToPlaylistRequest(
        @NotNull Long playlistId
) {}
