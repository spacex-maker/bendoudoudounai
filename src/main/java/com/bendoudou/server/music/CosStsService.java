package com.bendoudou.server.music;

import com.bendoudou.server.music.dto.CosUploadTicketResponse;
import com.tencent.cloud.CosStsClient;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@Service
public class CosStsService {
    private static final Logger log = LoggerFactory.getLogger(CosStsService.class);

    private final CosProperties props;

    public CosStsService(CosProperties props) {
        this.props = props;
    }

    public boolean isUsable() {
        String secretId = CosSecretResolver.resolveSecretId(props);
        String secretKey = CosSecretResolver.resolveSecretKey(props);
        return props.isEnabled()
                && StringUtils.hasText(secretId)
                && StringUtils.hasText(secretKey)
                && StringUtils.hasText(props.getBucket())
                && StringUtils.hasText(props.getRegion());
    }

    public CosUploadTicketResponse issueTicket(String audioObjectKey, String lyricsObjectKey) {
        log.info("Issuing COS STS ticket: audioKey={}, lyricsKeyPresent={}",
                audioObjectKey, StringUtils.hasText(lyricsObjectKey));
        if (!isUsable()) {
            log.error("COS STS unavailable: enabled={}, bucket={}, region={}, secretIdPresent={}, secretKeyPresent={}",
                    props.isEnabled(),
                    props.getBucket(),
                    props.getRegion(),
                    StringUtils.hasText(CosSecretResolver.resolveSecretId(props)),
                    StringUtils.hasText(CosSecretResolver.resolveSecretKey(props)));
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "COS config unavailable");
        }
        if (!StringUtils.hasText(audioObjectKey)) {
            log.warn("Reject STS ticket request: audioObjectKey is blank");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "audioObjectKey is required");
        }
        List<String> allowPrefixes = new ArrayList<>();
        allowPrefixes.add(audioObjectKey);
        if (StringUtils.hasText(lyricsObjectKey)) {
            allowPrefixes.add(lyricsObjectKey);
        }

        TreeMap<String, Object> config = new TreeMap<>();
        try {
            config.put("secretId", CosSecretResolver.resolveSecretId(props));
            config.put("secretKey", CosSecretResolver.resolveSecretKey(props));
            config.put("durationSeconds", 1800);
            config.put("bucket", props.getBucket());
            config.put("region", props.getRegion());
            config.put("allowPrefixes", allowPrefixes.toArray(new String[0]));
            config.put("allowActions", new String[]{
                    "name/cos:PutObject",
                    "name/cos:PostObject",
                    "name/cos:InitiateMultipartUpload",
                    "name/cos:ListMultipartUploads",
                    "name/cos:ListParts",
                    "name/cos:UploadPart",
                    "name/cos:CompleteMultipartUpload",
                    "name/cos:AbortMultipartUpload"
            });
            Object credential = CosStsClient.getCredential(config);
            // Compatible with multiple return shapes:
            // 1) credential.credentials.tmpSecretId
            // 2) credential.tmpSecretId
            // 3) map-style keys
            Object credentials = readObject(credential, "credentials");
            Object source = credentials != null ? credentials : credential;

            String tmpSecretId = firstNonBlank(
                    readString(source, "tmpSecretId"),
                    readString(source, "TmpSecretId"),
                    readString(source, "secretId")
            );
            String tmpSecretKey = firstNonBlank(
                    readString(source, "tmpSecretKey"),
                    readString(source, "TmpSecretKey"),
                    readString(source, "secretKey")
            );
            String sessionToken = firstNonBlank(
                    readString(source, "sessionToken"),
                    readString(source, "token"),
                    readString(source, "Token"),
                    readString(source, "session_token")
            );
            long startTime = firstPositive(
                    readLong(credential, "startTime"),
                    readLong(credential, "StartTime")
            );
            long expiredTime = firstPositive(
                    readLong(credential, "expiredTime"),
                    readLong(credential, "ExpiredTime")
            );
            if (!StringUtils.hasText(tmpSecretId) || !StringUtils.hasText(tmpSecretKey) || !StringUtils.hasText(sessionToken)) {
                log.error(
                        "STS credential parse failed: credentialClass={}, credentialKeys={}, nestedCredentialsClass={}, nestedCredentialsKeys={}",
                        classNameOf(credential),
                        keySnapshot(credential),
                        classNameOf(credentials),
                        keySnapshot(credentials)
                );
                throw new IllegalStateException("STS credential fields are empty");
            }
            log.info("COS STS ticket issued successfully: startTime={}, expiredTime={}", startTime, expiredTime);
            return new CosUploadTicketResponse(
                    tmpSecretId,
                    tmpSecretKey,
                    sessionToken,
                    startTime,
                    expiredTime,
                    props.getBucket(),
                    props.getRegion(),
                    "https://" + props.getBucket() + ".cos." + props.getRegion() + ".myqcloud.com",
                    audioObjectKey,
                    lyricsObjectKey
            );
        } catch (Exception e) {
            String msg = e.getClass().getSimpleName() + ": " + (e.getMessage() == null ? "unknown" : e.getMessage());
            log.error("Failed to issue COS STS ticket: {}", msg, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to issue COS STS ticket -> " + msg);
        }
    }

    private static Object readObject(Object bean, String name) {
        if (bean == null) {
            return null;
        }
        if (bean instanceof JSONObject jo) {
            if (jo.has(name)) {
                return jo.opt(name);
            }
            for (String key : jo.keySet()) {
                if (name.equalsIgnoreCase(key)) {
                    return jo.opt(key);
                }
            }
            return null;
        }
        if (bean instanceof Map<?, ?> m) {
            Object v = m.get(name);
            if (v != null) {
                return v;
            }
            // Case-insensitive fallback for map keys from some SDK versions
            for (Map.Entry<?, ?> e : m.entrySet()) {
                if (e.getKey() != null && name.equalsIgnoreCase(String.valueOf(e.getKey()))) {
                    return e.getValue();
                }
            }
            return null;
        }
        try {
            Field f = bean.getClass().getField(name);
            return f.get(bean);
        } catch (Exception ignored) {
        }
        try {
            Method m = bean.getClass().getMethod("get" + Character.toUpperCase(name.charAt(0)) + name.substring(1));
            return m.invoke(bean);
        } catch (Exception ignored) {
        }
        return null;
    }

    private static String readString(Object bean, String name) {
        Object v = readObject(bean, name);
        if (v == null || v == JSONObject.NULL) {
            return null;
        }
        return v == null ? null : String.valueOf(v);
    }

    private static long readLong(Object bean, String name) {
        Object v = readObject(bean, name);
        if (v == null || v == JSONObject.NULL) {
            return 0L;
        }
        if (v instanceof Number n) {
            return n.longValue();
        }
        if (v instanceof String s) {
            try {
                return Long.parseLong(s);
            } catch (NumberFormatException ignored) {
            }
        }
        return 0L;
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String v : values) {
            if (StringUtils.hasText(v)) {
                return v;
            }
        }
        return null;
    }

    private static long firstPositive(long... values) {
        if (values == null) {
            return 0L;
        }
        for (long v : values) {
            if (v > 0) {
                return v;
            }
        }
        return 0L;
    }

    private static String classNameOf(Object bean) {
        return bean == null ? "null" : bean.getClass().getName();
    }

    private static String keySnapshot(Object bean) {
        if (bean == null) {
            return "[]";
        }
        if (bean instanceof JSONObject jo) {
            return jo.keySet().toString();
        }
        if (bean instanceof Map<?, ?> m) {
            List<String> keys = new ArrayList<>();
            for (Object k : m.keySet()) {
                keys.add(String.valueOf(k));
            }
            return keys.toString();
        }
        List<String> keys = new ArrayList<>();
        for (Field f : bean.getClass().getFields()) {
            keys.add(f.getName());
        }
        return keys.toString();
    }
}
