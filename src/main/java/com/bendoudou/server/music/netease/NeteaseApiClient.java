package com.bendoudou.server.music.netease;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class NeteaseApiClient {

    private static final String BASE = "https://music.163.com";

    private final NeteaseProperties props;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public NeteaseApiClient(NeteaseProperties props, ObjectMapper objectMapper) {
        this.props = props;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public JsonNode searchSongs(String keyword, int limit, int offset) throws IOException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("s", keyword);
        body.put("type", 1);
        body.put("limit", Math.min(Math.max(limit, 1), 50));
        body.put("offset", Math.max(offset, 0));
        body.put("csrf_token", csrf());
        return postWeapi("/weapi/cloudsearch/get/web", objectMapper.writeValueAsString(body));
    }

    public JsonNode songDetail(long songId) throws IOException {
        // 网易云详情接口必须带 c=[{"id":...}]，仅传 ids 会返回空 songs
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("c", objectMapper.writeValueAsString(List.of(Map.of("id", songId))));
        body.put("ids", objectMapper.writeValueAsString(List.of(songId)));
        body.put("csrf_token", csrf());
        return postWeapi("/weapi/v3/song/detail", objectMapper.writeValueAsString(body));
    }

    public JsonNode songUrl(long songId, String level, String encodeType) throws IOException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ids", objectMapper.writeValueAsString(List.of(songId)));
        body.put("level", level);
        body.put("encodeType", encodeType);
        body.put("csrf_token", csrf());
        return postWeapi("/weapi/song/enhance/player/url/v1", objectMapper.writeValueAsString(body));
    }

    /** 兼容旧版 url 接口（部分曲目 v1 无结果时回退） */
    public JsonNode songUrlLegacy(long songId, int br) throws IOException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ids", objectMapper.writeValueAsString(List.of(songId)));
        body.put("br", br);
        body.put("csrf_token", csrf());
        return postWeapi("/weapi/song/enhance/player/url", objectMapper.writeValueAsString(body));
    }

    public JsonNode songLyric(long songId) throws IOException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", songId);
        body.put("lv", -1);
        body.put("tv", -1);
        body.put("csrf_token", csrf());
        return postWeapi("/weapi/song/lyric", objectMapper.writeValueAsString(body));
    }

    private String csrf() {
        return props.getCsrf() == null ? "" : props.getCsrf();
    }

    private JsonNode postWeapi(String path, String plainJson) throws IOException {
        Map<String, String> encrypted = NeteaseWeapiCrypto.encrypt(plainJson);
        String body = "params=" + urlEncode(encrypted.get("params"))
                + "&encSecKey=" + urlEncode(encrypted.get("encSecKey"));
        String csrf = props.getCsrf() == null ? "" : props.getCsrf();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE + path + "?csrf_token=" + urlEncode(csrf)))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Referer", BASE)
                .header("Origin", BASE)
                .header("User-Agent", props.getUserAgent())
                .header("Cookie", buildCookieHeader())
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Netease API interrupted", e);
        }
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("Netease API HTTP " + response.statusCode());
        }
        return objectMapper.readTree(response.body());
    }

    private String buildCookieHeader() {
        StringBuilder sb = new StringBuilder();
        if (StringUtils.hasText(props.getMusicU())) {
            sb.append("MUSIC_U=").append(props.getMusicU());
        }
        if (StringUtils.hasText(props.getCsrf())) {
            if (sb.length() > 0) {
                sb.append("; ");
            }
            sb.append("__csrf=").append(props.getCsrf());
        }
        return sb.toString();
    }

    private static String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
