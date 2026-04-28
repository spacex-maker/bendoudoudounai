package com.bendoudou.server.music.ws;

import com.bendoudou.server.music.dto.PlaylistListeningStatusItemResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class PlaylistListeningWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final Map<Long, Set<WebSocketSession>> sessionsByPlaylist = new ConcurrentHashMap<>();

    public PlaylistListeningWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Long playlistId = playlistIdOf(session);
        if (playlistId == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }
        sessionsByPlaylist.computeIfAbsent(playlistId, k -> ConcurrentHashMap.newKeySet()).add(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long playlistId = playlistIdOf(session);
        if (playlistId == null) {
            return;
        }
        Set<WebSocketSession> sessions = sessionsByPlaylist.get(playlistId);
        if (sessions == null) {
            return;
        }
        sessions.remove(session);
        if (sessions.isEmpty()) {
            sessionsByPlaylist.remove(playlistId);
        }
    }

    public void broadcastListeningUpdate(long playlistId, PlaylistListeningStatusItemResponse item) {
        Set<WebSocketSession> sessions = sessionsByPlaylist.get(playlistId);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }
        String payload;
        try {
            payload = objectMapper.writeValueAsString(new ListeningUpdateMessage("listening_update", playlistId, item));
        } catch (JsonProcessingException ignored) {
            return;
        }
        TextMessage message = new TextMessage(payload);
        for (WebSocketSession session : sessions) {
            if (!session.isOpen()) {
                continue;
            }
            try {
                session.sendMessage(message);
            } catch (IOException ignored) {
            }
        }
    }

    public void broadcastListeningClear(long playlistId, long userId) {
        Set<WebSocketSession> sessions = sessionsByPlaylist.get(playlistId);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }
        String payload;
        try {
            payload = objectMapper.writeValueAsString(new ListeningClearMessage("listening_clear", playlistId, userId));
        } catch (JsonProcessingException ignored) {
            return;
        }
        TextMessage message = new TextMessage(payload);
        for (WebSocketSession session : sessions) {
            if (!session.isOpen()) {
                continue;
            }
            try {
                session.sendMessage(message);
            } catch (IOException ignored) {
            }
        }
    }

    private static Long playlistIdOf(WebSocketSession session) {
        Object value = session.getAttributes().get("playlistId");
        if (value instanceof Long v) {
            return v;
        }
        if (value instanceof Number n) {
            return n.longValue();
        }
        return null;
    }

    private record ListeningUpdateMessage(
            String type,
            long playlistId,
            PlaylistListeningStatusItemResponse item
    ) {
    }

    private record ListeningClearMessage(
            String type,
            long playlistId,
            long userId
    ) {
    }
}
