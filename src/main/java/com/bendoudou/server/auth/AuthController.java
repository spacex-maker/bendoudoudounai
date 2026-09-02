package com.bendoudou.server.auth;

import com.bendoudou.server.auth.dto.AuthResponse;
import com.bendoudou.server.auth.dto.InviteCodeValidateResponse;
import com.bendoudou.server.auth.dto.RegisterRequest;
import com.bendoudou.server.auth.dto.RegisterSendEmailRequest;
import com.bendoudou.server.auth.dto.ResetPasswordRequest;
import com.bendoudou.server.auth.dto.ResetPasswordSendEmailRequest;
import com.bendoudou.server.user.UserService;
import com.bendoudou.server.util.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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

    @PostMapping("/register/send-email")
    public ResponseEntity<Void> sendRegisterEmail(@Valid @RequestBody RegisterSendEmailRequest request) {
        userService.sendRegisterEmailCode(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpServletRequest
    ) {
        return ResponseEntity.ok(userService.register(request, ClientIp.of(httpServletRequest)));
    }

    @PostMapping("/reset-password/send-email")
    public ResponseEntity<Void> sendResetPasswordEmail(@Valid @RequestBody ResetPasswordSendEmailRequest request) {
        userService.sendResetPasswordEmailCode(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        userService.resetPassword(request);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/invite/validate")
    public InviteCodeValidateResponse validateInvite(@RequestParam("code") String code) {
        return userService.validateInviteCode(code);
    }

    public record LoginRequest(
            @NotBlank String email,
            @NotBlank String password
    ) {}
}
