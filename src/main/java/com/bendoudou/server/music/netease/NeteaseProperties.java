package com.bendoudou.server.music.netease;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

@ConfigurationProperties(prefix = "bendoudou.netease")
public class NeteaseProperties {

    private String musicU = "";
    private String csrf = "";
    private String userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

    /**
     * AIMATEX-MUSIC 内部凭证接口，例如
     * https://music-api.aimatex.com/api/internal/netease/credentials
     */
    private String credentialUrl = "";

    /** 与 music 侧 bendoudou.internal.api-key 一致 */
    private String credentialApiKey = "";

    /**
     * AIMATEX-MUSIC 曲库复用接口；缺省由 credential-url 推导为同路径 /library。
     */
    private String libraryUrl = "";

    /** 本地缓存拉取结果的有效期（默认 10 分钟） */
    private long credentialTtlMs = 600_000L;

    /** 定时同步间隔（默认 5 分钟） */
    private long credentialSyncIntervalMs = 300_000L;

    public String getMusicU() {
        return musicU;
    }

    public void setMusicU(String musicU) {
        this.musicU = musicU == null ? "" : musicU;
    }

    public String getCsrf() {
        return csrf;
    }

    public void setCsrf(String csrf) {
        this.csrf = csrf == null ? "" : csrf;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public String getCredentialUrl() {
        return credentialUrl;
    }

    public void setCredentialUrl(String credentialUrl) {
        this.credentialUrl = credentialUrl == null ? "" : credentialUrl;
    }

    public String getCredentialApiKey() {
        return credentialApiKey;
    }

    public void setCredentialApiKey(String credentialApiKey) {
        this.credentialApiKey = credentialApiKey == null ? "" : credentialApiKey;
    }

    public String getLibraryUrl() {
        return libraryUrl;
    }

    public void setLibraryUrl(String libraryUrl) {
        this.libraryUrl = libraryUrl == null ? "" : libraryUrl;
    }

    public long getCredentialTtlMs() {
        return credentialTtlMs;
    }

    public void setCredentialTtlMs(long credentialTtlMs) {
        this.credentialTtlMs = credentialTtlMs;
    }

    public long getCredentialSyncIntervalMs() {
        return credentialSyncIntervalMs;
    }

    public void setCredentialSyncIntervalMs(long credentialSyncIntervalMs) {
        this.credentialSyncIntervalMs = credentialSyncIntervalMs;
    }

    public boolean isConfigured() {
        return StringUtils.hasText(musicU);
    }

    public boolean isRemoteCredentialConfigured() {
        return StringUtils.hasText(credentialUrl) && StringUtils.hasText(credentialApiKey);
    }
}
