package com.bendoudou.server.wishlist;

import com.bendoudou.server.wishlist.dto.CreateWishlistEntryRequest;
import com.bendoudou.server.wishlist.dto.WishlistEntryResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/wishlist")
public class WishlistController {

    private static final Pattern IP_SPLIT = Pattern.compile("[,;\\s]+");

    private final WishlistService wishlistService;

    public WishlistController(WishlistService wishlistService) {
        this.wishlistService = wishlistService;
    }

    @GetMapping
    public Page<WishlistEntryResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size
    ) {
        int s = Math.min(Math.max(size, 1), 100);
        int p = Math.max(page, 0);
        Pageable pageable = PageRequest.of(p, s);
        return wishlistService.list(pageable);
    }

    @PostMapping
    public WishlistEntryResponse create(
            @Valid @RequestBody CreateWishlistEntryRequest request,
            HttpServletRequest http
    ) {
        return wishlistService.create(request, clientIp(http));
    }

    private static String clientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String first = IP_SPLIT.split(xff.trim())[0];
            if (!first.isEmpty()) {
                return first;
            }
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }
}
