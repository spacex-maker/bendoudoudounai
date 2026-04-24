package com.bendoudou.server.music;

import com.bendoudou.server.music.dto.CosUploadTicketResponse;
import com.tencent.cloud.CosStsClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

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
            Object credentials = credential.getClass().getField("credentials").get(credential);
            String tmpSecretId = String.valueOf(credentials.getClass().getField("tmpSecretId").get(credentials));
            String tmpSecretKey = String.valueOf(credentials.getClass().getField("tmpSecretKey").get(credentials));
            String sessionToken = String.valueOf(credentials.getClass().getField("sessionToken").get(credentials));
            long startTime = ((Number) credential.getClass().getField("startTime").get(credential)).longValue();
            long expiredTime = ((Number) credential.getClass().getField("expiredTime").get(credential)).longValue();
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
}
