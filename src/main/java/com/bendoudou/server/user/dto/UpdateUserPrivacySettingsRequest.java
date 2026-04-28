package com.bendoudou.server.user.dto;

public record UpdateUserPrivacySettingsRequest(
        Boolean recordLoginActivity,
        Boolean recordPlayActivity,
        Boolean publicBeanLevel,
        Boolean publicLastOnline,
        Boolean allowPlaylistInvite
) {
}
