package com.bendoudou.server.music.dto;

import java.util.List;

public record PlaylistListeningStatusResponse(
        List<PlaylistListeningStatusItemResponse> items
) {}
