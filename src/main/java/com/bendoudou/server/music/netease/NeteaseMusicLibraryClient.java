package com.bendoudou.server.music.netease;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;

/**
 * 调用 AIMATEX-MUSIC 内部曲库接口，复用其已上传到共享 COS 的网易云音轨。
 */
@Component
public class NeteaseMusicLibraryClient {

    private static final Logger log = LoggerFactory.getLogger(NeteaseMusicLibraryClient.class);

    private final NeteaseProperties props;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public NeteaseMusicLibraryClient(NeteaseProperties props, ObjectMapper objectMapper) {
        this.props = props;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public Optional<RemoteAsset> ensureAsset(long neteaseSongId, String quality, boolean ensure) {
        if (!props.isRemoteCredentialConfigured() || neteaseSongId <= 0) {
            return Optional.empty();
        }
        String base = props.getCredentialUrl().trim();
        String libraryUrl;
        if (StringUtils.hasText(props.getLibraryUrl())) {
            libraryUrl = props.getLibraryUrl().trim();
        } else if (base.endsWith("/credentials")) {
            libraryUrl = base.substring(0, base.length() - "/credentials".length()) + "/library";
        } else {
            libraryUrl = "https://music-api.aimatex.com/api/internal/netease/library";
        }
        String q = StringUtils.hasText(quality) ? quality.trim() : "exhigh";
        String url = libraryUrl
                + (libraryUrl.contains("?") ? "&" : "?")
                + "songId=" + neteaseSongId
                + "&quality=" + URLEncoder.encode(q, StandardCharsets.UTF_8)
                + "&ensure=" + ensure;
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(120))
                    .header("X-Internal-Api-Key", props.getCredentialApiKey().trim())
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("music library HTTP {}: {}", response.statusCode(), abbreviate(response.body()));
                return Optional.empty();
            }
            JsonNode root = objectMapper.readTree(response.body());
            String sha = text(root, "fileSha256");
            String audioKey = text(root, "audioObjectKey");
            String ext = text(root, "audioExt");
            if (!StringUtils.hasText(sha) || !StringUtils.hasText(audioKey) || !StringUtils.hasText(ext)) {
                log.warn("music library missing fields: {}", abbreviate(response.body()));
                return Optional.empty();
            }
            return Optional.of(new RemoteAsset(
                    sha.toLowerCase(),
                    ext.toLowerCase(),
                    text(root, "title"),
                    text(root, "artist"),
                    text(root, "album"),
                    text(root, "note"),
                    root.path("durationSeconds").asInt(0),
                    root.path("fileSize").asLong(0),
                    text(root, "mimeType"),
                    audioKey,
                    blankToNull(text(root, "lyricsObjectKey")),
                    blankToNull(text(root, "coverObjectKey")),
                    text(root, "quality")
            ));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("music library interrupted");
            return Optional.empty();
        } catch (Exception e) {
            log.warn("music library failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    public record RemoteAsset(
            String fileSha256,
            String audioExt,
            String title,
            String artist,
            String album,
            String note,
            int durationSeconds,
            long fileSize,
            String mimeType,
            String audioObjectKey,
            String lyricsObjectKey,
            String coverObjectKey,
            String quality
    ) {}

    private static String text(JsonNode root, String field) {
        JsonNode n = root.path(field);
        if (n.isMissingNode() || n.isNull()) {
            return "";
        }
        String v = n.asText();
        return v == null ? "" : v.trim();
    }

    private static String blankToNull(String v) {
        return StringUtils.hasText(v) ? v : null;
    }

    private static String abbreviate(String s) {
        if (s == null) {
            return "";
        }
        String t = s.replace('\n', ' ').trim();
        return t.length() <= 240 ? t : t.substring(0, 240) + "...";
    }
}
