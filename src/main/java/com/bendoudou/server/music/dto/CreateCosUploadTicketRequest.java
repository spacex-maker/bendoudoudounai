package com.bendoudou.server.music.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CreateCosUploadTicketRequest(
        @NotBlank
        @Pattern(regexp = "^[a-fA-F0-9]{64}$", message = "audioSha256")
        String audioSha256,
        @NotBlank
        @Pattern(regexp = "^(mp3|m4a|flac|wav|ogg|aac|rc)$", message = "audioExt")
        String audioExt,
        @Pattern(regexp = "^(lrc|txt|krc|srt)$", message = "lyricsExt")
        String lyricsExt,
        @Pattern(regexp = "^(jpg|jpeg|png|webp)$", message = "coverExt")
        String coverExt
) {}
