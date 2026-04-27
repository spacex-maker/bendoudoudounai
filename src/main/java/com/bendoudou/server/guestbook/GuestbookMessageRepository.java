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

    /** 管理端：全部主楼（含定向帖），按时间倒序 */
    @Query("SELECT g FROM GuestbookMessage g WHERE g.parentId IS NULL ORDER BY g.createdAt DESC")
    Page<GuestbookMessage> findAllRootThreads(Pageable pageable);

    @Query("""
            SELECT g FROM GuestbookMessage g
            WHERE g.parentId IS NULL
              AND (
                   g.visibleToUserId IS NULL
                   OR g.visibleToUserId = :uid
                   OR g.authorUserId = :uid
                   OR EXISTS (
                      SELECT 1 FROM GuestbookMessage r
                      WHERE r.parentId = g.id AND r.authorUserId = :uid
                   )
              )
            ORDER BY g.createdAt DESC
            """)
    Page<GuestbookMessage> findRootThreadsForUser(@Param("uid") long uid, Pageable pageable);

    @Query("""
            SELECT g FROM GuestbookMessage g
            WHERE g.parentId IS NULL
              AND (
                   g.visibleToUserId = :uid
                   OR g.authorUserId = :uid
                   OR EXISTS (
                      SELECT 1 FROM GuestbookMessage r
                      WHERE r.parentId = g.id AND r.authorUserId = :uid
                   )
              )
            ORDER BY g.createdAt DESC
            """)
    Page<GuestbookMessage> findRelatedRootThreadsForUser(@Param("uid") long uid, Pageable pageable);

    List<GuestbookMessage> findByParentIdInOrderByCreatedAtAsc(Collection<Long> parentIds);
}
