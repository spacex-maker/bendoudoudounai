package com.bendoudou.server.music.dto;

public record PlaylistMemberItemResponse(
        long userId,
        String label,
        String role
) {}
