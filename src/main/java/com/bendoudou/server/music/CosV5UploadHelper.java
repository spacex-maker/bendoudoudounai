package com.bendoudou.server.music;

import com.qcloud.cos.COSClient;
import com.qcloud.cos.ClientConfig;
import com.qcloud.cos.auth.BasicCOSCredentials;
import com.qcloud.cos.auth.COSStaticCredentialsProvider;
import com.qcloud.cos.model.ObjectMetadata;
import com.qcloud.cos.region.Region;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * 不交给 Spring 扫描/反射的纯工具类。COS SDK 仅在此类加载时才进入 JVM，
 * 避免 AutowiredAnnotationBeanPostProcessor 在启动阶段解析到 {@code COSCredentials} 而类路径异常时整应用起不来。
 */
public final class CosV5UploadHelper {

    private CosV5UploadHelper() {
    }

    public static void putObject(
            String secretId,
            String secretKey,
            String region,
            String bucket,
            String objectKey,
            Path file,
            long contentLength,
            String contentType
    ) throws IOException {
        try (InputStream in = Files.newInputStream(file)) {
            putStream(secretId, secretKey, region, bucket, objectKey, in, contentLength, contentType);
        }
    }

    private static void putStream(
            String secretId,
            String secretKey,
            String region,
            String bucket,
            String key,
            InputStream in,
            long contentLength,
            String contentType
    ) {
        ClientConfig config = new ClientConfig(new Region(region));
        COSClient client = new COSClient(
                new COSStaticCredentialsProvider(
                        new BasicCOSCredentials(secretId, secretKey)
                ),
                config
        );
        try {
            ObjectMetadata meta = new ObjectMetadata();
            meta.setContentLength(contentLength);
            if (contentType != null && !contentType.isBlank()) {
                meta.setContentType(contentType);
            } else {
                meta.setContentType("application/octet-stream");
            }
            client.putObject(bucket, key, in, meta);
        } finally {
            client.shutdown();
        }
    }
}
