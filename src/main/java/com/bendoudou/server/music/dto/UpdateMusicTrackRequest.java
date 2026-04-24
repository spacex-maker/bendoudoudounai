package com.bendoudou.server.music.dto;

import jakarta.validation.constraints.Size;

public record UpdateMusicTrackRequest(
        @Size(max = 512) String title,
        @Size(max = 512) String artist,
        @Size(max = 512) String album,
        @Size(max = 2000) String note
) {}
