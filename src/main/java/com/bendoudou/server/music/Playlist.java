package com.bendoudou.server.music;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "playlists")
public class Playlist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(name = "is_default", nullable = false)
    private boolean defaultPlaylist = false;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    /** 外链或 COS 公网地址（本地上传成功后也会写入 COS URL） */
    @Column(name = "wallpaper_remote_url", length = 2048)
    private String wallpaperRemoteUrl;

    /** 无 COS 时壁纸相对 music-upload-dir，如 playlist-wallpapers/12.jpg */
    @Column(name = "wallpaper_stored_relpath", length = 1024)
    private String wallpaperStoredRelpath;

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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public boolean isDefaultPlaylist() {
        return defaultPlaylist;
    }

    public void setDefaultPlaylist(boolean defaultPlaylist) {
        this.defaultPlaylist = defaultPlaylist;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getWallpaperRemoteUrl() {
        return wallpaperRemoteUrl;
    }

    public void setWallpaperRemoteUrl(String wallpaperRemoteUrl) {
        this.wallpaperRemoteUrl = wallpaperRemoteUrl;
    }

    public String getWallpaperStoredRelpath() {
        return wallpaperStoredRelpath;
    }

    public void setWallpaperStoredRelpath(String wallpaperStoredRelpath) {
        this.wallpaperStoredRelpath = wallpaperStoredRelpath;
    }
}
