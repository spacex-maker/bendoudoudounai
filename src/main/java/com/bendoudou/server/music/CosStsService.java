package com.bendoudou.server.music;

import com.bendoudou.server.music.dto.CosUploadTicketResponse;
import com.tencent.cloud.CosStsClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeMap;

@Service
public class CosStsService {

    private final CosProperties props;

    public CosStsService(CosProperties props) {
        this.props = props;
    }

    public boolean isUsable() {
        return props.isEnabled()
                && StringUtils.hasText(props.getSecretId())
                && StringUtils.hasText(props.getSecretKey())
                && StringUtils.hasText(props.getBucket())
                && StringUtils.hasText(props.getRegion());
    }

    public CosUploadTicketResponse issueTicket(String audioObjectKey, String lyricsObjectKey) {
        if (!isUsable()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "COS ??????????");
        }
        if (!StringUtils.hasText(audioObjectKey)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "audioObjectKey ???????");
        }
        List<String> allowPrefixes = new ArrayList<>();
        allowPrefixes.add(audioObjectKey);
        if (StringUtils.hasText(lyricsObjectKey)) {
            allowPrefixes.add(lyricsObjectKey);
        }

        TreeMap<String, Object> config = new TreeMap<>();
        try {
            config.put("secretId", props.getSecretId());
            config.put("secretKey", props.getSecretKey());
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
            // 兼容不同 cos-sts-java 版本：有的结构是 credential.credentials.tmpSecretId，
            // 也有版本直接把 tmpSecretId/tmpSecretKey/sessionToken 放在顶层。
            Object credentials = readObject(credential, "credentials");
            Object source = credentials != null ? credentials : credential;
            String tmpSecretId = readString(source, "tmpSecretId");
            String tmpSecretKey = readString(source, "tmpSecretKey");
            String sessionToken = readString(source, "sessionToken");
            long startTime = readLong(credential, "startTime");
            long expiredTime = readLong(credential, "expiredTime");
            if (!StringUtils.hasText(tmpSecretId) || !StringUtils.hasText(tmpSecretKey) || !StringUtils.hasText(sessionToken)) {
                throw new IllegalStateException("STS 返回凭证字段为空");
            }
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
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "???? COS ???????? -> " + msg);
        }
    }

    private static Object readObject(Object bean, String name) {
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
        return v == null ? null : String.valueOf(v);
    }

    private static long readLong(Object bean, String name) {
        Object v = readObject(bean, name);
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
}
