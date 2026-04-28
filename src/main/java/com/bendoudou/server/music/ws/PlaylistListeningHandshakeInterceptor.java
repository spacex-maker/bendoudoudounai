package com.bendoudou.server.music.ws;

import com.bendoudou.server.music.PlaylistMemberRepository;
import com.bendoudou.server.security.JwtTokenService;
import com.bendoudou.server.user.User;
import com.bendoudou.server.user.UserRepository;
import io.jsonwebtoken.Claims;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Component
public class PlaylistListeningHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtTokenService jwtTokenService;
    private final PlaylistMemberRepository playlistMemberRepository;
    private final UserRepository userRepository;

    public PlaylistListeningHandshakeInterceptor(
            JwtTokenService jwtTokenService,
            PlaylistMemberRepository playlistMemberRepository,
            UserRepository userRepository
    ) {
        this.jwtTokenService = jwtTokenService;
        this.playlistMemberRepository = playlistMemberRepository;
        this.userRepository = userRepository;
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        if (!(request instanceof ServletServerHttpRequest servletRequest)) {
            return false;
        }
        String token = servletRequest.getServletRequest().getParameter("access_token");
        String playlistIdRaw = servletRequest.getServletRequest().getParameter("playlistId");
        if (!StringUtils.hasText(token) || !StringUtils.hasText(playlistIdRaw)) {
            return false;
        }
        long userId;
        long playlistId;
        try {
            Claims claims = jwtTokenService.parseToken(token.trim());
            userId = Long.parseLong(claims.getSubject());
            playlistId = Long.parseLong(playlistIdRaw.trim());
        } catch (Exception ex) {
            return false;
        }
        User u = userRepository.findById(userId).orElse(null);
        if (u == null || !u.isAccountEnabled()) {
            return false;
        }
        if (!playlistMemberRepository.existsByPlaylistIdAndUserId(playlistId, userId)) {
            return false;
        }
        attributes.put("userId", userId);
        attributes.put("playlistId", playlistId);
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception
    ) {
    }
}
