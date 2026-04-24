package com.bendoudou.server.music;

/**
 * 统一从项目常量读取 COS 密钥。
 */
public final class CosSecretResolver {

    private CosSecretResolver() {
    }

    public static String resolveSecretId(CosProperties props) {
        return LocalCosSecrets.SECRET_ID;
    }

    public static String resolveSecretKey(CosProperties props) {
        return LocalCosSecrets.SECRET_KEY;
    }
}
