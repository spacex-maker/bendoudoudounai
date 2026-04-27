package com.bendoudou.server.wishlist;

import com.bendoudou.server.wishlist.dto.CreateWishlistEntryRequest;
import com.bendoudou.server.wishlist.dto.WishlistEntryResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.concurrent.ConcurrentHashMap;

@Service
public class WishlistService {

    private static final int RATE_WINDOW_MS = 30_000;
    private static final String RATE_MSG = "提交太频繁，请稍后再试";

    private final WishlistEntryRepository repository;
    private final ConcurrentHashMap<String, Long> lastSubmitMsByIp = new ConcurrentHashMap<>();

    public WishlistService(WishlistEntryRepository repository) {
        this.repository = repository;
    }

    public Page<WishlistEntryResponse> list(Pageable pageable) {
        return repository.findAllByOrderByCreatedAtDesc(pageable).map(this::toResponse);
    }

    /** 管理端删除；调用方需已校验管理员身份。 */
    @Transactional
    public void deleteByAdmin(long entryId) {
        WishlistEntry e = repository.findById(entryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "心愿不存在"));
        repository.delete(e);
    }

    public WishlistEntryResponse create(CreateWishlistEntryRequest req, String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            clientIp = "unknown";
        }
        long now = System.currentTimeMillis();
        long last = lastSubmitMsByIp.getOrDefault(clientIp, 0L);
        if (now - last < RATE_WINDOW_MS) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, RATE_MSG);
        }

        WishlistEntry e = new WishlistEntry();
        String nn = req.nickname() == null ? null : req.nickname().trim();
        e.setNickname(StringUtils.hasText(nn) ? nn : null);
        e.setContent(req.content().trim());
        e = repository.save(e);
        lastSubmitMsByIp.put(clientIp, now);
        return toResponse(e);
    }

    private WishlistEntryResponse toResponse(WishlistEntry e) {
        return new WishlistEntryResponse(
                e.getId(),
                e.getNickname(),
                e.getContent(),
                e.getCreatedAt().toEpochMilli()
        );
    }
}
