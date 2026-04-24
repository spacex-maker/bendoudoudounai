package com.bendoudou.server.guestbook;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface GuestbookMessageRepository extends JpaRepository<GuestbookMessage, Long> {

    @Query("SELECT g FROM GuestbookMessage g WHERE g.parentId IS NULL AND g.visibleToUserId IS NULL ORDER BY g.createdAt DESC")
    Page<GuestbookMessage> findPublicRootThreads(Pageable pageable);

    @Query("SELECT g FROM GuestbookMessage g WHERE g.parentId IS NULL AND (g.visibleToUserId IS NULL OR g.visibleToUserId = :uid) ORDER BY g.createdAt DESC")
    Page<GuestbookMessage> findRootThreadsForUser(@Param("uid") long uid, Pageable pageable);

    List<GuestbookMessage> findByParentIdInOrderByCreatedAtAsc(Collection<Long> parentIds);
}
