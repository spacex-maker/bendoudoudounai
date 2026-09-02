package com.bendoudou.server.config;

import com.bendoudou.server.music.CosProperties;
import com.bendoudou.server.music.CosSecretResolver;
import com.bendoudou.server.music.netease.NeteaseProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 启动时打印本地/线上关键集成是否就绪，避免「COS 不可用 / 未配置 MUSIC_U」排障猜来猜去。
 */
@Component
@Order(0)
public class IntegrationConfigProbe implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(IntegrationConfigProbe.class);

    private final CosProperties cosProperties;
    private final NeteaseProperties neteaseProperties;

    public IntegrationConfigProbe(CosProperties cosProperties, NeteaseProperties neteaseProperties) {
        this.cosProperties = cosProperties;
        this.neteaseProperties = neteaseProperties;
    }

    @Override
    public void run(ApplicationArguments args) {
        boolean cosOk = cosProperties.isEnabled()
                && StringUtils.hasText(CosSecretResolver.resolveSecretId(cosProperties))
                && StringUtils.hasText(CosSecretResolver.resolveSecretKey(cosProperties))
                && StringUtils.hasText(cosProperties.getBucket())
                && StringUtils.hasText(cosProperties.getRegion());
        boolean neteaseOk = neteaseProperties.isConfigured();
        log.info(
                "Integration config: COS={} (enabled={}, secretId={}, secretKey={}, bucket={}), NetEase MUSIC_U={}",
                cosOk ? "READY" : "MISSING",
                cosProperties.isEnabled(),
                StringUtils.hasText(CosSecretResolver.resolveSecretId(cosProperties)),
                StringUtils.hasText(CosSecretResolver.resolveSecretKey(cosProperties)),
                StringUtils.hasText(cosProperties.getBucket()),
                neteaseOk ? "READY" : "MISSING"
        );
        if (!cosOk) {
            log.warn(
                    "COS 未就绪：请确认仓库根目录存在 secrets/bendoudou.env（无 BOM），"
                            + "含 TENCENTCLOUD_SECRET_ID / TENCENTCLOUD_SECRET_KEY，并从仓库根目录启动。"
                            + "也可运行: py -3 scripts/ensure_local_secrets.py"
            );
        }
        if (!neteaseOk) {
            log.warn(
                    "网易云未就绪：请在 secrets/bendoudou.env 配置 BENDOUDOU_NETEASE_MUSIC_U"
                            + "（及 CSRF），并从仓库根目录启动。可运行: py -3 scripts/ensure_local_secrets.py"
            );
        }
    }
}
