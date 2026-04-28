package com.bendoudou.server.user;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "user_privacy_setting")
public class UserPrivacySetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "record_login_activity", nullable = false)
    private boolean recordLoginActivity = true;

    @Column(name = "record_play_activity", nullable = false)
    private boolean recordPlayActivity = true;

    @Column(name = "public_bean_level", nullable = false)
    private boolean publicBeanLevel = false;

    @Column(name = "public_last_online", nullable = false)
    private boolean publicLastOnline = false;

    @Column(name = "allow_playlist_invite", nullable = false)
    private boolean allowPlaylistInvite = false;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public boolean isRecordLoginActivity() {
        return recordLoginActivity;
    }

    public void setRecordLoginActivity(boolean recordLoginActivity) {
        this.recordLoginActivity = recordLoginActivity;
    }

    public boolean isRecordPlayActivity() {
        return recordPlayActivity;
    }

    public void setRecordPlayActivity(boolean recordPlayActivity) {
        this.recordPlayActivity = recordPlayActivity;
    }

    public boolean isPublicBeanLevel() {
        return publicBeanLevel;
    }

    public void setPublicBeanLevel(boolean publicBeanLevel) {
        this.publicBeanLevel = publicBeanLevel;
    }

    public boolean isPublicLastOnline() {
        return publicLastOnline;
    }

    public void setPublicLastOnline(boolean publicLastOnline) {
        this.publicLastOnline = publicLastOnline;
    }

    public boolean isAllowPlaylistInvite() {
        return allowPlaylistInvite;
    }

    public void setAllowPlaylistInvite(boolean allowPlaylistInvite) {
        this.allowPlaylistInvite = allowPlaylistInvite;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
