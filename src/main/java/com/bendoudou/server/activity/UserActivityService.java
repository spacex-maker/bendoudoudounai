package com.bendoudou.server.activity;

import com.bendoudou.server.activity.dto.RecordActivityRequest;
import com.bendoudou.server.activity.dto.UserActivityEventResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

@Service
public class UserActivityService {

    private static final int MAX_QUERY = 512;
    private static final int MAX_DETAIL = 8000;
    private static final int MAX_UA = 512;

    private final UserActivityEventRepository repository;

    public UserActivityService(UserActivityEventRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public UserActivityEventResponse record(long userId, RecordActivityRequest req) {
        return toResponse(persist(
                userId,
                req.action(),
                req.scope(),
                req.query(),
                req.targetType(),
                req.targetId(),
                req.detailJson(),
                currentRequest()
        ));
    }

    /** 服务端埋点：忽略写入失败，不影响主流程 */
    @Transactional
    public void recordQuietly(
            long userId,
            String action,
            String scope,
            String query,
            String targetType,
            Long targetId,
            String detailJson
    ) {
        try {
            if (userId <= 0 || !StringUtils.hasText(action)) {
                return;
            }
            persist(userId, action, scope, query, targetType, targetId, detailJson, currentRequest());
        } catch (Exception ignored) {
            // 埋点失败不阻断业务
        }
    }

    @Transactional(readOnly = true)
    public List<UserActivityEventResponse> listMine(long userId, String action, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 200);
        var page = PageRequest.of(0, safeLimit);
        List<UserActivityEvent> rows;
        if (StringUtils.hasText(action)) {
            rows = repository.findByUserIdAndActionOrderByCreatedAtDesc(userId, action.trim(), page);
        } else {
            rows = repository.findByUserIdOrderByCreatedAtDesc(userId, page);
        }
        return rows.stream().map(this::toResponse).toList();
    }

    private UserActivityEvent persist(
            long userId,
            String action,
            String scope,
            String query,
            String targetType,
            Long targetId,
            String detailJson,
            HttpServletRequest request
    ) {
        UserActivityEvent e = new UserActivityEvent();
        e.setUserId(userId);
        e.setAction(normalizeAction(action));
        e.setScope(trimTo(scope, 32));
        e.setQuery(trimTo(query, MAX_QUERY));
        e.setTargetType(trimTo(targetType, 32));
        e.setTargetId(targetId != null && targetId > 0 ? targetId : null);
        e.setDetailJson(trimTo(detailJson, MAX_DETAIL));
        if (request != null) {
            e.setClientIp(clientIp(request));
            e.setUserAgent(trimTo(request.getHeader("User-Agent"), MAX_UA));
        }
        e.setCreatedAt(Instant.now());
        return repository.save(e);
    }

    private UserActivityEventResponse toResponse(UserActivityEvent e) {
        return new UserActivityEventResponse(
                e.getId(),
                e.getAction(),
                e.getScope(),
                e.getQuery(),
                e.getTargetType(),
                e.getTargetId(),
                e.getDetailJson(),
                e.getCreatedAt() != null ? e.getCreatedAt().toEpochMilli() : 0L
        );
    }

    private static String normalizeAction(String action) {
        String a = action == null ? "" : action.trim().toUpperCase(Locale.ROOT);
        if (a.length() > 64) {
            a = a.substring(0, 64);
        }
        return a;
    }

    private static String trimTo(String s, int max) {
        if (!StringUtils.hasText(s)) {
            return null;
        }
        String t = s.trim();
        if (t.length() > max) {
            return t.substring(0, max);
        }
        return t;
    }

    private static HttpServletRequest currentRequest() {
        var attrs = RequestContextHolder.getRequestAttributes();
        if (attrs instanceof ServletRequestAttributes sra) {
            return sra.getRequest();
        }
        return null;
    }

    private static String clientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(xff)) {
            int comma = xff.indexOf(',');
            return (comma > 0 ? xff.substring(0, comma) : xff).trim();
        }
        String real = request.getHeader("X-Real-IP");
        if (StringUtils.hasText(real)) {
            return real.trim();
        }
        return request.getRemoteAddr();
    }
}
