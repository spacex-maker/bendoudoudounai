package com.bendoudou.server.music;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 腾讯云 COS，与 productx 侧 bucket/区域一致时可共用同一套 AK/SK（通过环境变量注入，勿将密钥提交到仓库）。
 */
@ConfigurationProperties(prefix = "bendoudou.cos")
public class CosProperties {

    private boolean enabled = true;

    /** 主账号 SecretId */
    private String secretId = "";

    /** 主账号 SecretKey */
    private String secretKey = "";

    private String bucket = "px-1258150206";

    private String region = "ap-nanjing";

    /**
     * 本应用在桶内的根前缀，下挂 songs/、lyrics/ 子目录。勿以 / 开头，建议以 / 结尾。
     */
    private String pathPrefix = "bendoudou/music/";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getSecretId() {
        return secretId;
    }

    public void setSecretId(String secretId) {
        this.secretId = secretId;
    }

    public String getSecretKey() {
        return secretKey;
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }

    public String getBucket() {
        return bucket;
    }

    public void setBucket(String bucket) {
        this.bucket = bucket;
    }

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }

    public String getPathPrefix() {
        return pathPrefix;
    }

    public void setPathPrefix(String pathPrefix) {
        this.pathPrefix = pathPrefix;
    }
}
