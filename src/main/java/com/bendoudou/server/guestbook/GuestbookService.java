package com.bendoudou.server.guestbook;

import com.bendoudou.server.guestbook.dto.CreateGuestbookMessageRequest;
import com.bendoudou.server.guestbook.dto.GuestbookMessageResponse;
import com.bendoudou.server.user.User;
import com.bendoudou.server.user.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GuestbookService {

    private static final int RATE_WINDOW_MS = 30_000;
    private static final String RATE_MSG = "提交太频繁，请稍后再试";
    private static final String ERR_REPLY_DEPTH = "仅支持对主楼留言回复";
    private static final String ERR_AUTH_FOR_DIRECT = "指定仅某人可见时请先登录";
    private static final String ERR_USER_NOT_FOUND = "所选用户不存在";

    private final GuestbookMessageRepository repository;
    private final UserRepository userRepository;
    private final ConcurrentHashMap<String, Long> lastSubmitMsByIp = new ConcurrentHashMap<>();

    public GuestbookService(GuestbookMessageRepository repository, UserRepository userRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
    }

    /**
     * 分页主楼。未登录只可见全员帖；已登录还可见「定向给自己」的帖。附带一层回复。
     */
    public Page<GuestbookMessageResponse> listThreads(Pageable pageable, Long viewerUserIdOrNull) {
        Page<GuestbookMessage> rootPage = viewerUserIdOrNull == null
                ? repository.findPublicRootThreads(pageable)
                : repository.findRootThreadsForUser(viewerUserIdOrNull, pageable);
        List<GuestbookMessage> roots = rootPage.getContent();
        if (roots.isEmpty()) {
            return rootPage.map(
                    e -> toRootResponse(e, List.of(), Map.of())
            );
        }
        List<Long> rootIds = roots.stream().map(GuestbookMessage::getId).toList();
        List<GuestbookMessage> replyRows = repository.findByParentIdInOrderByCreatedAtAsc(rootIds);
        Map<Long, List<GuestbookMessage>> byParent = new LinkedHashMap<>();
        for (Long id : rootIds) {
            byParent.put(id, new ArrayList<>());
        }
        for (GuestbookMessage r : replyRows) {
            if (r.getParentId() != null && byParent.containsKey(r.getParentId())) {
                byParent.get(r.getParentId()).add(r);
            }
        }
        Set<Long> needUserIds = new HashSet<>();
        for (GuestbookMessage g : roots) {
            addVisibleId(needUserIds, g);
        }
        for (GuestbookMessage r : replyRows) {
            addVisibleId(needUserIds, r);
        }
        Map<Long, String> labelById = buildTargetLabels(needUserIds);
        return rootPage.map(e -> toRootResponse(e, byParent.getOrDefault(e.getId(), List.of()), labelById));
    }

    private static void addVisibleId(Set<Long> out, GuestbookMessage g) {
        if (g.getVisibleToUserId() != null) {
            out.add(g.getVisibleToUserId());
        }
    }

    private Map<Long, String> buildTargetLabels(Set<Long> userIds) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        List<User> users = userRepository.findAllById(userIds);
        Map<Long, String> m = new LinkedHashMap<>();
        for (User u : users) {
            m.put(u.getId(), displayLabel(u));
        }
        return m;
    }

    private static String displayLabel(User u) {
        if (StringUtils.hasText(u.getDisplayName())) {
            return u.getDisplayName().trim();
        }
        return u.getEmail();
    }

    public GuestbookMessageResponse create(
            CreateGuestbookMessageRequest req,
            String clientIp,
            Long authedUserIdOrNull
    ) {
        if (clientIp == null || clientIp.isBlank()) {
            clientIp = "unknown";
        }
        long now = System.currentTimeMillis();
        long last = lastSubmitMsByIp.getOrDefault(clientIp, 0L);
        if (now - last < RATE_WINDOW_MS) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, RATE_MSG);
        }

        Long pId = req.parentId();
        Long inheritedVisible = null;
        if (pId != null) {
            GuestbookMessage parent = repository.findById(pId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "要回复的留言不存在"));
            if (parent.getParentId() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ERR_REPLY_DEPTH);
            }
            inheritedVisible = parent.getVisibleToUserId();
        }

        Long vis = req.visibleToUserId();
        if (pId != null) {
            vis = inheritedVisible;
        } else {
            if (vis != null) {
                if (authedUserIdOrNull == null) {
                    throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, ERR_AUTH_FOR_DIRECT);
                }
                userRepository.findById(vis).orElseThrow(
                        () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, ERR_USER_NOT_FOUND)
                );
            }
        }

        GuestbookMessage m = new GuestbookMessage();
        m.setParentId(pId);
        String nn = req.nickname() == null ? null : req.nickname().trim();
        m.setNickname(StringUtils.hasText(nn) ? nn : null);
        m.setContent(req.content().trim());
        m.setVisibleToUserId(vis);
        m = repository.save(m);
        lastSubmitMsByIp.put(clientIp, now);

        String targetLabel = vis == null ? null : userRepository.findById(vis).map(GuestbookService::displayLabel).orElse(null);
        return GuestbookMessageResponse.flat(
                m.getId(),
                nickOrNull(m),
                m.getContent(),
                m.getParentId(),
                m.getCreatedAt().toEpochMilli(),
                m.getVisibleToUserId(),
                targetLabel
        );
    }

    private static String nickOrNull(GuestbookMessage e) {
        String s = e.getNickname();
        return StringUtils.hasText(s) ? s : null;
    }

    private GuestbookMessageResponse toRootResponse(
            GuestbookMessage root,
            List<GuestbookMessage> replyList,
            Map<Long, String> labelById
    ) {
        List<GuestbookMessageResponse> rep = replyList.stream()
                .map(r -> toFlat(r, labelById))
                .collect(Collectors.toList());
        return new GuestbookMessageResponse(
                root.getId(),
                nickOrNull(root),
                root.getContent(),
                root.getParentId(),
                root.getCreatedAt().toEpochMilli(),
                root.getVisibleToUserId(),
                targetLabel(root.getVisibleToUserId(), labelById),
                rep
        );
    }

    private static GuestbookMessageResponse toFlat(GuestbookMessage e, Map<Long, String> labelById) {
        return GuestbookMessageResponse.flat(
                e.getId(),
                nickOrNull(e),
                e.getContent(),
                e.getParentId(),
                e.getCreatedAt().toEpochMilli(),
                e.getVisibleToUserId(),
                targetLabel(e.getVisibleToUserId(), labelById)
        );
    }

    private static String targetLabel(Long visibleToUserId, Map<Long, String> labelById) {
        if (visibleToUserId == null) {
            return null;
        }
        return labelById.get(visibleToUserId);
    }
}
