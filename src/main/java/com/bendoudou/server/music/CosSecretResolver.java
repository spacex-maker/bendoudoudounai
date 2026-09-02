package com.bendoudou.server.music;

/**
 * 从 {@link CosProperties}（application.yml / 环境变量）读取 COS 密钥。
 */
public final class CosSecretResolver {

    private CosSecretResolver() {
    }

    public static String resolveSecretId(CosProperties props) {
        return props.getSecretId();
    }

    public static String resolveSecretKey(CosProperties props) {
        return props.getSecretKey();
    }
}
