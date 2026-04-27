package com.bendoudou.server.user.application;

import com.bendoudou.server.user.application.dto.DeveloperApplicationItem;
import com.bendoudou.server.user.application.dto.DeveloperApplicationRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/role-applications/developer")
public class DeveloperApplicationController {

    private final DeveloperRoleApplicationService applicationService;

    public DeveloperApplicationController(DeveloperRoleApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    @PostMapping
    public void apply(
            @RequestBody(required = false) DeveloperApplicationRequest body,
            Authentication auth
    ) {
        applicationService.applyForDeveloper(requireUserId(auth), body);
    }

    @GetMapping("/mine")
    public List<DeveloperApplicationItem> mine(Authentication auth) {
        return applicationService.listMine(requireUserId(auth));
    }

    private static long requireUserId(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "需要登录");
        }
        return Long.parseLong(auth.getName());
    }
}
