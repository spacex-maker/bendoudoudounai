package com.bendoudou.server.auth.registration;

import com.bendoudou.server.auth.registration.dto.RegistrationApplicationItem;
import com.bendoudou.server.auth.registration.dto.RejectRegistrationRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/admin/registration-applications")
public class AdminRegistrationApplicationController {

    private final RegistrationApplicationService applicationService;

    public AdminRegistrationApplicationController(RegistrationApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    @GetMapping
    public List<RegistrationApplicationItem> list(
            @RequestParam(name = "status", required = false) String status,
            Authentication auth
    ) {
        RegistrationApplicationStatus st = null;
        if (status != null && !status.isBlank()) {
            try {
                st = RegistrationApplicationStatus.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "非法状态");
            }
        }
        return applicationService.listForAdmin(requireUserId(auth), st);
    }

    @PostMapping("/{id}/approve")
    public void approve(@PathVariable long id, Authentication auth) {
        applicationService.approve(requireUserId(auth), id);
    }

    @PostMapping("/{id}/reject")
    public void reject(
            @PathVariable long id,
            @Valid @RequestBody RejectRegistrationRequest body,
            Authentication auth
    ) {
        applicationService.reject(requireUserId(auth), id, body);
    }

    private static long requireUserId(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "需要登录");
        }
        return Long.parseLong(auth.getName());
    }
}
