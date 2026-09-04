package com.bendoudou.server.music.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateTrackFromCosRequest(
        Long playlistId,
        @NotBlank
        @Pattern(regexp = "^[a-fA-F0-9]{64}$", message = "audioSha256 format invalid")
        String audioSha256,
        @NotBlank
        @Pattern(regexp = "^(mp3|m4a|flac|wav|ogg|aac|rc)$", message = "audioExt unsupported")
        String audioExt,
        @Size(max = 512) String title,
        @Size(max = 512) String artist,
        @Size(max = 512) String album,
        @Size(max = 2000) String note,
        int durationSeconds,
        @Size(max = 512) String originalFilename,
        boolean metadataFromFile,
        long fileSize,
        @Size(max = 128) String mimeType,
        @NotBlank String audioObjectKey,
        String lyricsObjectKey,
        String coverObjectKey,
        /** 翻译歌词 COS key，可空 */
        String translatedLyricsObjectKey,
        /** 罗马音歌词 COS key，可空 */
        String romaLyricsObjectKey,
        /** 逐字 yrc COS key，可空 */
        String yrcLyricsObjectKey,
        @Size(max = 32) String audioQuality,
        Long neteaseSongId,
        Long albumId,
        String artistsJson,
        @Size(max = 1024) String titleAlias,
        @Size(max = 1024) String titleTranslated,
        @Size(max = 512) String albumArtist,
        Integer releaseYear,
        String sourceDetailJson
) {}
