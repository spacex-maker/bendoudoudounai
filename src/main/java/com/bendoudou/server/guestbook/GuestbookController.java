package com.bendoudou.server.guestbook;

import com.bendoudou.server.guestbook.dto.CreateGuestbookMessageRequest;
import com.bendoudou.server.guestbook.dto.GuestbookMessageResponse;
import com.bendoudou.server.util.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/guestbook")
public class GuestbookController {

    private final GuestbookService guestbookService;

    public GuestbookController(GuestbookService guestbookService) {
        this.guestbookService = guestbookService;
    }

    @GetMapping
    public Page<GuestbookMessageResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @RequestParam(defaultValue = "all") String scope,
            Authentication auth
    ) {
        int s = Math.min(Math.max(size, 1), 50);
        int p = Math.max(page, 0);
        Pageable pageable = PageRequest.of(p, s);
        Long uid = null;
        if (auth != null && auth.isAuthenticated() && auth.getName() != null) {
            try {
                uid = Long.parseLong(auth.getName());
            } catch (NumberFormatException ignored) {
                /* ignore */
            }
        }
        GuestbookService.ThreadScope threadScope = parseScope(scope);
        return guestbookService.listThreads(pageable, uid, threadScope);
    }

    @PostMapping
    public GuestbookMessageResponse create(
            @Valid @RequestBody CreateGuestbookMessageRequest request,
            HttpServletRequest http,
            Authentication auth
    ) {
        Long uid = null;
        if (auth != null && auth.isAuthenticated() && auth.getName() != null) {
            try {
                uid = Long.parseLong(auth.getName());
            } catch (NumberFormatException ignored) {
                /* ignore */
            }
        }
        return guestbookService.create(request, ClientIp.of(http), uid);
    }

    private static GuestbookService.ThreadScope parseScope(String raw) {
        if (raw == null) {
            return GuestbookService.ThreadScope.ALL;
        }
        return switch (raw.trim().toLowerCase()) {
            case "public" -> GuestbookService.ThreadScope.PUBLIC;
            case "about_me", "aboutme", "mine" -> GuestbookService.ThreadScope.ABOUT_ME;
            default -> GuestbookService.ThreadScope.ALL;
        };
    }
}
