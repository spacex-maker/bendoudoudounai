package com.bendoudou.server.music.netease;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "bendoudou.netease")
public class NeteaseProperties {

    private String musicU = "";
    private String csrf = "";
    private String userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

    public String getMusicU() {
        return musicU;
    }

    public void setMusicU(String musicU) {
        this.musicU = musicU;
    }

    public String getCsrf() {
        return csrf;
    }

    public void setCsrf(String csrf) {
        this.csrf = csrf;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public boolean isConfigured() {
        return musicU != null && !musicU.isBlank();
    }
}
