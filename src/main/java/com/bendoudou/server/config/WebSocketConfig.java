package com.bendoudou.server.config;

import com.bendoudou.server.music.ws.PlaylistListeningHandshakeInterceptor;
import com.bendoudou.server.music.ws.PlaylistListeningWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final PlaylistListeningWebSocketHandler playlistListeningWebSocketHandler;
    private final PlaylistListeningHandshakeInterceptor playlistListeningHandshakeInterceptor;

    public WebSocketConfig(
            PlaylistListeningWebSocketHandler playlistListeningWebSocketHandler,
            PlaylistListeningHandshakeInterceptor playlistListeningHandshakeInterceptor
    ) {
        this.playlistListeningWebSocketHandler = playlistListeningWebSocketHandler;
        this.playlistListeningHandshakeInterceptor = playlistListeningHandshakeInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry registry) {
        registry.addHandler(playlistListeningWebSocketHandler, "/ws/playlist-listening")
                .addInterceptors(playlistListeningHandshakeInterceptor)
                .setAllowedOriginPatterns("*");
    }
}
