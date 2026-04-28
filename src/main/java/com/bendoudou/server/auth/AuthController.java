package com.bendoudou.server.auth;

import com.bendoudou.server.auth.dto.AuthResponse;
import com.bendoudou.server.user.UserService;
import com.bendoudou.server.util.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpServletRequest
    ) {
        return ResponseEntity.ok(userService.login(
                request.email(),
                request.password(),
                ClientIp.of(httpServletRequest)
        ));
    }

    public record LoginRequest(
            @NotBlank String email,
            @NotBlank String password
    ) {}
}
