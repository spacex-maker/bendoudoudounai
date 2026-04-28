package com.bendoudou.server.music;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MusicMentionNotificationRepository extends JpaRepository<MusicMentionNotification, Long> {

    List<MusicMentionNotification> findByRecipientUserIdOrderByCreatedAtDesc(long recipientUserId, Pageable pageable);

    Optional<MusicMentionNotification> findByIdAndRecipientUserId(long id, long recipientUserId);

    void deleteByTrackId(long trackId);
}
