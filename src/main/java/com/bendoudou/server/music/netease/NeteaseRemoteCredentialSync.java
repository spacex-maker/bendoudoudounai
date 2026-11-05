package com.bendoudou.server.music.netease;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 从 AIMATEX-MUSIC 内部接口同步网易云 Cookie（MUSIC_U / __csrf）。
 * music 侧负责扫码/续期；本站只拉最新值热更新到内存。
 */
@Component
public class NeteaseRemoteCredentialSync {

    private static final Logger log = LoggerFactory.getLogger(NeteaseRemoteCredentialSync.class);

    private final NeteaseProperties props;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final AtomicReference<Instant> lastOkAt = new AtomicReference<>();

    public NeteaseRemoteCredentialSync(NeteaseProperties props, ObjectMapper objectMapper) {
        this.props = props;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /** 发现音乐调用前：缓存过期或未配置时强制拉一次 */
    public synchronized boolean ensureFresh(boolean forceRefreshRemote) {
        if (!props.isRemoteCredentialConfigured()) {
            return props.isConfigured();
        }
        Instant last = lastOkAt.get();
        long ttl = Math.max(30_000L, props.getCredentialTtlMs());
        boolean stale = last == null || last.plusMillis(ttl).isBefore(Instant.now());
        if (!forceRefreshRemote && props.isConfigured() && !stale) {
            return true;
        }
        return syncOnce(forceRefreshRemote);
    }

    @Scheduled(
            fixedDelayString = "${bendoudou.netease.credential-sync-interval-ms:300000}",
            initialDelayString = "${bendoudou.netease.credential-sync-initial-delay-ms:15000}"
    )
    public void scheduledSync() {
        if (!props.isRemoteCredentialConfigured()) {
            return;
        }
        try {
            syncOnce(false);
        } catch (Exception e) {
            log.warn("Netease remote credential scheduled sync failed: {}", e.getMessage());
        }
    }

    private synchronized boolean syncOnce(boolean refreshRemote) {
        String url = props.getCredentialUrl().trim();
        if (refreshRemote) {
            url = url.contains("?") ? url + "&refresh=true" : url + "?refresh=true";
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(20))
                    .header("X-Internal-Api-Key", props.getCredentialApiKey().trim())
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("Netease remote credential HTTP {}: {}", response.statusCode(), abbreviate(response.body()));
                return props.isConfigured();
            }
            JsonNode root = objectMapper.readTree(response.body());
            String musicU = text(root, "musicU");
            String csrf = text(root, "csrf");
            String ua = text(root, "userAgent");
            if (!StringUtils.hasText(musicU)) {
                log.warn("Netease remote credential missing musicU: {}", abbreviate(response.body()));
                return props.isConfigured();
            }
            boolean changed = !musicU.equals(props.getMusicU())
                    || (StringUtils.hasText(csrf) && !csrf.equals(props.getCsrf()));
            props.setMusicU(musicU);
            if (csrf != null) {
                props.setCsrf(csrf);
            }
            if (StringUtils.hasText(ua)) {
                props.setUserAgent(ua);
            }
            lastOkAt.set(Instant.now());
            if (changed) {
                log.info("Netease credentials synced from music (musicULen={} csrfLen={})",
                        musicU.length(), props.getCsrf() == null ? 0 : props.getCsrf().length());
            } else {
                log.debug("Netease credentials sync ok (unchanged)");
            }
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Netease remote credential sync interrupted");
            return props.isConfigured();
        } catch (Exception e) {
            log.warn("Netease remote credential sync failed: {}", e.getMessage());
            return props.isConfigured();
        }
    }

    private static String text(JsonNode root, String field) {
        JsonNode n = root.path(field);
        if (n.isMissingNode() || n.isNull()) {
            return "";
        }
        String v = n.asText();
        return v == null ? "" : v.trim();
    }

    private static String abbreviate(String s) {
        if (s == null) {
            return "";
        }
        String t = s.replace('\n', ' ').trim();
        return t.length() <= 240 ? t : t.substring(0, 240) + "...";
    }
}
